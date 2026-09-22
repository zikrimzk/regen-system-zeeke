<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use Throwable;

final class RateLimiter
{
    private static ?PDO $db = null;
    private static bool $databaseAvailable = true;

    public static function configure(PDO $db): void
    {
        self::$db = $db;
    }

    public static function enforce(string $bucket, string $identity, int $limit, int $windowSeconds): void
    {
        if (self::$db !== null && self::$databaseAvailable) {
            try {
                self::enforceDatabase($bucket, $identity, $limit, $windowSeconds);
                return;
            } catch (Throwable $error) {
                self::$databaseAvailable = false;
                error_log('[Rate Limiter] Database limiter unavailable: ' . $error->getMessage());
            }
        }
        self::enforceFilesystem($bucket, $identity, $limit, $windowSeconds);
    }

    private static function enforceDatabase(
        string $bucket,
        string $identity,
        int $limit,
        int $windowSeconds
    ): void {
        $db = self::$db;
        if (!$db instanceof PDO) {
            throw new \RuntimeException('Rate limiter database is not configured.');
        }

        $key = hash('sha256', $bucket . '|' . $identity);
        $now = time();
        $retryAfter = 0;
        $db->beginTransaction();
        try {
            $seed = $db->prepare(
                'INSERT IGNORE INTO app_rate_limits
                    (bucket_key, bucket_name, window_started_at, request_count, expires_at)
                 VALUES (?, ?, ?, 0, ?)'
            );
            $seed->execute([
                $key,
                mb_substr($bucket, 0, 80),
                $now,
                $now + $windowSeconds + 60,
            ]);
            $select = $db->prepare(
                'SELECT window_started_at, request_count
                 FROM app_rate_limits
                 WHERE bucket_key = ?
                 FOR UPDATE'
            );
            $select->execute([$key]);
            $state = $select->fetch();
            $startedAt = is_array($state) ? (int) ($state['window_started_at'] ?? 0) : 0;
            $count = is_array($state) ? (int) ($state['request_count'] ?? 0) : 0;

            if ($startedAt <= 0 || $startedAt + $windowSeconds <= $now) {
                $startedAt = $now;
                $count = 0;
            }

            if ($count >= $limit) {
                $retryAfter = max(1, ($startedAt + $windowSeconds) - $now);
            } else {
                $count++;
                $upsert = $db->prepare(
                    'INSERT INTO app_rate_limits
                        (bucket_key, bucket_name, window_started_at, request_count, expires_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        bucket_name = VALUES(bucket_name),
                        window_started_at = VALUES(window_started_at),
                        request_count = VALUES(request_count),
                        expires_at = VALUES(expires_at)'
                );
                $upsert->execute([
                    $key,
                    mb_substr($bucket, 0, 80),
                    $startedAt,
                    $count,
                    $startedAt + $windowSeconds + 60,
                ]);
            }
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }

        if (random_int(1, 100) === 1) {
            try {
                $cleanup = $db->prepare('DELETE FROM app_rate_limits WHERE expires_at < ? LIMIT 500');
                $cleanup->execute([$now]);
            } catch (Throwable) {
            }
        }
        self::rejectIfLimited($retryAfter);
    }

    private static function enforceFilesystem(
        string $bucket,
        string $identity,
        int $limit,
        int $windowSeconds
    ): void {
        $directory = rtrim(sys_get_temp_dir(), '/\\') . '/regen-rate-limits';
        if (!is_dir($directory)) {
            @mkdir($directory, 0700, true);
        }
        if (!is_dir($directory) || !is_writable($directory)) {
            self::rejectUnavailable();
        }

        $path = $directory . '/' . hash('sha256', $bucket . '|' . $identity) . '.json';
        $handle = @fopen($path, 'c+');
        if ($handle === false) {
            self::rejectUnavailable();
        }

        $retryAfter = 0;
        try {
            if (!flock($handle, LOCK_EX)) {
                self::rejectUnavailable();
            }
            $raw = stream_get_contents($handle);
            $state = is_string($raw) ? json_decode($raw, true) : null;
            $now = time();
            $startedAt = is_array($state) ? (int) ($state['startedAt'] ?? 0) : 0;
            $count = is_array($state) ? (int) ($state['count'] ?? 0) : 0;

            if ($startedAt <= 0 || $startedAt + $windowSeconds <= $now) {
                $startedAt = $now;
                $count = 0;
            }

            if ($count >= $limit) {
                $retryAfter = max(1, ($startedAt + $windowSeconds) - $now);
            } else {
                $count++;
                rewind($handle);
                ftruncate($handle, 0);
                fwrite($handle, json_encode(['startedAt' => $startedAt, 'count' => $count]));
                fflush($handle);
            }
        } finally {
            @flock($handle, LOCK_UN);
            fclose($handle);
        }

        self::rejectIfLimited($retryAfter);
    }

    private static function rejectIfLimited(int $retryAfter): void
    {
        if ($retryAfter > 0) {
            header('Retry-After: ' . $retryAfter);
            Http::json([
                'success' => false,
                'message' => 'Too many requests. Please try again shortly.',
            ], 429);
        }
    }

    private static function rejectUnavailable(): never
    {
        Http::json([
            'success' => false,
            'message' => 'Request protection is temporarily unavailable. Please try again shortly.',
        ], 503);
    }

    public static function clientIdentity(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    }
}
