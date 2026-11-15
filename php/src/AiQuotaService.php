<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use Throwable;

final class AiQuotaService
{
    public const DAILY_LIMIT = 10;
    public const WINDOW_SECONDS = 86400;
    public const OPERATIONS = ['assist', 'refine', 'cover_letter', 'review'];
    public const FEATURES = ['assist'=>'ai_assist','refine'=>'ai_refine','cover_letter'=>'ai_cover_letter','review'=>'ai_review'];

    public function costs(): array { return $this->controls(0)['costs']; }

    private readonly int $dailyLimit;

    public function __construct(
        private readonly PDO $db,
        int $dailyLimit = self::DAILY_LIMIT,
        private readonly bool $useDatabaseControls = true,
    ) {
        $this->dailyLimit = max(1, min(1000, $dailyLimit));
    }

    public function limit(): int
    {
        return $this->dailyLimit;
    }

    /**
     * @return array{
     *   limit:int,
     *   used:int,
     *   remaining:int,
     *   windowStartedAt:?string,
     *   resetAt:?string,
     *   exhausted:bool
     * }
     */
    public function status(int $userId): array
    {
        $controls = $this->controls($userId);
        $statement = $this->db->prepare(
            'SELECT window_started_at, request_count
             FROM ai_usage_windows
             WHERE user_id = ?
             LIMIT 1'
        );
        $statement->execute([$userId]);
        $row = $statement->fetch();
        return $this->withBonus($this->formatStatus(
            is_array($row) ? $row : null,
            time(),
            $controls['limit'],
            $controls['windowSeconds'],
            $controls['enabled'],
            $this->held($userId, is_array($row) ? (int) $row['window_started_at'] : 0),
            $controls['renewable']
        ), $userId) + ['costs' => $controls['costs']];
    }

    /**
     * Atomically reserves capacity for one AI operation from the user's rolling 24-hour window.
     * The database is the only source of truth so parallel PHP workers cannot
     * bypass the daily limit.
     *
     * @return array{
     *   allowed:bool,
     *   limit:int,
     *   used:int,
     *   remaining:int,
     *   windowStartedAt:?string,
     *   resetAt:?string,
     *   exhausted:bool,
     *   reservationToken:?string
     * }
     */
    public function consume(int $userId, string $operation = 'refine'): array
    {
        $now = time();
        $controls = $this->controls($userId);
        if (!$controls['enabled']) {
            return [
                'allowed' => false,
                'reservationToken' => null,
                ...$this->formatStatus(null, $now, $controls['limit'], $controls['windowSeconds'], false,0,$controls['renewable']),
            ];
        }
        $limit = $controls['limit'];
        $windowSeconds = $controls['windowSeconds'];
        if (!in_array($operation, self::OPERATIONS, true)) throw new \InvalidArgumentException('Unknown AI operation.');
        $price = $controls['prices'][self::FEATURES[$operation]] ?? null;
        if ($price) {
            $benefit = (new FeaturePricing($this->db))->reserveAiBenefit($userId,self::FEATURES[$operation]);
            if ($benefit !== null) return ['allowed'=>true,'cost'=>0,'benefitReservation'=>$benefit,...$this->status($userId)];
            if($price['mode']==='package_only')return [...$this->status($userId),'allowed'=>false,'accessDenied'=>true,'price'=>$price,'reservationToken'=>null];
        }
        $cost = $price ? ($price['mode']==='per_use' && !$price['unlocked'] ? $price['cost'] : 0) : $controls['costs'][$operation];
        $reservationToken = null;
        $this->db->beginTransaction();
        try {
            // All wallet/AI mutations acquire the account lock first.
            $wallet = new BonusCreditService($this->db);
            $wallet->lock($userId);
            $seed = $this->db->prepare(
                'INSERT INTO ai_usage_windows (user_id, window_started_at, request_count)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)'
            );
            $seed->execute([$userId, $now]);

            $select = $this->db->prepare(
                'SELECT window_started_at, request_count
                 FROM ai_usage_windows
                 WHERE user_id = ?
                 FOR UPDATE'
            );
            $select->execute([$userId]);
            $row = $select->fetch();
            if (!is_array($row)) {
                throw new \RuntimeException('AI usage state could not be reserved.');
            }
            $startedAt = (int) ($row['window_started_at'] ?? 0);
            $used = (int) ($row['request_count'] ?? 0);

            if ($startedAt <= 0 || ($controls['renewable'] && $startedAt + $windowSeconds <= $now)) {
                $startedAt = $now;
                $used = 0;
            }

            $held = $this->held($userId, $startedAt);
            $baseAvailable = max(0, $limit - $used - $held);
            $bonusCost = max(0,$cost-$baseAvailable);
            $allowed = $bonusCost <= $wallet->balance($userId)['available'];
            if ($allowed) {
                $reservationToken = bin2hex(random_bytes(32));
                $update = $this->db->prepare(
                    'UPDATE ai_usage_windows
                     SET window_started_at = ?, request_count = ?
                     WHERE user_id = ?'
                );
                $update->execute([$startedAt, $used, $userId]);
                $reservation = $this->db->prepare(
                    'INSERT INTO ai_usage_reservations
                        (reservation_token, user_id, window_started_at, expires_at, token_cost, bonus_cost, is_hold, operation)
                     VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
                );
                $reservation->execute([
                    $reservationToken,
                    $userId,
                    $startedAt,
                    $now + 600,
                    $cost,
                    $bonusCost,
                    $operation,
                ]);
            }
            (new RealtimeEvents($this->db))->publish('ai','user',$userId);
            (new RealtimeEvents($this->db))->publish('ai','admin');
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }

        try {
            $cleanup = $this->db->prepare(
                'DELETE FROM ai_usage_reservations WHERE expires_at < ? LIMIT 100'
            );
            $cleanup->execute([$now]);
        } catch (Throwable) {
            // RESERVATION CLEANUP IS BEST-EFFORT AND NEVER CHANGES THE QUOTA DECISION.
        }

        return [
            'allowed' => $allowed,
            'cost' => $cost,
            'costs' => $controls['costs'],
            'reservationToken' => $reservationToken,
            ...$this->withBonus($this->formatStatus([
                'window_started_at' => $startedAt,
                'request_count' => $used,
                'held' => $held + ($allowed ? $cost - $bonusCost : 0),
            ], $now, $limit, $windowSeconds, true,0,$controls['renewable']), $userId),
        ];
    }

