<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use PDOException;

final class UserRepository
{
    private const DUMMY_PASSWORD_HASH = '$2y$12$7VDJUSYlytyVau7g3QsB7.Pkil2WJHcqBjwbFMiY8QTaCPjeHgi9W';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @param array<string, string> $data
     *  @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $statement = $this->db->prepare(
            'INSERT INTO users
                (first_name, last_name, email, password_hash, phone, address, email_verified_at)
             VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))'
        );
        $statement->execute([
            trim($data['firstName']),
            trim($data['lastName']),
            mb_strtolower(trim($data['email'])),
            password_hash($data['password'], PASSWORD_DEFAULT),
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
     * Creates a password account and its first single-use verification token atomically.
     * The raw token must never be passed to this repository or stored in the database.
     *
     * @param array<string, string> $data
     * @return array<string, mixed>
     */
    public function createUnverified(
        array $data,
        string $tokenHash,
        string $expiresAt,
    ): array {
        if (strlen($tokenHash) !== 32) {
            throw new \InvalidArgumentException('Verification token hash must be 32 bytes.');
        }

        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'INSERT INTO users
                    (first_name, last_name, email, password_hash, phone, address, email_verified_at)
                 VALUES (?, ?, ?, ?, ?, ?, NULL)'
            );
            $email = mb_strtolower(trim($data['email']));
            $statement->execute([
                trim($data['firstName']),
                trim($data['lastName']),
                $email,
                password_hash($data['password'], PASSWORD_DEFAULT),
                trim($data['phone'] ?? ''),
                trim($data['address'] ?? ''),
            ]);
            $userId = (int) $this->db->lastInsertId();
            $this->storeVerificationToken($userId, $email, $tokenHash, $expiresAt);
            $this->db->commit();

            return [
                'id' => $userId,
                'first_name' => $data['firstName'],
                'last_name' => $data['lastName'],
                'email' => $email,
                'phone' => $data['phone'] ?? '',
                'address' => $data['address'] ?? '',
                'email_verified_at' => null,
            ];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
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
                'INSERT INTO users
                    (first_name, last_name, email, password_hash, phone, address, email_verified_at)
                 VALUES (?, ?, ?, NULL, ?, ?, UTC_TIMESTAMP(3))'
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
            'SELECT id, first_name, last_name, email, phone, address,
                    email_verified_at, created_at
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
        $this->db->beginTransaction();
        try {
            $this->insertIdentity($userId, 'google', $subject, $email);
            $this->markEmailVerifiedInTransaction($userId);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function markEmailVerified(int $userId): void
    {
        $this->db->beginTransaction();
        try {
            $this->markEmailVerifiedInTransaction($userId);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /** @return array<string, mixed>|null */
    public function issueVerificationTokenForEmail(
        string $email,
        string $tokenHash,
        string $expiresAt,
    ): ?array {
        if (strlen($tokenHash) !== 32) {
            throw new \InvalidArgumentException('Verification token hash must be 32 bytes.');
        }
        $email = mb_strtolower(trim($email));
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT id, first_name, last_name, email, email_verified_at
                 FROM users WHERE email = ? LIMIT 1 FOR UPDATE'
            );
            $statement->execute([$email]);
            $user = $statement->fetch();
            if (!is_array($user) || $user['email_verified_at'] !== null) {
                $this->db->commit();
                return null;
            }
            $this->storeVerificationToken(
                (int) $user['id'],
                (string) $user['email'],
                $tokenHash,
                $expiresAt
            );
            $this->db->commit();
            return $user;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function consumeVerificationToken(string $tokenHash): bool
    {
        if (strlen($tokenHash) !== 32) {
            return false;
        }

        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT tokens.user_id, tokens.email_at_issue,
                        (tokens.expires_at > UTC_TIMESTAMP(3)) AS token_fresh,
                        users.email, users.email_verified_at
                 FROM email_verification_tokens AS tokens
                 INNER JOIN users ON users.id = tokens.user_id
                 WHERE tokens.token_hash = ?
                 LIMIT 1 FOR UPDATE'
            );
            $statement->bindValue(1, $tokenHash, PDO::PARAM_LOB);
            $statement->execute();
            $row = $statement->fetch();
            if (!is_array($row)) {
                $this->db->commit();
                return false;
            }

            $userId = (int) $row['user_id'];
            $emailMatches = hash_equals(
                mb_strtolower((string) $row['email_at_issue']),
                mb_strtolower((string) $row['email'])
            );
            $valid = (int) $row['token_fresh'] === 1
                && $emailMatches
                && $row['email_verified_at'] === null;
            if ($valid) {
                $update = $this->db->prepare(
                    'UPDATE users
                     SET email_verified_at = UTC_TIMESTAMP(3)
                     WHERE id = ? AND email_verified_at IS NULL'
                );
                $update->execute([$userId]);
                $valid = $update->rowCount() === 1;
            }

            // Expired, mismatched, already-used and successful tokens are all single-use.
            $delete = $this->db->prepare(
                'DELETE FROM email_verification_tokens WHERE user_id = ?'
            );
            $delete->execute([$userId]);
            $this->db->commit();
            return $valid;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /** @param array<string, mixed> $user */
    public function verifyPassword(string $plainText, array $user): bool
    {
        $hash = (string) ($user['password_hash'] ?? '');
        $compatibleHash = str_starts_with($hash, '$2b$')
            ? '$2y$' . substr($hash, 4)
            : $hash;
        if (
            $compatibleHash === ''
            || (password_get_info($compatibleHash)['algoName'] ?? 'unknown') === 'unknown'
        ) {
            return $this->consumePasswordCheck($plainText);
        }
        $valid = strlen($plainText) <= 128
            && password_verify($plainText, $compatibleHash);
        if ($valid && (
            str_starts_with($hash, '$2b$')
            || password_needs_rehash($compatibleHash, PASSWORD_DEFAULT)
        )) {
            $statement = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $statement->execute([
                password_hash($plainText, PASSWORD_DEFAULT),
                (int) $user['id'],
            ]);
        }
        return $valid;
    }

    public function consumePasswordCheck(string $plainText): bool
    {
        password_verify(mb_substr($plainText, 0, 128), self::DUMMY_PASSWORD_HASH);
        return false;
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

    private function storeVerificationToken(
        int $userId,
        string $email,
        string $tokenHash,
        string $expiresAt,
    ): void {
        $statement = $this->db->prepare(
            'INSERT INTO email_verification_tokens
                (user_id, token_hash, email_at_issue, expires_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                token_hash = VALUES(token_hash),
                email_at_issue = VALUES(email_at_issue),
                expires_at = VALUES(expires_at),
                created_at = UTC_TIMESTAMP(3)'
        );
        $statement->bindValue(1, $userId, PDO::PARAM_INT);
        $statement->bindValue(2, $tokenHash, PDO::PARAM_LOB);
        $statement->bindValue(3, mb_strtolower(trim($email)));
        $statement->bindValue(4, $expiresAt);
        $statement->execute();
    }

    private function markEmailVerifiedInTransaction(int $userId): void
    {
        $statement = $this->db->prepare(
            'UPDATE users
             SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3))
             WHERE id = ?'
        );
        $statement->execute([$userId]);
        $delete = $this->db->prepare(
            'DELETE FROM email_verification_tokens WHERE user_id = ?'
        );
        $delete->execute([$userId]);
    }
}
