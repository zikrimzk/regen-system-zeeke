<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use Throwable;

final class AiQuotaService
{
    public const DAILY_LIMIT = 15;
    public const WINDOW_SECONDS = 86400;

    private readonly int $dailyLimit;

    public function __construct(
        private readonly PDO $db,
        int $dailyLimit = self::DAILY_LIMIT,
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
        $statement = $this->db->prepare(
            'SELECT window_started_at, request_count
             FROM ai_usage_windows
             WHERE user_id = ?
             LIMIT 1'
        );
        $statement->execute([$userId]);
        $row = $statement->fetch();
        return $this->formatStatus(is_array($row) ? $row : null, time());
    }

    /**
     * Atomically consumes one AI request from the user's rolling 24-hour window.
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
    public function consume(int $userId): array
    {
        $now = time();
        $reservationToken = null;
        $this->db->beginTransaction();
        try {
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

            if ($startedAt <= 0 || $startedAt + self::WINDOW_SECONDS <= $now) {
                $startedAt = $now;
                $used = 0;
            }

            $allowed = $used < $this->dailyLimit;
            if ($allowed) {
                $reservationToken = bin2hex(random_bytes(32));
                $used++;
                $update = $this->db->prepare(
                    'UPDATE ai_usage_windows
                     SET window_started_at = ?, request_count = ?
                     WHERE user_id = ?'
                );
                $update->execute([$startedAt, $used, $userId]);
                $reservation = $this->db->prepare(
                    'INSERT INTO ai_usage_reservations
                        (reservation_token, user_id, window_started_at, expires_at)
                     VALUES (?, ?, ?, ?)'
                );
                $reservation->execute([
                    $reservationToken,
                    $userId,
                    $startedAt,
                    $startedAt + self::WINDOW_SECONDS + 3600,
                ]);
            }
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
            // Reservation cleanup is best-effort and never changes the quota decision.
        }

        return [
            'allowed' => $allowed,
            'reservationToken' => $reservationToken,
            ...$this->formatStatus([
                'window_started_at' => $startedAt,
                'request_count' => $used,
            ], $now),
        ];
    }

    /**
     * Releases a reserved request only when it still belongs to the same usage
     * window. This prevents a late provider failure from changing a new window.
     */
    public function refund(
        int $userId,
        ?string $windowStartedAt,
        ?string $reservationToken,
    ): void
    {
        if (
            $userId < 1
            || $windowStartedAt === null
            || trim($windowStartedAt) === ''
            || !is_string($reservationToken)
            || preg_match('/^[a-f0-9]{64}$/', $reservationToken) !== 1
        ) {
            return;
        }
        $startedAt = strtotime($windowStartedAt);
        if ($startedAt === false || $startedAt < 1) {
            return;
        }
        $this->db->beginTransaction();
        try {
            $select = $this->db->prepare(
                'SELECT user_id, window_started_at
                 FROM ai_usage_reservations
                 WHERE reservation_token = ?
                 FOR UPDATE'
            );
            $select->execute([$reservationToken]);
            $reservation = $select->fetch();
            if (
                !is_array($reservation)
                || (int) ($reservation['user_id'] ?? 0) !== $userId
                || (int) ($reservation['window_started_at'] ?? 0) !== $startedAt
            ) {
                $this->db->commit();
                return;
            }

            $statement = $this->db->prepare(
                'UPDATE ai_usage_windows
                 SET request_count = request_count - 1
                 WHERE user_id = ? AND window_started_at = ? AND request_count > 0'
            );
            $statement->execute([$userId, $startedAt]);
            $delete = $this->db->prepare(
                'DELETE FROM ai_usage_reservations WHERE reservation_token = ?'
            );
            $delete->execute([$reservationToken]);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /**
     * Marks a successful reservation complete without changing the usage count.
     * Repeating this operation is safe.
     */
    public function finalize(
        int $userId,
        ?string $windowStartedAt,
        ?string $reservationToken,
    ): void
    {
        if (
            $userId < 1
            || $windowStartedAt === null
            || trim($windowStartedAt) === ''
            || !is_string($reservationToken)
            || preg_match('/^[a-f0-9]{64}$/', $reservationToken) !== 1
        ) {
            return;
        }
        $startedAt = strtotime($windowStartedAt);
        if ($startedAt === false || $startedAt < 1) {
            return;
        }
        $statement = $this->db->prepare(
            'DELETE FROM ai_usage_reservations
             WHERE reservation_token = ? AND user_id = ? AND window_started_at = ?'
        );
        $statement->execute([$reservationToken, $userId, $startedAt]);
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
    private function formatStatus(?array $row, int $now): array
    {
        $startedAt = is_array($row) ? (int) ($row['window_started_at'] ?? 0) : 0;
        $used = is_array($row) ? max(0, (int) ($row['request_count'] ?? 0)) : 0;
        if ($startedAt <= 0 || $startedAt + self::WINDOW_SECONDS <= $now) {
            $startedAt = 0;
            $used = 0;
        }
        $used = min($this->dailyLimit, $used);
        $remaining = max(0, $this->dailyLimit - $used);

        return [
            'limit' => $this->dailyLimit,
            'used' => $used,
            'remaining' => $remaining,
            'windowStartedAt' => $startedAt > 0 ? gmdate(DATE_ATOM, $startedAt) : null,
            'resetAt' => $startedAt > 0
                ? gmdate(DATE_ATOM, $startedAt + self::WINDOW_SECONDS)
                : null,
            'exhausted' => $remaining === 0,
        ];
    }
}
