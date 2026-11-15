<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class AdminAlertService
{
    private const CATEGORIES = ['security', 'support', 'feedback', 'operations'];

    public function __construct(private readonly PDO $db) {}

    public function preferences(int $adminId): array
    {
        $query = $this->db->prepare('SELECT email_enabled,in_app_enabled,browser_enabled,security_alerts,support_alerts,feedback_alerts,operations_alerts FROM admin_notification_preferences WHERE admin_id=?');
        $query->execute([$adminId]);
        return array_map(static fn($value): bool => (bool)$value, $query->fetch() ?: [
            'email_enabled'=>0, 'in_app_enabled'=>0, 'browser_enabled'=>0,
            'security_alerts'=>1, 'support_alerts'=>1, 'feedback_alerts'=>1, 'operations_alerts'=>1,
        ]);
    }

    public function savePreferences(int $adminId, array $body): void
    {
        $keys = array_keys($this->preferences($adminId));
        $values = [];
        foreach ($keys as $key) {
            if (!is_bool($body[$key] ?? null)) throw new \DomainException('Choose each notification preference.');
            $values[] = (int)$body[$key];
        }
        $this->db->prepare('INSERT INTO admin_notification_preferences (admin_id,email_enabled,in_app_enabled,browser_enabled,security_alerts,support_alerts,feedback_alerts,operations_alerts) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE email_enabled=VALUES(email_enabled),in_app_enabled=VALUES(in_app_enabled),browser_enabled=VALUES(browser_enabled),security_alerts=VALUES(security_alerts),support_alerts=VALUES(support_alerts),feedback_alerts=VALUES(feedback_alerts),operations_alerts=VALUES(operations_alerts),updated_at=UTC_TIMESTAMP()')
            ->execute([$adminId, ...$values]);
        (new AuditLogger($this->db))->log('admin.notification_preferences_updated', 'admin', $adminId, $body, 'admin', $adminId);
    }

    public function publish(string $module, string $title, string $body, string $key): void
    {
        $access = new AdminAccess($this->db);
        foreach ((new AdminRepository($this->db))->admins() as $admin) {
            if ($admin['status'] !== 'active' || !in_array($module, $access->permissions($admin), true)) continue;
            if ((bool)$admin['is_bootstrap'] && !(new AdminRepository($this->db))->settings()['bootstrapAdminEnabled']) continue;
            $prefs = $this->preferences((int)$admin['id']);
            $category = in_array($module, self::CATEGORIES, true) ? $module : 'operations';
            $email = $prefs['email_enabled'] && $prefs[$category.'_alerts'] ? 'pending' : 'none';
            $this->db->prepare('INSERT IGNORE INTO admin_notifications (admin_id,module,title,body,dedupe_key,email_status) VALUES (?,?,?,?,?,?)')
                ->execute([$admin['id'], $module, mb_substr($title,0,180), mb_substr($body,0,5000), mb_substr($key,0,100).':'.$admin['id'], $email]);
            (new RealtimeEvents($this->db))->publish('alerts','admin',(int)$admin['id']);
        }
    }

    public function inbox(array $admin,int $page=1): array
    {
        $modules = (new AdminAccess($this->db))->permissions($admin);
        $modules = array_values(array_intersect($modules, [...self::CATEGORIES, 'notifications']));
        if (!$modules) return ['items'=>[], 'unread'=>0, 'total'=>0,'page'=>1,'pageSize'=>20,'preferences'=>$this->preferences((int)$admin['id'])];
        $placeholders = implode(',', array_fill(0,count($modules),'?'));
        $params = [(int)$admin['id'], ...$modules];
        $page=max(1,$page);
        $query = $this->db->prepare('SELECT id,module,title,body,read_at,created_at FROM admin_notifications WHERE admin_id=? AND removed_at IS NULL AND module IN ('.$placeholders.') ORDER BY id DESC LIMIT 20 OFFSET '.min(100000,($page-1)*20));
        $query->execute($params);
        $count = $this->db->prepare('SELECT COUNT(*) FROM admin_notifications WHERE admin_id=? AND removed_at IS NULL AND module IN ('.$placeholders.') AND read_at IS NULL');
        $count->execute($params);
        $items=$query->fetchAll();$unread=(int)$count->fetchColumn();
        $count=$this->db->prepare('SELECT COUNT(*) FROM admin_notifications WHERE admin_id=? AND removed_at IS NULL AND module IN ('.$placeholders.')');$count->execute($params);
        return ['items'=>$items,'unread'=>$unread,'total'=>(int)$count->fetchColumn(),'page'=>$page,'pageSize'=>20,'preferences'=>$this->preferences((int)$admin['id'])];
    }

    public function read(int $adminId,?int $id=null): void
    {
        $this->db->prepare('UPDATE admin_notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE admin_id=? AND removed_at IS NULL'.($id!==null?' AND id=?':''))->execute($id!==null?[$adminId,$id]:[$adminId]);
        (new RealtimeEvents($this->db))->publish('alerts','admin',$adminId);
    }
    public function remove(int $adminId,int $id): void
    {
        $query=$this->db->prepare('UPDATE admin_notifications SET removed_at=UTC_TIMESTAMP() WHERE admin_id=? AND id=? AND removed_at IS NULL');
        $query->execute([$adminId,$id]);
        if($query->rowCount())(new RealtimeEvents($this->db))->publish('alerts','admin',$adminId);
    }

    public function incident(string $key, string $severity, string $title, string $details, string $module = 'security'): void
    {
        $query = $this->db->prepare('INSERT IGNORE INTO security_incidents (incident_key,severity,title,details) VALUES (?,?,?,?)');
        $query->execute([$key, $severity, $title, mb_substr($details,0,1000)]);
        if ($query->rowCount()) $this->publish($module, $title, $details, 'incident:'.$key);
    }

    public function detect(): void
    {
        $query=$this->db->prepare("INSERT IGNORE INTO operations_settings (setting_key,payload) VALUES ('alert_scan',?)");$query->execute(['{}']);
        $first=$query->rowCount()>0;
        if (!$first) {
            $query=$this->db->query("UPDATE operations_settings SET updated_at=UTC_TIMESTAMP() WHERE setting_key='alert_scan' AND updated_at<UTC_TIMESTAMP()-INTERVAL 1 MINUTE");
            if (!$query->rowCount()) return;
        }
        $query = $this->db->query("SELECT ip_hash,COUNT(*) AS failures FROM audit_logs WHERE event_type IN ('auth.login_failed','admin.login_failed') AND created_at>UTC_TIMESTAMP()-INTERVAL 15 MINUTE GROUP BY ip_hash HAVING COUNT(*)>=5 LIMIT 50");
        foreach ($query->fetchAll() as $row) {
            $this->incident('login:'.substr($row['ip_hash'],0,32).':'.intdiv(time(),900), 'high', 'Repeated sign-in failures',
                (int)$row['failures'].' sign-in failures were recorded for network '.substr($row['ip_hash'],0,12).' in the last 15 minutes. Review Security monitor before applying a restriction.');
        }
        $failures = (int)$this->db->query("SELECT COUNT(*) FROM email_outbox WHERE status IN ('failed','uncertain')")->fetchColumn();
        if ($failures > 0) $this->incident('mail:'.gmdate('Y-m-d-H'), 'medium', 'Email delivery needs attention', $failures.' notification emails need investigation. Review the delivery queue. Uncertain deliveries must be checked before resending.', 'notifications');
        $pending = (int)$this->db->query("SELECT COUNT(*) FROM email_outbox WHERE status='pending' AND created_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE")->fetchColumn();
        $worker = $this->db->query("SELECT updated_at FROM operations_settings WHERE setting_key='mail_worker'")->fetchColumn();
        if ($pending && (!$worker || strtotime($worker.' UTC') < time()-900)) $this->incident('worker:'.gmdate('Y-m-d-H'), 'high', 'Notification processing is delayed', 'Messages have waited for more than 15 minutes without a recent completed worker run. Check the scheduled job in your hosting panel.', 'operations');
        $free = disk_free_space(Storage::directory('cache'));
        if ($free !== false && $free < 512*1024*1024) $this->incident('storage:'.gmdate('Y-m-d'), 'high', 'Application storage is running low', 'Less than 512 MB is available on the application filesystem. Review backups and hosting capacity.', 'operations');
        $fallback=dirname(__DIR__,2).'/storage/audit/fallback.ndjson';
        if (is_file($fallback) && filesize($fallback)>0) $this->incident('audit-fallback:'.gmdate('Y-m-d'),'high','Audit fallback records need review','Some audit records were written to protected fallback storage. Check database availability and preserve the fallback file for investigation.','operations');
    }

    public function work(EmailVerificationService $mailer): void
    {
        $this->detect();
        $this->db->exec("UPDATE admin_notifications SET email_status='uncertain' WHERE email_status='sending' AND available_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE");
        if (!$mailer->configured()) return;
        $rows = $this->db->query("SELECT n.*,a.email,a.role,a.status,a.is_bootstrap FROM admin_notifications n JOIN admins a ON a.id=n.admin_id WHERE n.email_status='pending' AND n.available_at<=UTC_TIMESTAMP() ORDER BY n.id LIMIT 10")->fetchAll();
        foreach ($rows as $row) {
            $prefs = $this->preferences((int)$row['admin_id']);
            $admin = (new AdminRepository($this->db))->findById((int)$row['admin_id']);
            $category = in_array($row['module'],self::CATEGORIES,true) ? $row['module'] : 'operations';
            $allowed = $admin && $admin['status']==='active' && in_array($row['module'],(new AdminAccess($this->db))->permissions($admin),true)
                && (!(bool)$admin['is_bootstrap'] || (new AdminRepository($this->db))->settings()['bootstrapAdminEnabled']) && $prefs['email_enabled'] && $prefs[$category.'_alerts'];
            if (!$allowed) { $this->db->prepare("UPDATE admin_notifications SET email_status='skipped' WHERE id=?")->execute([$row['id']]); continue; }
            $this->db->prepare("UPDATE admin_notifications SET email_status='sending',attempts=attempts+1,available_at=UTC_TIMESTAMP() WHERE id=?")->execute([$row['id']]);
            $permanent=false;
            try { $ok = $mailer->sendNotification($row['email'],$row['title'],$row['body'],'/admin'); }
            catch (MailDeliveryUncertain) { $this->db->prepare("UPDATE admin_notifications SET email_status='uncertain' WHERE id=?")->execute([$row['id']]); continue; }
            catch (MailDeliveryRejected) { $ok=false;$permanent=true; }
            (new EmailDeliveryRepository($this->db))->record('admin_alert',$row['email'],(string)Config::get('mail.transport','smtp'),$ok);
            $state = $ok ? 'accepted' : ($permanent||(int)$row['attempts']>=4 ? 'failed' : 'pending');
            $delay=MailRetryPolicy::delaySeconds((int)$row['attempts']+1,(int)$row['id']);
            $this->db->prepare('UPDATE admin_notifications SET email_status=?,available_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL '.$delay.' SECOND) WHERE id=?')->execute([$state,$row['id']]);
        }
    }
}
