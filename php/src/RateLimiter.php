<?php
declare(strict_types=1);

namespace ReGen;

final class RateLimiter
{
    public static function enforce(string $bucket, string $identity, int $limit, int $windowSeconds): void
    {
        $directory = rtrim(sys_get_temp_dir(), '/\\') . '/regen-rate-limits';
        if (!is_dir($directory)) {
            @mkdir($directory, 0700, true);
        }
        if (!is_dir($directory) || !is_writable($directory)) {
            return;
        }

        $path = $directory . '/' . hash('sha256', $bucket . '|' . $identity) . '.json';
        $handle = @fopen($path, 'c+');
        if ($handle === false) {
            return;
        }

        $retryAfter = 0;
        try {
            if (!flock($handle, LOCK_EX)) {
                return;
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

        if ($retryAfter > 0) {
            header('Retry-After: ' . $retryAfter);
            Http::json([
                'success' => false,
                'message' => 'Too many requests. Please try again shortly.',
            ], 429);
        }
    }

    public static function clientIdentity(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    }
}
