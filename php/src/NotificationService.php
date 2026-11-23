<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class NotificationService
{
    private const RECEIPT_PREFIX = 'payment_receipt:';
    private const WELCOME_PREFIX = 'welcome:';

    public function __construct(private readonly PDO $db) {}

    public function notify(int $userId, string $category, string $title, string $body, string $link = '/notifications', ?string $dedupe = null, bool $email = true): int
    {
        if (!in_array($category, ['security','account','support','announcement'], true)) throw new \InvalidArgumentException('Invalid notification category.');
        if (!preg_match('#^/(?:dashboard|notifications(?:\?campaign=\d+)?|support(?:\?ticket=\d+)?|payments\?order=RG-[a-f0-9]{32})$#D', $link)) $link = '/notifications';
        $q = $this->db->prepare('INSERT IGNORE INTO user_notifications (user_id, category, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)');
        $q->execute([$userId, $category, mb_substr($title,0,180), mb_substr($body,0,10000), $link, $dedupe]);
        if (!$q->rowCount()) return 0;
        $id = (int)$this->db->lastInsertId();
        (new RealtimeEvents($this->db))->publish('notifications','user',$userId,$id);
        if ($email && $this->emailAllowed($userId, $category)) $this->db->prepare('INSERT INTO email_outbox (user_id, notification_id) VALUES (?, ?)')->execute([$userId, $id]);
        return $id;
    }

    public function paymentReceipt(int $userId, string $reference, string $package, string $currency, int $amount, int $refunded): void
    {
        $format = static fn(int $minor): string => sprintf('%s %d.%02d', $currency, intdiv($minor,100), $minor%100);
        $body = "Your package is ready.\n\nPackage: ".$package."\nPayment: ".$format($amount);
        if ($refunded > 0) $body .= "\nRefunded: ".$format($refunded);
        $body .= "\nOrder reference: ".$reference;
        $this->queueAccountEmail($userId, 'Your ReGen payment receipt', $body, '/payments?order='.$reference, self::RECEIPT_PREFIX.$reference);
    }

    public function welcome(int $userId): void
    {
        $this->queueAccountEmail($userId, 'Welcome to ReGen',
            "Your account is ready. Open your dashboard to start a resume, choose a template, and fill in the sections that matter for your next application.",
            '/dashboard', self::WELCOME_PREFIX.$userId);
    }

    private function queueAccountEmail(int $userId, string $title, string $body, string $link, string $key): void
    {
        $id = $this->notify($userId, 'account', $title, $body, $link, $key, false);
        if ($id > 0) {
            $this->db->prepare('INSERT INTO email_outbox (user_id,notification_id) VALUES (?,?)')->execute([$userId,$id]);
        }
    }

    public function preferences(int $userId): array
    {
        $q = $this->db->prepare('SELECT account_email,support_email,announcement_email,security_email,in_app_enabled,browser_enabled FROM notification_preferences WHERE user_id=? AND consent_updated_at IS NOT NULL'); $q->execute([$userId]);
        $row = $q->fetch() ?: ['account_email'=>0,'support_email'=>0,'announcement_email'=>0,'security_email'=>0,'in_app_enabled'=>0,'browser_enabled'=>0];
        return array_map(static fn($value)=>(bool)$value, $row);
    }
    public function savePreferences(int $userId, array $data): void
    {
        $values=[];
        foreach (['account_email','support_email','announcement_email','security_email','in_app_enabled','browser_enabled'] as $key) {
            if (!is_bool($data[$key] ?? null)) throw new \DomainException('Choose each notification preference.');
            $values[]=(int)$data[$key];
        }
        $this->db->prepare('INSERT INTO notification_preferences (user_id,account_email,support_email,announcement_email,security_email,in_app_enabled,browser_enabled,consent_updated_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE account_email=VALUES(account_email),support_email=VALUES(support_email),announcement_email=VALUES(announcement_email),security_email=VALUES(security_email),in_app_enabled=VALUES(in_app_enabled),browser_enabled=VALUES(browser_enabled),consent_updated_at=UTC_TIMESTAMP()')->execute([$userId,...$values]);
        (new AuditLogger($this->db))->log('profile.notification_preferences_updated','user',$userId,$data,'user',$userId);
        (new RealtimeEvents($this->db))->publish('notifications','user',$userId);
    }
    private function emailAllowed(int $userId, string $category): bool
    {
        $policy = $this->policy();
        return ($policy[$category] ?? true) && ($this->preferences($userId)[$category.'_email'] ?? false);
    }
    public function policy(): array
    {
        $q = $this->db->query("SELECT payload FROM operations_settings WHERE setting_key='notification_policy'");
        return array_replace(['account'=>true,'support'=>true,'announcement'=>true], json_decode((string)($q->fetchColumn() ?: '{}'), true) ?: []);
    }
    public function savePolicy(array $body, int $adminId): void
    {
        $data = [];
        foreach (['account','support','announcement'] as $key) { if (!is_bool($body[$key] ?? null)) throw new \DomainException('Choose all notification channels.'); $data[$key]=$body[$key]; }
        $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('notification_policy',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()")->execute([json_encode($data, JSON_THROW_ON_ERROR),$adminId]);
    }
    public function inbox(int $userId, int $page): array
    {
        $q = $this->db->prepare('SELECT id,category,title,body,link,read_at,created_at FROM user_notifications WHERE user_id=? AND removed_at IS NULL ORDER BY id DESC LIMIT 25 OFFSET '.(max(0,min(10000,$page-1))*25)); $q->execute([$userId]);
        $count = $this->db->prepare('SELECT COUNT(*) AS total, SUM(read_at IS NULL) AS unread FROM user_notifications WHERE user_id=? AND removed_at IS NULL'); $count->execute([$userId]);
        return ['items'=>$q->fetchAll(), 'counts'=>$count->fetch(), 'preferences'=>$this->preferences($userId)];
    }
    public function unread(int $userId): array
    {
        $query=$this->db->prepare('SELECT COUNT(*) AS unread,COALESCE(MAX(id),0) AS latestId FROM user_notifications WHERE user_id=? AND read_at IS NULL AND removed_at IS NULL');
        $query->execute([$userId]);$counts=$query->fetch();
        $query=$this->db->prepare('SELECT id,title,body,category,link FROM user_notifications WHERE user_id=? AND removed_at IS NULL ORDER BY id DESC LIMIT 1');$query->execute([$userId]);
        return ['counts'=>$counts,'latest'=>$query->fetch()?:null,'preferences'=>$this->preferences($userId)];
    }
    public function read(int $userId, ?int $id): void
    {
        $q = $this->db->prepare('UPDATE user_notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE user_id=? AND removed_at IS NULL'.($id === null ? '' : ' AND id=?'));
        $q->execute($id === null ? [$userId] : [$userId,$id]);
        if($q->rowCount())(new RealtimeEvents($this->db))->publish('notifications','user',$userId);
    }
    public function remove(int $userId, ?int $id = null): void
    {
        $query=$this->db->prepare('UPDATE user_notifications SET removed_at=UTC_TIMESTAMP() WHERE user_id=? AND removed_at IS NULL'.($id === null ? '' : ' AND id=?'));
        $query->execute($id === null ? [$userId] : [$userId,$id]);
        if($query->rowCount())(new RealtimeEvents($this->db))->publish('notifications','user',$userId);
    }
    public function campaign(array $data, int $adminId): int
    {
        $title=Sanitizer::cleanText($data['title'] ?? '', false,180); $body=Sanitizer::cleanText($data['body'] ?? '', true,10000);
        if ($title === '' || $body === '' || !in_array($data['audience'] ?? '', ['all','active','verified'],true) || !is_bool($data['sendEmail'] ?? null)) throw new \DomainException('Enter a title, message, audience and email choice.');
        if (($data['confirmation'] ?? '') !== 'SEND NOTIFICATION') throw new \DomainException('Confirm the broadcast before sending.');
        $q=$this->db->prepare('INSERT INTO notification_campaigns (title,body,audience,send_email,max_user_id,created_by) VALUES (?,?,?,?,(SELECT COALESCE(MAX(id),0) FROM users),?)');
        $q->execute([$title,$body,$data['audience'],(int)$data['sendEmail'],$adminId]); return (int)$this->db->lastInsertId();
    }
    public function status(): array
    {
        return ['policy'=>$this->policy(), 'campaigns'=>$this->db->query('SELECT id,title,audience,send_email,status,recipient_count,created_at FROM notification_campaigns ORDER BY id DESC LIMIT 30')->fetchAll(), 'queue'=>$this->db->query('SELECT status,COUNT(*) AS count FROM email_outbox GROUP BY status')->fetchAll(), 'failures'=>$this->db->query("SELECT o.id,o.status,o.attempts,u.email FROM email_outbox o JOIN users u ON u.id=o.user_id WHERE o.status IN ('failed','uncertain') ORDER BY o.id DESC LIMIT 50")->fetchAll(), 'worker'=>$this->db->query("SELECT payload,updated_at FROM operations_settings WHERE setting_key='mail_worker'")->fetch() ?: null];
    }

    // ONE WORKER OWNS EXPANSION AND DELIVERY. SMTP IS NEVER CALLED IN USER REQUESTS.
    public function work(EmailVerificationService $mailer, int $limit=25): array
    {
        $lockName='regen-notification-worker:'.substr(hash('sha256',(string)$this->db->query('SELECT DATABASE()')->fetchColumn()),0,16);
        $lockQuery=$this->db->prepare('SELECT GET_LOCK(?,0)');$lockQuery->execute([$lockName]);$lock=$lockQuery->fetchColumn();
        if ((int)$lock !== 1) return ['busy'=>true];
        $result=['expanded'=>0,'accepted'=>0,'failed'=>0];
        try {
            $campaign=$this->db->query("SELECT * FROM notification_campaigns WHERE status='queued' ORDER BY id LIMIT 1")->fetch();
            if ($campaign) {
                $filter=match($campaign['audience']) { 'active'=>" AND account_status='active'", 'verified'=>' AND email_verified_at IS NOT NULL', default=>'' };
                $q=$this->db->prepare('SELECT id FROM users WHERE id>? AND id<=?'.$filter.' ORDER BY id LIMIT 100'); $q->execute([$campaign['last_user_id'],$campaign['max_user_id']]); $ids=$q->fetchAll(PDO::FETCH_COLUMN);
                $this->db->beginTransaction();
                try {
                    foreach ($ids as $id) { $this->notify((int)$id,'announcement',$campaign['title'],$campaign['body'],'/notifications','campaign:'.$campaign['id'].':'.$id,(bool)$campaign['send_email']); $result['expanded']++; }
                    $this->db->prepare('UPDATE notification_campaigns SET last_user_id=?,recipient_count=recipient_count+?,status=? WHERE id=?')->execute([$ids ? max($ids) : $campaign['max_user_id'],count($ids),count($ids)<100 ? 'completed':'queued',$campaign['id']]);
                    $this->db->commit();
                } catch (\Throwable $e) { if($this->db->inTransaction())$this->db->rollBack(); throw $e; }
            }
            // STALE IN-FLIGHT MAIL IS UNCERTAIN; DO NOT AUTOMATICALLY SEND A DUPLICATE.
            $this->db->exec("UPDATE email_outbox SET status='uncertain' WHERE status='sending' AND available_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE");
            $rows=$this->db->query("SELECT o.*,n.category,n.title,n.body,n.link,n.dedupe_key,u.email,u.email_verified_at FROM email_outbox o JOIN user_notifications n ON n.id=o.notification_id JOIN users u ON u.id=o.user_id WHERE o.status='pending' AND o.available_at<=UTC_TIMESTAMP() ORDER BY o.id LIMIT ".max(1,min(100,$limit)))->fetchAll();
            foreach ($rows as $row) {
                if (!$mailer->configured()) break;
                $receipt = $row['category'] === 'account' && str_starts_with((string)$row['dedupe_key'], self::RECEIPT_PREFIX)
                    && PaymentOrders::validReference(substr((string)$row['dedupe_key'],strlen(self::RECEIPT_PREFIX)));
                $welcome = $row['category'] === 'account' && $row['dedupe_key'] === self::WELCOME_PREFIX.$row['user_id'];
                if ($row['email_verified_at'] === null || (!$receipt && !$welcome && !$this->emailAllowed((int)$row['user_id'],$row['category']))) {
                    $this->db->prepare("UPDATE email_outbox SET status='skipped' WHERE id=?")->execute([$row['id']]); continue;
                }
                $this->db->prepare("UPDATE email_outbox SET status='sending',attempts=attempts+1,available_at=UTC_TIMESTAMP() WHERE id=?")->execute([$row['id']]);
                $permanent=false;
                $kind = $receipt ? 'payment_receipt' : ($welcome ? 'welcome' : 'notification_'.$row['category']);
                try { $ok=$mailer->sendNotification($row['email'],$row['title'],$row['body'],$row['link'],$receipt,$welcome); }
                catch (MailDeliveryUncertain) {
                    $this->db->prepare("UPDATE email_outbox SET status='uncertain' WHERE id=?")->execute([$row['id']]);
                    $result['failed']++; continue;
                }
                catch (MailDeliveryRejected) { $ok=false;$permanent=true; }
                (new EmailDeliveryRepository($this->db))->record($kind,$row['email'],(string)Config::get('mail.transport','smtp'),$ok);
                $attempt=(int)$row['attempts']+1;
                $delay=MailRetryPolicy::delaySeconds($attempt,(int)$row['id']);
                $this->db->prepare('UPDATE email_outbox SET status=?,accepted_at=?,available_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL '.$delay.' SECOND) WHERE id=?')->execute([$ok?'accepted':($permanent||$attempt>=5?'failed':'pending'),$ok?gmdate('Y-m-d H:i:s'):null,$row['id']]);
                $result[$ok?'accepted':'failed']++;
            }
            $this->db->prepare("INSERT INTO operations_settings (setting_key,payload) VALUES ('mail_worker',?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_at=UTC_TIMESTAMP()")->execute([json_encode($result, JSON_THROW_ON_ERROR)]);
            $days=(int)(new AdminRepository($this->db))->settings()['auditRetentionDays'];
            (new AdminRepository($this->db))->purgeExpiredAuditLogs($days);
            $this->db->exec('DELETE FROM password_reset_tokens WHERE expires_at<UTC_TIMESTAMP() LIMIT 500');
            $this->db->exec('DELETE FROM landing_visitors WHERE day<UTC_DATE()-INTERVAL 30 DAY LIMIT 1000');
            (new RecoveryService($this->db))->purgeExpired();
            (new CampaignService($this->db))->deliverBatch();
            (new AdminAlertService($this->db))->work($mailer);
            return $result;
        } finally { $release=$this->db->prepare('SELECT RELEASE_LOCK(?)');$release->execute([$lockName]); }
    }
}
