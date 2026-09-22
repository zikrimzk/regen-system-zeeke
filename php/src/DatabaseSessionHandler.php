<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use SessionHandlerInterface;
use SessionUpdateTimestampHandlerInterface;
use Throwable;

final class DatabaseSessionHandler implements SessionHandlerInterface, SessionUpdateTimestampHandlerInterface
{
    public function __construct(
        private readonly PDO $db,
        private readonly int $ttl,
    ) {
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        try {
            $statement = $this->db->prepare(
                'SELECT session_data
                 FROM app_sessions
                 WHERE sid = ? AND expires_at > UTC_TIMESTAMP(3)
                 LIMIT 1'
            );
            $statement->execute([$id]);
            $stored = $statement->fetchColumn();
            if (!is_string($stored) || $stored === '') {
                return '';
            }
            $decoded = json_decode($stored, true);
            $payload = is_array($decoded) ? (string) ($decoded['payload'] ?? '') : '';
            $data = $payload !== '' ? base64_decode($payload, true) : false;
            return is_string($data) ? $data : '';
        } catch (Throwable $error) {
            error_log('[Session Read Error] ' . $error->getMessage());
            return false;
        }
    }

    public function write(string $id, string $data): bool
    {
        try {
            $encoded = json_encode(
                ['payload' => base64_encode($data)],
                JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            if (!is_string($encoded)) {
                return false;
            }
            $statement = $this->db->prepare(
                'INSERT INTO app_sessions (sid, session_data, expires_at)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    session_data = VALUES(session_data),
                    expires_at = VALUES(expires_at)'
            );
            return $statement->execute([
                $id,
                $encoded,
                self::expiry($this->ttl),
            ]);
        } catch (Throwable $error) {
            error_log('[Session Write Error] ' . $error->getMessage());
            return false;
        }
    }

    public function destroy(string $id): bool
    {
        try {
            $statement = $this->db->prepare('DELETE FROM app_sessions WHERE sid = ?');
            return $statement->execute([$id]);
        } catch (Throwable $error) {
            error_log('[Session Destroy Error] ' . $error->getMessage());
            return false;
        }
    }

    public function gc(int $max_lifetime): int|false
    {
        try {
            $statement = $this->db->prepare(
                'DELETE FROM app_sessions WHERE expires_at <= UTC_TIMESTAMP(3) LIMIT 1000'
            );
            $statement->execute();
            return $statement->rowCount();
        } catch (Throwable $error) {
            error_log('[Session GC Error] ' . $error->getMessage());
            return false;
        }
    }

    public function validateId(string $id): bool
    {
        try {
            $statement = $this->db->prepare(
                'SELECT 1 FROM app_sessions
                 WHERE sid = ? AND expires_at > UTC_TIMESTAMP(3)
                 LIMIT 1'
            );
            $statement->execute([$id]);
            return (bool) $statement->fetchColumn();
        } catch (Throwable) {
            return false;
        }
    }

    public function updateTimestamp(string $id, string $data): bool
    {
        try {
            $statement = $this->db->prepare(
                'UPDATE app_sessions SET expires_at = ? WHERE sid = ?'
            );
            $statement->execute([self::expiry($this->ttl), $id]);
            return $statement->rowCount() > 0 || $this->validateId($id);
        } catch (Throwable) {
            return false;
        }
    }

    private static function expiry(int $ttl): string
    {
        return gmdate('Y-m-d H:i:s.v', time() + max(900, $ttl));
    }
}
