<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class AccountRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return array<string, mixed> */
    public function profile(int $userId): array
    {
        $statement = $this->db->prepare(
            "SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.address,
                    u.email_verified_at, u.account_status, u.ai_token_limit, u.created_at,
                    EXISTS(SELECT 1 FROM user_identities i WHERE i.user_id = u.id AND i.provider = 'google') AS google_linked,
                    (u.password_hash IS NOT NULL AND u.password_hash <> '') AS has_password
             FROM users u WHERE u.id = ? LIMIT 1"
        );
        $statement->execute([$userId]);
        $row = $statement->fetch();
        return is_array($row) ? $row : [];
    }

    /** @param array<string, string> $data */
    public function updateProfile(int $userId, array $data): void
    {
        $statement = $this->db->prepare(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ? WHERE id = ?'
        );
        $statement->execute([
            trim($data['firstName']), trim($data['lastName']),
            trim($data['phone']), trim($data['address']), $userId,
        ]);
    }

    public function changePassword(int $userId, string $password): void
    {
        $statement = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $statement->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
    }

    public function trackSession(int $userId, int $maxActiveSessions = 5): void
    {
        $sessionHash = hash('sha256', session_id());
        [$device, $browser] = $this->deviceLabels((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        $statement = $this->db->prepare(
            'INSERT INTO account_sessions
                (user_id, session_hash, device_label, browser_label, ip_hash, last_seen_at, revoked_at)
             VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3), NULL)
             ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id), device_label = VALUES(device_label),
                browser_label = VALUES(browser_label), ip_hash = VALUES(ip_hash),
                last_seen_at = UTC_TIMESTAMP(3)'
        );
        $statement->execute([
            $userId, $sessionHash, $device, $browser,
            hash('sha256', RateLimiter::clientIdentity()),
        ]);
        $limit = max(1, min(20, $maxActiveSessions));
        $revoke = $this->db->prepare(
            'UPDATE account_sessions SET revoked_at = UTC_TIMESTAMP(3)
             WHERE user_id = ? AND revoked_at IS NULL AND session_hash <> ?
               AND id NOT IN (
                 SELECT id FROM (
                   SELECT id FROM account_sessions
                   WHERE user_id = ? AND revoked_at IS NULL
                   ORDER BY last_seen_at DESC LIMIT ' . $limit . '
                 ) AS newest_sessions
               )'
        );
        $revoke->execute([$userId, $sessionHash, $userId]);
    }

    public function currentSessionActive(int $userId, int $maxActiveSessions = 5): bool
    {
        $statement = $this->db->prepare(
            'SELECT revoked_at, last_seen_at FROM account_sessions WHERE user_id = ? AND session_hash = ? LIMIT 1'
        );
        $statement->execute([$userId, hash('sha256', session_id())]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            $this->trackSession($userId, $maxActiveSessions);
            return true;
        }
        if ($row['revoked_at'] !== null) {
            return false;
        }
        // REVOCATION IS CHECKED EVERY REQUEST; HEARTBEATS WRITE ONCE PER MINUTE.
        if (strtotime((string) $row['last_seen_at'] . ' UTC') <= time() - 60) {
            $this->trackSession($userId, $maxActiveSessions);
        }
        return true;
    }

    /** @return array<string, mixed> */
    public function sessionPage(int $userId, int $page = 1): array
    {
        $counts = $this->db->prepare(
            'SELECT COUNT(*) AS total,
                    COALESCE(SUM(revoked_at IS NULL AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY), 0) AS active
             FROM account_sessions WHERE user_id = ? AND history_hidden_at IS NULL'
        );
        $counts->execute([$userId]);
        $totals = $counts->fetch();
        $total = (int) $totals['total'];
        $active = (int) $totals['active'];
        $perPage = 5;
        $pages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($pages, $page));
        $current = hash('sha256', session_id());
        $statement = $this->db->prepare(
            'SELECT id, device_label, browser_label, last_seen_at, created_at, revoked_at, session_hash
             FROM account_sessions WHERE user_id = ? AND history_hidden_at IS NULL
             ORDER BY (session_hash = ?) DESC, (revoked_at IS NULL) DESC, last_seen_at DESC, id DESC
             LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage)
        );
        $statement->execute([$userId, $current]);
        $sessions = array_map(static function (array $row) use ($current): array {
            $row['current'] = hash_equals((string) $row['session_hash'], $current);
            $row['state'] = $row['revoked_at'] !== null ? 'signed_out'
                : (strtotime((string) $row['created_at'] . ' UTC') < time() - Session::USER_TTL ? 'expired' : 'active');
            unset($row['session_hash']);
            return $row;
        }, $statement->fetchAll() ?: []);
        return ['sessions' => $sessions, 'pagination' => compact('page', 'perPage', 'total', 'pages'),
            'activeSessionCount' => $active, 'historyCount' => max(0, $total - $active)];
    }

    public function isCurrentSession(int $userId, int $sessionId): bool
    {
        $statement = $this->db->prepare('SELECT session_hash FROM account_sessions WHERE user_id = ? AND id = ?');
        $statement->execute([$userId, $sessionId]);
        return hash_equals(hash('sha256', session_id()), (string) $statement->fetchColumn());
    }

    public function clearSessionHistory(int $userId): int
    {
        // KEEP REVOCATION TOMBSTONES: DELETING THEM WOULD LET A REVOKED COOKIE RE-ENROL.
        $statement = $this->db->prepare(
            'UPDATE account_sessions SET history_hidden_at = UTC_TIMESTAMP(3)
             WHERE user_id = ? AND history_hidden_at IS NULL AND session_hash <> ?
               AND (revoked_at IS NOT NULL OR created_at < UTC_TIMESTAMP(3) - INTERVAL 30 DAY)'
        );
        $statement->execute([$userId, hash('sha256', session_id())]);
        return $statement->rowCount();
    }

    public function rotateSession(int $userId, string $previousHash, string $nextHash): void
    {
        // CARRY REVOCATION AND THE ORIGINAL DEVICE RECORD ACROSS ID ROTATION.
        $statement = $this->db->prepare('UPDATE account_sessions SET session_hash = ? WHERE user_id = ? AND session_hash = ?');
        $statement->execute([$nextHash, $userId, $previousHash]);
    }

    public function revokeSession(int $userId, int $sessionId): bool
    {
        $statement = $this->db->prepare(
            'UPDATE account_sessions SET revoked_at = UTC_TIMESTAMP(3)
             WHERE id = ? AND user_id = ? AND revoked_at IS NULL'
        );
        $statement->execute([$sessionId, $userId]);
        return $statement->rowCount() === 1;
    }

    public function revokeCurrentSession(int $userId): void
    {
        $statement = $this->db->prepare(
            'UPDATE account_sessions SET revoked_at = UTC_TIMESTAMP(3)
             WHERE user_id = ? AND session_hash = ? AND revoked_at IS NULL'
        );
        $statement->execute([$userId, hash('sha256', session_id())]);
    }

    public function revokeAllForUser(int $userId): int
    {
        $statement = $this->db->prepare(
            'UPDATE account_sessions SET revoked_at = UTC_TIMESTAMP(3)
             WHERE user_id = ? AND revoked_at IS NULL'
        );
        $statement->execute([$userId]);
        return $statement->rowCount();
    }

    public function revokeAllUsers(): int
    {
        $statement = $this->db->prepare(
            'UPDATE account_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE revoked_at IS NULL'
        );
        $statement->execute();
        return $statement->rowCount();
    }

    public function documentExport(int $userId): array
    {
        $resumes = $this->db->prepare('SELECT id,title,resume_data,created_at,updated_at FROM resumes WHERE user_id=?');
        $resumes->execute([$userId]);
        $letters = $this->db->prepare('SELECT id,company,role,recipient,recipient_address,letter_date,company_details,job_description,body,created_at,updated_at FROM cover_letters WHERE user_id=?');
        $letters->execute([$userId]);
        return ['resumes' => $resumes->fetchAll(), 'coverLetters' => $letters->fetchAll()];
    }

    public function deleteAccount(int $userId): void
    {
        $statement = $this->db->prepare('DELETE FROM users WHERE id = ?');
        $statement->execute([$userId]);
    }

    /** @return array{0:string,1:string} */
    private function deviceLabels(string $agent): array
    {
        $context=DeviceContext::fromUserAgent($agent);
        return [$context['device'],trim($context['browser'].' '.$context['browserVersion'])];
    }
}
