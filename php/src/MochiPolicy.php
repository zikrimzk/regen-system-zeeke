<?php
declare(strict_types=1);

namespace ReGen;

use DateTimeImmutable;
use DateTimeZone;
use DomainException;
use PDO;

final class MochiPolicy
{
    public const PLAY = 'mochi_play';
    public const CHAT = 'mochi_chat';
    public const DEFAULTS = ['enabled'=>true, 'health'=>100, 'dailyTokens'=>30, 'start'=>'', 'end'=>'',
        'preview'=>true, 'autoplay'=>true, 'sound'=>true, 'editorReactions'=>true,
        'pace'=>'balanced', 'naps'=>true, 'liveFeedback'=>true, 'feedbackSeconds'=>90, 'dailyBudget'=>500];
    public const ACCOUNT_DEFAULTS = ['mode'=>'inherit', 'dailyTokens'=>null];
    public const TIMEZONE = 'Asia/Kuala_Lumpur';

    public function __construct(private readonly PDO $db) {}

    public static function packageOnly(string $key): bool
    {
        return in_array($key, [MochiCoach::FEATURE, self::PLAY, self::CHAT], true);
    }

    public static function storeFeatures(string $key): array
    {
        return match ($key) {
            self::PLAY => [self::PLAY, self::CHAT, MochiCoach::FEATURE],
            self::CHAT => [self::CHAT, MochiCoach::FEATURE],
            default => [$key],
        };
    }

    public function settings(): array
    {
        return $this->read('mochi', self::DEFAULTS);
    }

    private function read(string $key, array $defaults): array
    {
        $query = $this->db->prepare('SELECT payload FROM operations_settings WHERE setting_key=?');
        $query->execute([$key]);
        $settings = json_decode((string)$query->fetchColumn(), true);
        return array_replace($defaults, is_array($settings) ? array_intersect_key($settings, $defaults) : []);
    }

    public function save(mixed $body, int $adminId): array
    {
        $health = filter_var($body['health'] ?? null, FILTER_VALIDATE_INT);
        $daily = filter_var($body['dailyTokens'] ?? null, FILTER_VALIDATE_INT);
        $start = $body['start'] ?? '';
        $end = $body['end'] ?? '';
        if (!is_bool($body['enabled'] ?? null) || $health === false || $health < 0 || $health > 100
            || $daily === false || $daily < 0 || $daily > 1000 || !is_string($start) || !is_string($end)
            || (($start !== '' || $end !== '') && ($start === $end
                || !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $start)
                || !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $end)))) {
            throw new DomainException('Set valid health, AI tokens and both schedule times, or leave both times blank.');
        }
        $settings = ['enabled'=>$body['enabled'], 'health'=>$health, 'dailyTokens'=>$daily, 'start'=>$start, 'end'=>$end];
        foreach (['preview', 'autoplay', 'sound', 'editorReactions', 'naps', 'liveFeedback'] as $key) {
            if (isset($body[$key]) && !is_bool($body[$key])) throw new DomainException('Choose valid Mochi switches.');
            $settings[$key] = $body[$key] ?? self::DEFAULTS[$key];
        }
        $pace = $body['pace'] ?? self::DEFAULTS['pace'];
        $feedback = filter_var($body['feedbackSeconds'] ?? self::DEFAULTS['feedbackSeconds'], FILTER_VALIDATE_INT);
        $budget = filter_var($body['dailyBudget'] ?? self::DEFAULTS['dailyBudget'], FILTER_VALIDATE_INT);
        if (!in_array($pace,['calm','balanced','playful'],true) || $feedback===false || $feedback<45 || $feedback>600
            || $budget===false || $budget<0 || $budget>100000) {
            throw new DomainException('Choose a play pace, 45–600 seconds between field requests, and a daily app budget of 0–100,000 requests.');
        }
        $settings += ['pace'=>$pace,'feedbackSeconds'=>$feedback,'dailyBudget'=>$budget];
        $this->write('mochi', $settings, $adminId);
        return $settings;
    }

    public function account(int $userId): array
    {
        return $this->read('mochi_user_'.$userId, self::ACCOUNT_DEFAULTS);
    }

    public function saveAccount(int $userId, array $body, int $adminId): array
    {
        $mode = $body['mode'] ?? null;
        $daily = $body['dailyTokens'] ?? null;
        if (!in_array($mode, ['inherit','play-only','off'], true) || ($daily !== null && (!is_int($daily) || $daily < 0 || $daily > 1000))) {
            throw new DomainException('Choose valid account access and an optional daily limit from 0 to 1,000.');
        }
        $settings = ['mode'=>$mode,'dailyTokens'=>$daily];
        $this->write('mochi_user_'.$userId, $settings, $adminId);
        return $settings;
    }

    private function write(string $key, array $settings, int $adminId): void
    {
        $query = $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES (?,?,?)
            ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()");
        $query->execute([$key, json_encode($settings, JSON_THROW_ON_ERROR), $adminId]);
    }

    public static function available(array $settings, ?DateTimeImmutable $now = null): bool
    {
        if (!$settings['enabled']) return false;
        $start = $settings['start'];
        $end = $settings['end'];
        if ($start === '' || $end === '') return true;
        $zone = new DateTimeZone(self::TIMEZONE);
        $time = ($now ?? new DateTimeImmutable('now', $zone))->setTimezone($zone)->format('H:i');
        return $start < $end ? $time >= $start && $time < $end : $time >= $start || $time < $end;
    }

    public static function dailyLimit(array $settings, array $account): int
    {
        return $settings['dailyTokens'] === 0 ? 0 : ($account['dailyTokens'] ?? $settings['dailyTokens']);
    }

    public function takeToken(int $userId, int $limit, int $budget=self::DEFAULTS['dailyBudget']): bool
    {
        if ($limit <= 0 || $budget <= 0) return false;
        $day = (new DateTimeImmutable('now', new DateTimeZone(self::TIMEZONE)))->setTime(0, 0);
        // Reserve both counters together; an account at its own limit cannot drain the app budget.
        $this->db->beginTransaction();
        try {
            if (!$this->increment(self::bucket(null,$day), 'mochi-app-daily', $day, $budget)
                || !$this->increment(self::bucket($userId,$day), 'mochi-daily', $day, $limit)) {
                $this->db->rollBack();
                return false;
            }
            $this->db->commit();
            return true;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function increment(string $key, string $name, DateTimeImmutable $day, int $limit): bool
    {
        $query = $this->db->prepare("INSERT INTO app_rate_limits
            (bucket_key,bucket_name,window_started_at,request_count,expires_at)
            VALUES (?,?,?,1,?)
            ON DUPLICATE KEY UPDATE request_count=IF(request_count < ?,request_count + 1,request_count)");
        $query->execute([$key, $name, $day->getTimestamp(), $day->modify('+2 days')->getTimestamp(), $limit]);
        return $query->rowCount() > 0;
    }

    public function usedToday(?int $userId=null): int
    {
        $day = new DateTimeImmutable('now', new DateTimeZone(self::TIMEZONE));
        $query = $this->db->prepare('SELECT request_count FROM app_rate_limits WHERE bucket_key=?');
        $query->execute([self::bucket($userId, $day)]);
        return (int)$query->fetchColumn();
    }

    private static function bucket(?int $userId, DateTimeImmutable $day): string
    {
        return hash('sha256', 'mochi-daily|' . ($userId ?? 'app') . '|' . $day->format('Y-m-d'));
    }
}
