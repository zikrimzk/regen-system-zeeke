<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class AdminAccess
{
    public const MODULES = ['overview', 'reports', 'analytics', 'users', 'campaigns', 'templates', 'ai', 'features', 'system', 'email', 'notifications', 'support', 'feedback', 'security', 'operations', 'recovery', 'audit', 'pricing'];
    private const EXPORT_MODULES = ['reports', 'feedback', 'users', 'audit'];
    private const READ_ONLY_MODULES = ['overview', 'reports', 'analytics', 'audit'];

    public function __construct(private readonly PDO $db) {}

    public function permissions(array $admin): array
    {
        if (($admin['role'] ?? '') === 'super_admin') return [...self::MODULES, 'admins'];
        $capabilities = $this->capabilities($admin);
        return array_values(array_filter(self::MODULES, static fn(string $module): bool => in_array($module.'.view', $capabilities, true)));
    }

    public static function catalogue(): array
    {
        $result = [];
        foreach (self::MODULES as $module) {
            $result[] = $module.'.view';
            if (!in_array($module, self::READ_ONLY_MODULES, true)) $result[] = $module.'.manage';
            if (in_array($module, self::EXPORT_MODULES, true)) $result[] = $module.'.export';
        }
        $result[]='templates.resumes';
        $result[]='users.packages';
        return $result;
    }

    public function capabilities(array $admin): array
    {
        if (($admin['role'] ?? '') === 'super_admin') return [...self::catalogue(), 'admins.manage', 'admins.view'];
        $query = $this->db->prepare('SELECT expires_at FROM admin_access_assignments WHERE admin_id = ?');
        $query->execute([(int)$admin['id']]);
        $expiry = $query->fetchColumn();
        if ($expiry && strtotime($expiry.' UTC') <= time()) return [];
        $q = $this->db->prepare('SELECT module FROM admin_permissions WHERE admin_id = ?');
        $q->execute([(int) $admin['id']]);
        return array_values(array_intersect(self::catalogue(), $q->fetchAll(PDO::FETCH_COLUMN)));
    }

    public function allows(array $admin, string $path, string $method): bool
    {
        $required = AdminRoutes::capabilities($path, $method);
        return $required !== null && ($required === [] || array_diff($required, $this->capabilities($admin)) === []);
    }

    public function assignment(int $adminId): array
    {
        $query = $this->db->prepare('SELECT purpose,expires_at,version,assigned_by,updated_at FROM admin_access_assignments WHERE admin_id = ?');
        $query->execute([$adminId]);
        return $query->fetch() ?: ['purpose' => '', 'expires_at' => null, 'version' => 0];
    }

    public function assign(int $adminId, array $data, int $actorId): void
    {
        $capabilities = $data['capabilities'] ?? null;
        $purpose = Sanitizer::cleanText($data['purpose'] ?? '', false, 300);
        if (!is_array($capabilities) || !array_is_list($capabilities) || count(array_filter($capabilities,'is_string')) !== count($capabilities)
            || array_diff($capabilities, self::catalogue()) !== [] || strlen($purpose) < 10) {
            throw new \DomainException('Select valid permissions and explain the administrator’s responsibility in at least 10 characters.');
        }
        foreach ($capabilities as $capability) {
            [$module, $action] = explode('.', $capability);
            if ($action !== 'view' && !in_array($module.'.view', $capabilities, true)) throw new \DomainException('Read access is required before allowing changes or exports.');
        }
        $expiry = null;
        if (!empty($data['expiresAt'])) {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', (string)$data['expiresAt'], new \DateTimeZone('UTC'));
            if (!$date || $date->format('Y-m-d\TH:i:s\Z') !== $data['expiresAt'] || $date->getTimestamp() <= time()) throw new \DomainException('Choose a valid future expiry.');
            $expiry = $date->format('Y-m-d H:i:s');
        }
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare("SELECT id FROM admins WHERE id = ? AND role = 'admin' FOR UPDATE");
            $query->execute([$adminId]);
            if (!$query->fetchColumn()) throw new \DomainException('Assign scoped access to a delegated administrator.');
            $current = $this->assignment($adminId);
            if ((int)$current['version'] !== (int)($data['version'] ?? -1)) throw new ConcurrentUpdate('Access was changed in another session. Reopen this panel before saving.');
            $this->replacePermissions($adminId, array_values(array_intersect($capabilities, self::catalogue())));
            $this->db->prepare('INSERT INTO admin_access_assignments (admin_id,purpose,expires_at,version,assigned_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE purpose=VALUES(purpose),expires_at=VALUES(expires_at),version=VALUES(version),assigned_by=VALUES(assigned_by),updated_at=UTC_TIMESTAMP()')
                ->execute([$adminId, $purpose, $expiry, (int)$current['version']+1, $actorId]);
            (new AuditLogger($this->db))->log('admin.permissions_updated', 'admin', $adminId, ['before' => $current, 'capabilities' => $capabilities, 'purpose' => $purpose, 'expiresAt' => $expiry], 'admin', $actorId);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function save(int $adminId, array $modules): void
    {
        if (array_diff($modules, self::MODULES) !== []) throw new \DomainException('Choose valid administrator modules.');
        $this->db->beginTransaction();
        try {
            $q = $this->db->prepare('SELECT id FROM admins WHERE id = ? AND role = ? FOR UPDATE');
            $q->execute([$adminId, 'admin']);
            if (!$q->fetchColumn()) throw new \DomainException('Permissions apply to delegated administrators only.');
            $capabilities = [];
            foreach ($modules as $module) { $capabilities[] = $module.'.view'; $capabilities[] = $module.'.manage'; }
            $this->replacePermissions($adminId, $capabilities);
            $this->db->commit();
        } catch (\Throwable $e) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $e; }
    }

    private function replacePermissions(int $adminId, array $capabilities): void
    {
        $this->db->prepare('DELETE FROM admin_permissions WHERE admin_id = ?')->execute([$adminId]);
        $query = $this->db->prepare('INSERT INTO admin_permissions (admin_id,module) VALUES (?,?)');
        foreach (array_unique($capabilities) as $capability) $query->execute([$adminId, $capability]);
    }

    public static function moduleForRoute(string $path): ?string
    {
        $required = AdminRoutes::capabilities($path);
        if ($required === null) return 'unassigned';
        return $required === [] ? null : explode('.', $required[0], 2)[0];
    }
}
