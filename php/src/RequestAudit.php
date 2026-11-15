<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class RequestAudit
{
    public static function start(PDO $db): void
    {
        $type = Session::adminAuthenticated() ? 'admin' : (Session::authenticated() ? 'user' : null);
        if (!str_starts_with(Http::path(), '/api/') || str_starts_with(Http::path(),'/api/realtime/')) return;
        if ($type===null && !(str_starts_with(Http::path(),'/api/auth/') && Http::method()==='POST') && Http::path()!=='/api/admin/auth/login') return;
        $type??='guest';
        $id = $type === 'admin' ? Session::adminId() : ($type==='user'?Session::userId():null);
        $path = Http::path();
        $method = Http::method();
        $started = microtime(true);
        register_shutdown_function(static function () use ($db,$type,$id,$path,$method,$started): void {
            $status = http_response_code() ?: 200;
            if ($method === 'GET' && $status < 400 && in_array($path, ['/api/store/prices','/api/store/payments','/api/notifications/count'],true)) return;
            if ($status < 400 && in_array($path, ['/api/mochi/status','/api/mochi/comment','/api/mochi/chat'],true)) return;
            $outcome = $status >= 500 ? 'failed' : ($status >= 400 ? 'denied' : 'completed');
            if($type==='guest' && $status>=400){
                try {
                    $query=$db->prepare('SELECT id FROM audit_logs WHERE event_type=? AND target_id=? AND ip_hash=? AND created_at>UTC_TIMESTAMP()-INTERVAL 1 MINUTE LIMIT 1');
                    $query->execute(['guest.action_'.$outcome,$path,hash('sha256',RateLimiter::clientIdentity())]);if($query->fetchColumn())return;
                } catch (\Throwable) {
                    // Let AuditLogger retain a protected fallback record if the database is unavailable.
                }
            }
            (new AuditLogger($db))->log($type.'.action_'.$outcome, 'route', $path, [
                'method'=>$method, 'status'=>$status, 'durationMs'=>round((microtime(true)-$started)*1000),
                'requestId'=>(string)($_SERVER['REGEN_REQUEST_ID'] ?? ''),
            ], $type, $id);
        });
    }
}
