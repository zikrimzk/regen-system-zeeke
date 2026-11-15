<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class OperationsMonitor
{
    private static ?PDO $connection=null;
    public function __construct(private readonly PDO $db) { self::$connection=$db; }
    public static function event(string $event): void
    {
        if(!self::$connection)return;
        try {
            // SAMPLE REPEATED REJECTIONS SO HOSTILE TRAFFIC CANNOT FLOOD THE AUDIT TABLE.
            $q=self::$connection->prepare('SELECT id FROM audit_logs WHERE event_type=? AND ip_hash=? AND created_at>UTC_TIMESTAMP()-INTERVAL 1 MINUTE LIMIT 1');
            $q->execute([$event,hash('sha256',RateLimiter::clientIdentity())]);
            if(!$q->fetchColumn())(new AuditLogger(self::$connection))->log($event,'route',Http::path());
        }catch(\Throwable $e){error_log('[Security Telemetry] '.$e::class);}
    }
    public function enforceBlock(): void
    {
        $q=$this->db->prepare('SELECT expires_at FROM security_blocks WHERE identity_hash=? AND expires_at>UTC_TIMESTAMP()'); $q->execute([hash('sha256',RateLimiter::clientIdentity())]);
        if($q->fetchColumn()) { self::event('security.blocked_request'); Http::json(['success'=>false,'message'=>'Access from this network is temporarily restricted. Contact support.'],403); }
    }
    public function security(): array
    {
        $events=$this->db->query("SELECT id,event_type,actor_type,actor_id,ip_hash,user_agent,target_id,created_at FROM audit_logs WHERE (event_type LIKE 'security.%' OR event_type LIKE '%login_failed%') ORDER BY id DESC LIMIT 100")->fetchAll();
        $counts=$this->db->query("SELECT event_type,COUNT(*) AS count FROM audit_logs WHERE created_at>UTC_TIMESTAMP()-INTERVAL 24 HOUR AND (event_type LIKE 'security.%' OR event_type LIKE '%login_failed%') GROUP BY event_type ORDER BY count DESC")->fetchAll();
        return ['events'=>$events,'counts'=>$counts,'blocks'=>$this->db->query('SELECT identity_hash,label,reason,expires_at,created_at FROM security_blocks WHERE expires_at>UTC_TIMESTAMP() ORDER BY created_at DESC LIMIT 100')->fetchAll(),'incidents'=>$this->db->query('SELECT id,severity,title,details,status,resolution_note,created_at,updated_at FROM security_incidents ORDER BY id DESC LIMIT 50')->fetchAll()];
    }
    public function block(array $body,int $adminId): void
    {
        $hash=(string)($body['identityHash']??'');
        if(!preg_match('/^[a-f0-9]{64}$/D',$hash))throw new \DomainException('Select a recorded network identity.');
        if(hash_equals($hash,hash('sha256',RateLimiter::clientIdentity())))throw new \DomainException('You cannot block your current network.');
        $q=$this->db->prepare("SELECT id FROM audit_logs WHERE ip_hash=? AND (event_type LIKE 'security.%' OR event_type LIKE '%login_failed%') LIMIT 1"); $q->execute([$hash]);
        if(!$q->fetchColumn())throw new \DomainException('Network identity must come from a security event.');
        $reason=Sanitizer::cleanText($body['reason']??'',false,300); if($reason==='')throw new \DomainException('Enter a reason for the block.');
        $hours=max(1,min(168,(int)($body['hours']??1)));
        $this->db->prepare('INSERT INTO security_blocks (identity_hash,label,reason,expires_at,created_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE reason=VALUES(reason),expires_at=VALUES(expires_at),created_by=VALUES(created_by)')->execute([$hash,'Network '.substr($hash,0,10),$reason,gmdate('Y-m-d H:i:s',time()+$hours*3600),$adminId]);
    }
    public function unblock(string $hash): void { $this->db->prepare('DELETE FROM security_blocks WHERE identity_hash=?')->execute([$hash]); }
    public function health(): array
    {
        $start=microtime(true); $this->db->query('SELECT 1'); $latency=round((microtime(true)-$start)*1000,2);
        $storage=Storage::directory('cache'); $free=disk_free_space($storage); $total=disk_total_space($storage);
        $size=$this->db->query('SELECT COALESCE(SUM(data_length+index_length),0) FROM information_schema.tables WHERE table_schema=DATABASE()')->fetchColumn();
        $readiness = new SchemaReadiness($this->db);
        $missing = $readiness->coreMissing();
        return ['checkedAt'=>gmdate(DATE_ATOM),'database'=>['connected'=>true,'latencyMs'=>$latency,'bytes'=>(int)$size], 'runtime'=>['php'=>PHP_VERSION,'memoryBytes'=>memory_get_usage(true),'peakMemoryBytes'=>memory_get_peak_usage(true),'memoryLimit'=>ini_get('memory_limit'),'loadAverage'=>function_exists('sys_getloadavg')?sys_getloadavg():null], 'storage'=>['writable'=>is_writable($storage),'freeBytes'=>$free===false?null:$free,'totalBytes'=>$total===false?null:$total], 'counts'=>['openTickets'=>(int)$this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status NOT IN ('resolved','closed')")->fetchColumn(),'pendingMail'=>(int)$this->db->query("SELECT COUNT(*) FROM email_outbox WHERE status='pending'")->fetchColumn(),'failedMail'=>(int)$this->db->query("SELECT COUNT(*) FROM email_outbox WHERE status IN ('failed','uncertain')")->fetchColumn(),'recoveryPoints'=>(int)$this->db->query('SELECT COUNT(*) FROM recovery_snapshots')->fetchColumn()], 'mail'=>(new NotificationService($this->db))->status()['worker'],
            'schema'=>['ready'=>$missing === [], 'missing'=>$missing], 'payments'=>$readiness->payments()];
    }
    public function recordLanding(): void
    {
        if(Http::method()!=='GET' || preg_match('/bot|crawler|spider|preview|headless/i',(string)($_SERVER['HTTP_USER_AGENT']??'')))return;
        $keyPath=Storage::directory('analytics').'/identity-key';
        $handle=fopen($keyPath,'c+'); if(!$handle)throw new \RuntimeException('Analytics unavailable.');
        try { if(!flock($handle,LOCK_EX))throw new \RuntimeException('Analytics unavailable.'); $key=stream_get_contents($handle); if(!$key) { $key=bin2hex(random_bytes(32)); fwrite($handle,$key); fflush($handle); } } finally { flock($handle,LOCK_UN); fclose($handle); }
        $day=gmdate('Y-m-d'); $hash=hash_hmac('sha256',$day.'|'.RateLimiter::clientIdentity().'|'.mb_substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,200),$key);
        $this->db->beginTransaction();
        try {
            $q=$this->db->prepare('INSERT IGNORE INTO landing_visitors (day,visitor_hash) VALUES (?,?)'); $q->execute([$day,$hash]); $unique=$q->rowCount();
            $this->db->prepare('INSERT INTO landing_daily (day,page_views,visitors) VALUES (?,1,?) ON DUPLICATE KEY UPDATE page_views=page_views+1,visitors=visitors+VALUES(visitors)')->execute([$day,$unique]);
            $this->db->commit();
        } catch(\Throwable $e) { if($this->db->inTransaction())$this->db->rollBack(); throw $e; }
        if(random_int(1,100)===1)$this->db->exec('DELETE FROM landing_visitors WHERE day<UTC_DATE()-INTERVAL 30 DAY LIMIT 1000');
    }
    public function analytics(): array
    {
        return ['days'=>$this->db->query('SELECT day,page_views,visitors FROM landing_daily WHERE day>=UTC_DATE()-INTERVAL 29 DAY ORDER BY day')->fetchAll(),'registrations'=>$this->db->query('SELECT DATE(created_at) AS day,COUNT(*) AS count FROM users WHERE created_at>=UTC_DATE()-INTERVAL 29 DAY GROUP BY DATE(created_at) ORDER BY day')->fetchAll(),'totals'=>$this->db->query('SELECT COALESCE(SUM(page_views),0) AS views,COALESCE(SUM(visitors),0) AS dailyVisitors FROM landing_daily WHERE day>=UTC_DATE()-INTERVAL 29 DAY')->fetch()];
    }
}
