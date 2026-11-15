<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class AdminRepository
{
    private ?array $settingsCache = null;
    public function __construct(private readonly PDO $db)
    {
    }

    public function setBootstrapAccess(bool $enabled, int $adminId): void
    {
        $this->db->beginTransaction();
        try {
            // Lock the shared account while checking the registered replacement.
            $this->db->query('SELECT id FROM admins ORDER BY id FOR UPDATE')->fetchAll();
            if (!$enabled && (int) $this->db->query("SELECT COUNT(*) FROM admins WHERE is_bootstrap = 0 AND status = 'active' AND role = 'super_admin' AND must_change_password = 0")->fetchColumn() < 1) {
                throw new \DomainException('Create a personal super admin and complete its password setup before disabling temporary access.');
            }
            $statement = $this->db->prepare("INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES ('bootstrap_admin_enabled', ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)");
            $statement->execute([$enabled ? '1' : '0', $adminId]);
            $this->db->commit();
            $this->settingsCache = null;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM admins WHERE email = ? LIMIT 1');
        $statement->execute([mb_strtolower(trim($email))]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        $statement = $this->db->prepare(
            'SELECT id, first_name, last_name, email, role, status, must_change_password, is_bootstrap,
                    last_login_at, created_at FROM admins WHERE id = ? LIMIT 1'
        );
        $statement->execute([$id]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $admin */
    public function verifyPassword(string $password, array $admin): bool
    {
        return strlen($password) <= 128
            && password_verify($password, (string) ($admin['password_hash'] ?? ''));
    }

    public function recordLogin(int $id): void
    {
        $statement = $this->db->prepare('UPDATE admins SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?');
        $statement->execute([$id]);
    }

    /** @return array<string, mixed> */
    public function metrics(): array
    {
        $counts = $this->db->query(
            "SELECT COUNT(*) AS total_users,
                    SUM(account_status = 'active') AS active_users,
                    SUM(email_verified_at IS NOT NULL) AS verified_users,
                    SUM(created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR) AS new_today
             FROM users"
        )->fetch() ?: [];
        $ai = $this->db->query(
            'SELECT COALESCE(SUM(request_count), 0) AS used_tokens FROM ai_usage_windows WHERE '.($this->settings()['aiRenewable']?'':'1=1 OR ').'window_started_at > UNIX_TIMESTAMP() - ' . ((int)$this->settings()['aiRenewalHours'] * 3600)
        )->fetch() ?: [];
        $sessions = $this->db->query(
            'SELECT COUNT(*) FROM account_sessions
             WHERE revoked_at IS NULL AND last_seen_at >= UTC_TIMESTAMP() - INTERVAL 15 MINUTE'
        )->fetchColumn();
        $series = $this->db->query(
            'SELECT DATE(created_at) AS day, COUNT(*) AS registrations
             FROM users WHERE created_at >= UTC_DATE() - INTERVAL 13 DAY
             GROUP BY DATE(created_at) ORDER BY day'
        )->fetchAll() ?: [];
        return [
            'totalUsers' => (int) ($counts['total_users'] ?? 0),
            'activeUsers' => (int) ($counts['active_users'] ?? 0),
            'verifiedUsers' => (int) ($counts['verified_users'] ?? 0),
            'newToday' => (int) ($counts['new_today'] ?? 0),
            'activeSessions' => (int) $sessions,
            'aiTokensUsed' => (int) ($ai['used_tokens'] ?? 0),
            'registrations' => $series,
            'openTickets' => (int)$this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status NOT IN ('resolved','closed')")->fetchColumn(),
            'pendingEmails' => (int)$this->db->query("SELECT COUNT(*) FROM email_outbox WHERE status='pending'")->fetchColumn(),
            'landingViewsToday' => (int)$this->db->query('SELECT page_views FROM landing_daily WHERE day=UTC_DATE()')->fetchColumn(),
        ];
    }

    /** @return array{items:list<array<string,mixed>>,total:int} */
    public function users(string $search, int $page, int $limit): array
    {
        $offset = ($page - 1) * $limit;
        $where = '';
        $params = [];
        if ($search !== '') {
            $where = ' WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ?';
            $term = '%' . $search . '%';
            $params = [$term, $term, $term];
        }
        $count = $this->db->prepare('SELECT COUNT(*) FROM users' . $where);
        $count->execute($params);
        $statement = $this->db->prepare(
            "SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.account_status,
                    u.email_verified_at, u.ai_token_limit, u.created_at,
                    CASE WHEN " . ($this->settings()['aiRenewable']?'':'1=1 OR ') . "w.window_started_at > UNIX_TIMESTAMP() - " . ((int)$this->settings()['aiRenewalHours'] * 3600) . " THEN COALESCE(w.request_count, 0) ELSE 0 END AS ai_used,
                    EXISTS(SELECT 1 FROM user_identities i WHERE i.user_id = u.id AND i.provider = 'google') AS google_linked
             FROM users u LEFT JOIN ai_usage_windows w ON w.user_id = u.id" . $where .
            ' ORDER BY u.created_at DESC LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset
        );
        $statement->execute($params);
        $items=$statement->fetchAll() ?: [];
        foreach($items as &$item)$item['version']=self::userVersion($item);unset($item);
        return ['items' => $items, 'total' => (int) $count->fetchColumn()];
    }

    /** @param array<string, mixed> $data */
    public function updateUser(int $userId, array $data, string $version): bool
    {
        $this->db->beginTransaction();
        try {
        $lock=$this->db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$lock->execute([$userId]);
        $current=$this->userById($userId);
        if(!$current)throw new \OutOfBoundsException('User not found.');
        if(!hash_equals($current['version'],$version))throw new ConcurrentUpdate('This account changed in another session. Close the panel and refresh the account before saving.');
        $statement = $this->db->prepare(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, account_status = ?, ai_token_limit = ? WHERE id = ?'
        );
        $statement->execute([
            $data['firstName'], $data['lastName'], $data['phone'], $data['status'],
            $data['aiTokenLimit'], $userId,
        ]);
        $changed=$statement->rowCount()>0;$this->db->commit();return $changed;
        }catch(\Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }

    public function resetUserQuota(int $userId): void
    {
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare('DELETE FROM ai_usage_reservations WHERE user_id = ?');
            $statement->execute([$userId]);
            $statement = $this->db->prepare('DELETE FROM ai_usage_windows WHERE user_id = ?');
            $statement->execute([$userId]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** @return array<string, mixed> */
    public function settings(): array
    {
        if ($this->settingsCache !== null) return $this->settingsCache;
        $rows = $this->db->query('SELECT setting_key, setting_value FROM app_settings')->fetchAll() ?: [];
        $values = [];
        foreach ($rows as $row) $values[(string) $row['setting_key']] = (string) $row['setting_value'];
        return $this->settingsCache = [
            'aiEnabled' => ($values['ai_enabled'] ?? '1') === '1',
            'aiDefaultLimit' => (int) ($values['ai_default_limit'] ?? 10),
            'aiRenewalHours' => (int) ($values['ai_renewal_hours'] ?? 24),
            'aiRenewable' => ($values['ai_renewable'] ?? '1') === '1',
            'aiCosts' => array_combine(AiQuotaService::OPERATIONS, array_map(fn($op) => max(0, min(1000, (int) ($values['ai_cost_' . $op] ?? 1))), AiQuotaService::OPERATIONS)),
            'bootstrapAdminEnabled' => ($values['bootstrap_admin_enabled'] ?? '0') === '1',
            'appName' => $values['app_name'] ?? 'ReGen',
            'supportEmail' => $values['support_email'] ?? '',
            'registrationEnabled' => ($values['registration_enabled'] ?? '1') === '1',
            'googleLoginEnabled' => ($values['google_login_enabled'] ?? '1') === '1',
            'maintenanceMode' => ($values['maintenance_mode'] ?? '0') === '1',
            'maintenanceMessage' => $values['maintenance_message'] ?? 'ReGen is undergoing scheduled maintenance.',
            'userSelfDeleteEnabled' => ($values['user_self_delete_enabled'] ?? '1') === '1',
            'profileEmailChangeEnabled' => ($values['profile_email_change_enabled'] ?? '1') === '1',
            'maxActiveSessions' => (int) ($values['max_active_sessions'] ?? 5),
            'auditRetentionDays' => (int) ($values['audit_retention_days'] ?? 180),
        ];
    }

    /** @param array<string, mixed> $settings */
    public function updateSettings(array $settings, int $adminId): void
    {
        $this->settingsCache = null;
        $statement = $this->db->prepare(
            'INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)'
        );
        $this->db->beginTransaction();
        try {
        foreach ([
            'ai_enabled' => $settings['aiEnabled'] ? '1' : '0',
            'ai_default_limit' => (string) $settings['aiDefaultLimit'],
            'ai_renewal_hours' => (string) $settings['aiRenewalHours'],
            'ai_renewable' => ($settings['aiRenewable'] ?? $this->settings()['aiRenewable']) ? '1' : '0',
        ] as $key => $value) $statement->execute([$key, $value, $adminId]);
        foreach (AiQuotaService::OPERATIONS as $operation) $statement->execute(['ai_cost_' . $operation, (string) $settings['aiCosts'][$operation], $adminId]);
        $this->db->commit();
        $this->settingsCache=null;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** @param array<string, mixed> $settings */
    public function updateSystemSettings(array $settings, int $adminId): void
    {
        $this->settingsCache = null;
        $statement = $this->db->prepare(
            'INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)'
        );
        $values = [
            'app_name' => (string) $settings['appName'],
            'support_email' => (string) $settings['supportEmail'],
            'registration_enabled' => $settings['registrationEnabled'] ? '1' : '0',
            'google_login_enabled' => $settings['googleLoginEnabled'] ? '1' : '0',
            'user_self_delete_enabled' => $settings['userSelfDeleteEnabled'] ? '1' : '0',
            'profile_email_change_enabled' => $settings['profileEmailChangeEnabled'] ? '1' : '0',
            'max_active_sessions' => (string) $settings['maxActiveSessions'],
            'audit_retention_days' => (string) $settings['auditRetentionDays'],
        ];
        $this->db->beginTransaction();
        try {
            foreach ($values as $key => $value) $statement->execute([$key, $value, $adminId]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** @return array<string,mixed>|null */
    public function userById(int $userId): ?array
    {
        $statement = $this->db->prepare(
            'SELECT id, first_name, last_name, email, phone, account_status, ai_token_limit,
                    email_verified_at, created_at FROM users WHERE id = ? LIMIT 1'
        );
        $statement->execute([$userId]);
        $row = $statement->fetch();
        if(!is_array($row))return null;$row['version']=self::userVersion($row);return $row;
    }

    private static function userVersion(array $row): string
    {
        $fields=[];foreach(['id','first_name','last_name','email','phone','account_status','ai_token_limit'] as $key)$fields[$key]=$row[$key]===null?null:(string)$row[$key];
        return hash('sha256',json_encode($fields,JSON_THROW_ON_ERROR));
    }

    /** @return array<string,mixed>|null */
    public function adminById(int $adminId): ?array
    {
        return $this->findById($adminId);
    }

    public function activeSuperAdminCount(): int
    {
        return (int) $this->db->query(
            "SELECT COUNT(*) FROM admins WHERE role = 'super_admin' AND status = 'active' AND (is_bootstrap = 0 OR EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'bootstrap_admin_enabled' AND setting_value = '1'))"
        )->fetchColumn();
    }

    /** @return list<array<string,mixed>> */
    public function admins(): array
    {
        return $this->db->query(
            'SELECT id, first_name, last_name, email, role, status, must_change_password, is_bootstrap,
                    last_login_at, created_at FROM admins ORDER BY created_at'
        )->fetchAll() ?: [];
    }

    /** @param array<string, string> $data */
    public function createAdmin(array $data): int
    {
        $statement = $this->db->prepare(
            'INSERT INTO admins (first_name, last_name, email, password_hash, role, status, must_change_password)
             VALUES (?, ?, ?, ?, ?, ?, 1)'
        );
        $statement->execute([
            $data['firstName'], $data['lastName'], mb_strtolower($data['email']),
            password_hash($data['password'], PASSWORD_DEFAULT), $data['role'], 'active',
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function updateAdminStatus(int $id, string $status): bool
    {
        $this->db->beginTransaction();
        try {
            $rows=$this->db->query('SELECT id,role,status,is_bootstrap FROM admins ORDER BY id FOR UPDATE')->fetchAll();
            $target=null;foreach($rows as $row)if((int)$row['id']===$id)$target=$row;
            if(!$target){$this->db->commit();return false;}
            if($status==='disabled' && $target['role']==='super_admin' && $this->activeSuperAdminCount()<=1)throw new \DomainException('The last active super administrator cannot be disabled.');
            $statement = $this->db->prepare('UPDATE admins SET status = ? WHERE id = ?');
            $statement->execute([$status, $id]);$changed=$statement->rowCount()>0;
            $this->db->commit();return $changed;
        }catch(\Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }

    public function changeOwnPassword(int $id, string $password): void
    {
        $statement = $this->db->prepare(
            'UPDATE admins SET password_hash = ?, must_change_password = 0 WHERE id = ?'
        );
        $statement->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
    }

    /** @return list<array<string,mixed>> */
    public function auditLogs(int $limit = 100): array
    {
        $statement = $this->db->query(
            'SELECT id, actor_type, actor_id, event_type, target_type, target_id, metadata, created_at
             FROM audit_logs ORDER BY id DESC LIMIT ' . max(1, min(250, $limit))
        );
        return $statement->fetchAll() ?: [];
    }

    public function purgeExpiredAuditLogs(int $retentionDays): int
    {
        $days = max(30, min(730, $retentionDays));
        $statement = $this->db->prepare(
            'DELETE FROM audit_logs WHERE created_at < UTC_TIMESTAMP() - INTERVAL ' . $days . ' DAY LIMIT 5000'
        );
        $statement->execute();
        return $statement->rowCount();
    }
}
