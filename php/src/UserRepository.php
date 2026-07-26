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

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $statement->execute([mb_strtolower(trim($email))]);
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
}
