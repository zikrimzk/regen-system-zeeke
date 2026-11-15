<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use Throwable;

final class EmailDeliveryRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function record(string $purpose, string $recipient, string $transport, bool $delivered): void
    {
        try {
            $statement = $this->db->prepare(
                'INSERT INTO email_delivery_logs
                    (purpose, recipient_hash, recipient_mask, transport, status, request_id)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                mb_substr($purpose, 0, 50),
                hash('sha256', mb_strtolower(trim($recipient))),
                self::mask($recipient),
                mb_substr($transport, 0, 20),
                $delivered ? 'accepted' : 'failed',
                mb_substr((string) ($_SERVER['REGEN_REQUEST_ID'] ?? ''), 0, 40) ?: null,
            ]);
        } catch (Throwable $error) {
            error_log('[Email Delivery Log Error] ' . $error::class);
        }
    }

    /** @return list<array<string,mixed>> */
    public function recent(int $limit = 50): array
    {
        $statement = $this->db->query(
            'SELECT id, purpose, recipient_mask, transport, status, request_id, created_at
             FROM email_delivery_logs ORDER BY id DESC LIMIT ' . max(1, min(200, $limit))
        );
        return $statement->fetchAll() ?: [];
    }

    private static function mask(string $email): string
    {
        $email = mb_strtolower(trim($email));
        if (!str_contains($email, '@')) return 'invalid';
        [$local, $domain] = explode('@', $email, 2);
        return mb_substr($local, 0, 1) . str_repeat('*', min(6, max(2, mb_strlen($local) - 1))) . '@' . $domain;
    }
}
