<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use PDOException;

final class UserRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @param array<string, string> $data
     *  @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $statement = $this->db->prepare(
            'INSERT INTO users (first_name, last_name, email, password_hash, phone, address)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            trim($data['firstName']),
            trim($data['lastName']),
            mb_strtolower(trim($data['email'])),
            password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 10]),
            trim($data['phone'] ?? ''),
            trim($data['address'] ?? ''),
        ]);
        return [
            'id' => (int) $this->db->lastInsertId(),
            'firstName' => $data['firstName'],
            'lastName' => $data['lastName'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? '',
            'address' => $data['address'] ?? '',
        ];
    }

    /**
     * @param array{
     *   subject: string,
     *   email: string,
     *   firstName: string,
     *   lastName: string
     * } $identity
     * @return array<string, mixed>
     */
    public function createFromGoogle(array $identity): array
    {
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'INSERT INTO users (first_name, last_name, email, password_hash, phone, address)
                 VALUES (?, ?, ?, NULL, ?, ?)'
            );
            $statement->execute([
                trim($identity['firstName']),
                trim($identity['lastName']),
                mb_strtolower(trim($identity['email'])),
                '',
                '',
            ]);
            $userId = (int) $this->db->lastInsertId();
            $this->insertIdentity(
                $userId,
                'google',
                $identity['subject'],
                $identity['email']
            );
            $this->db->commit();

            return [
                'id' => $userId,
                'first_name' => $identity['firstName'],
                'last_name' => $identity['lastName'],
                'email' => $identity['email'],
                'phone' => '',
                'address' => '',
            ];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $statement->execute([mb_strtolower(trim($email))]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    public function findByIdentity(string $provider, string $subject): ?array
    {
        $statement = $this->db->prepare(
            'SELECT users.*
             FROM user_identities
             INNER JOIN users ON users.id = user_identities.user_id
             WHERE user_identities.provider = ?
               AND user_identities.provider_subject = ?
             LIMIT 1'
        );
        $statement->execute([$provider, $subject]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        $statement = $this->db->prepare(
            'SELECT id, first_name, last_name, email, phone, address, created_at
             FROM users WHERE id = ? LIMIT 1'
        );
        $statement->execute([$id]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    public function emailExists(string $email): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
        $statement->execute([mb_strtolower(trim($email))]);
        return (bool) $statement->fetchColumn();
    }

    public function linkGoogleIdentity(int $userId, string $subject, string $email): void
    {
        $this->insertIdentity($userId, 'google', $subject, $email);
    }

    /** @param array<string, mixed> $user */
    public function verifyPassword(string $plainText, array $user): bool
    {
        $hash = (string) ($user['password_hash'] ?? '');
        $compatibleHash = str_starts_with($hash, '$2b$')
            ? '$2y$' . substr($hash, 4)
            : $hash;
        $valid = $compatibleHash !== '' && password_verify($plainText, $compatibleHash);
        if ($valid && (
            str_starts_with($hash, '$2b$')
            || password_needs_rehash($compatibleHash, PASSWORD_BCRYPT, ['cost' => 10])
        )) {
            $statement = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $statement->execute([
                password_hash($plainText, PASSWORD_BCRYPT, ['cost' => 10]),
                (int) $user['id'],
            ]);
        }
        return $valid;
    }

    private function insertIdentity(
        int $userId,
        string $provider,
        string $subject,
        string $email
    ): void {
        $statement = $this->db->prepare(
            'INSERT INTO user_identities (user_id, provider, provider_subject, email_at_link)
             VALUES (?, ?, ?, ?)'
        );
        $statement->execute([
            $userId,
            $provider,
            trim($subject),
            mb_strtolower(trim($email)),
        ]);
    }
}