    /**
     * Releases a reserved request only when it still belongs to the same usage
     * window. This prevents a late provider failure from changing a new window.
     */
    public function refund(int $userId, ?string $windowStartedAt, ?string $reservationToken): void
    {
        $this->settle($userId, $windowStartedAt, $reservationToken, false);
    }

    public function finalize(int $userId, ?string $windowStartedAt, ?string $reservationToken): void
    {
        $this->settle($userId, $windowStartedAt, $reservationToken, true);
    }

    private function settle(int $userId, ?string $windowStartedAt, ?string $token, bool $success): void
    {
        $started = $windowStartedAt === null ? false : strtotime($windowStartedAt);
        if ($userId < 1 || !$started || !is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) return;
        $this->db->beginTransaction();
        try {
            (new BonusCreditService($this->db))->lock($userId);
            // Match consume's lock order; a crashed request leaves only an expiring hold.
            $lock = $this->db->prepare('SELECT window_started_at FROM ai_usage_windows WHERE user_id = ? FOR UPDATE');
            $lock->execute([$userId]);
            $current = $lock->fetchColumn();
            $select = $this->db->prepare('SELECT * FROM ai_usage_reservations WHERE reservation_token = ? AND user_id = ? AND window_started_at = ? FOR UPDATE');
            $select->execute([$token, $userId, $started]);
            $hold = $select->fetch();
            if (is_array($hold)) {
                if ((int) $current === $started) {
                    if ($success && (bool) $hold['is_hold'] && (int) $hold['expires_at'] > time()) {
                        $bonusCost = (int) $hold['bonus_cost'];
                        if ($bonusCost > 0) {
                            $this->db->prepare('DELETE FROM ai_usage_reservations WHERE reservation_token = ?')->execute([$token]);
                            (new BonusCreditService($this->db))->adjust($userId, -$bonusCost, 'AI: '.FeaturePricing::CATALOGUE[self::FEATURES[$hold['operation']]][0], 'generation', 'generation:'.$token);
                        }
                        $update = $this->db->prepare('UPDATE ai_usage_windows SET request_count = request_count + ? WHERE user_id = ?');
                        $update->execute([(int) $hold['token_cost'] - $bonusCost, $userId]);
                        $baseCost=(int)$hold['token_cost']-$bonusCost;
                        if ($baseCost>0) $this->db->prepare('INSERT IGNORE INTO ai_token_activity (user_id,request_key,operation,base_tokens) VALUES (?,?,?,?)')->execute([$userId,$token,$hold['operation'],$baseCost]);
                    } elseif (!$success && !(bool) $hold['is_hold']) {
                        // Previous releases charged reservations before contacting the provider.
                        $update = $this->db->prepare('UPDATE ai_usage_windows SET request_count = GREATEST(0, request_count - ?) WHERE user_id = ?');
                        $update->execute([(int) $hold['token_cost'], $userId]);
                    }
                }
                $delete = $this->db->prepare('DELETE FROM ai_usage_reservations WHERE reservation_token = ?');
                $delete->execute([$token]);
            }
            (new RealtimeEvents($this->db))->publish('ai','user',$userId);
            (new RealtimeEvents($this->db))->publish('ai','admin');
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function held(int $userId, int $startedAt): int
    {
        $select = $this->db->prepare('SELECT COALESCE(SUM(token_cost - bonus_cost), 0) FROM ai_usage_reservations WHERE user_id = ? AND window_started_at = ? AND is_hold = 1 AND expires_at > ?');
        $select->execute([$userId, $startedAt, time()]);
        return (int) $select->fetchColumn();
    }

    /**
     * @param array<string, mixed>|null $row
     * @return array{
     *   limit:int,
     *   used:int,
     *   remaining:int,
     *   windowStartedAt:?string,
     *   resetAt:?string,
     *   exhausted:bool
     * }
     */
    private function formatStatus(
        ?array $row,
        int $now,
        ?int $limit = null,
        int $windowSeconds = self::WINDOW_SECONDS,
        bool $enabled = true,
        int $held = 0,
        bool $renewable = true,
    ): array
    {
        $limit = max(0, min(1000, $limit ?? $this->dailyLimit));
        $startedAt = is_array($row) ? (int) ($row['window_started_at'] ?? 0) : 0;
        $used = is_array($row) ? max(0, (int) ($row['request_count'] ?? 0)) : 0;
        if ($startedAt <= 0 || ($renewable && $startedAt + $windowSeconds <= $now)) {
            $startedAt = 0;
            $used = 0;
            $held = 0;
        }
        $held = (int) ($row['held'] ?? $held);
        $remaining = max(0, $limit - $used - $held);

        return [
            'limit' => $limit,
            'used' => $used,
            'reserved' => $held,
            'remaining' => $remaining,
            'windowStartedAt' => $startedAt > 0 ? gmdate(DATE_ATOM, $startedAt) : null,
            'resetAt' => $renewable && $startedAt > 0
                ? gmdate(DATE_ATOM, $startedAt + $windowSeconds)
                : null,
            'exhausted' => $remaining === 0,
            'enabled' => $enabled && $limit > 0,
            'renewalHours' => (int) round($windowSeconds / 3600),
            'renewable' => $renewable,
        ];
    }

    private function withBonus(array $status, int $userId): array
    {
        $bonus = (new BonusCreditService($this->db))->balance($userId);
        $status['baseRemaining'] = $status['remaining'];
        $status['bonusBalance'] = $bonus['balance'];
        $status['bonusReserved'] = $bonus['reserved'];
        $status['bonusRemaining'] = $bonus['available'];
        $status['remaining'] += $bonus['available'];
        $status['exhausted'] = $status['remaining'] === 0;
        return $status;
    }

    /** @return array{enabled:bool,limit:int,windowSeconds:int} */
    private function controls(int $userId): array
    {
        $enabled = true;
        $limit = $this->dailyLimit;
        $hours = 24;
        $renewable = true;
        $costs = array_fill_keys(self::OPERATIONS, 1);
        if (!$this->useDatabaseControls) {
            return ['enabled' => true, 'renewable'=>true, 'limit' => $limit, 'windowSeconds' => $hours * 3600, 'costs' => array_fill_keys(self::OPERATIONS, 1)];
        }
        try {
            $settings = $this->db->query(
                "SELECT setting_key, setting_value FROM app_settings
                 WHERE setting_key LIKE 'ai_%'"
            )->fetchAll();
            foreach ($settings ?: [] as $setting) {
                foreach (self::OPERATIONS as $operation) {
                    if ($setting['setting_key'] === 'ai_cost_' . $operation) $costs[$operation] = max(0, min(1000, (int) $setting['setting_value']));
                }
                if ($setting['setting_key'] === 'ai_enabled') $enabled = $setting['setting_value'] === '1';
                if ($setting['setting_key'] === 'ai_default_limit') $limit = (int) $setting['setting_value'];
                if ($setting['setting_key'] === 'ai_renewal_hours') $hours = (int) $setting['setting_value'];
                if ($setting['setting_key'] === 'ai_renewable') $renewable = $setting['setting_value'] === '1';
            }
            $statement = $this->db->prepare('SELECT ai_token_limit FROM users WHERE id = ? LIMIT 1');
            $statement->execute([$userId]);
            $override = $statement->fetchColumn();
            if ($override !== false && $override !== null) $limit = (int) $override;
        } catch (Throwable) {
            // OLDER INSTALLATIONS KEEP THE CONFIGURED SAFE DEFAULT UNTIL MIGRATION 007 IS APPLIED.
        }
        $prices = (new FeaturePricing($this->db))->all($userId ?: null);
        foreach (self::FEATURES as $operation=>$key) {
            $price=$prices[$key];
            $costs[$operation]=$price['mode']==='per_use' && !$price['unlocked'] && !$price['packageUnlocked'] && !$price['packageUses'] && !$price['credits'] ? $price['cost'] : 0;
        }
        return [
            'enabled' => $enabled && $limit > 0,
            'prices' => $prices,
            'renewable' => $renewable,
            'costs' => $costs,
            'limit' => max(0, min(1000, $limit)),
            'windowSeconds' => max(1, min(720, $hours)) * 3600,
        ];
    }
}
