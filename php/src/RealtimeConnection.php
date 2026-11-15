<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Authentication and short delta reads only; no PHP worker is held open. */
final class RealtimeConnection
{
    public function __construct(private readonly PDO $db) {}

    public function principal(): ?array
    {
        if (Session::adminAuthenticated()) {
            $admin=(new AdminRepository($this->db))->findById(Session::adminId());
            if (!$admin || $admin['status']!=='active' || (int)$admin['must_change_password']) return null;
            if ((int)$admin['is_bootstrap'] && !(new AdminRepository($this->db))->settings()['bootstrapAdminEnabled']) return null;
            $modules=(new AdminAccess($this->db))->permissions($admin);
            $topics=array_values(array_intersect($modules,RealtimeEvents::TOPICS));
            return ['role'=>'admin','id'=>(int)$admin['id'],'topics'=>array_values(array_unique([...$topics,'alerts','profile']))];
        }
        if (Session::authenticated()) {
            $user=(new UserRepository($this->db))->findById(Session::userId());
            if (!$user || !$user['email_verified_at'] || $user['account_status']!=='active') return null;
            $q=$this->db->prepare('SELECT id FROM account_sessions WHERE user_id=? AND session_hash=? AND revoked_at IS NULL');
            $q->execute([Session::userId(),hash('sha256',session_id())]);if(!$q->fetchColumn()) return null;
            return ['role'=>'user','id'=>Session::userId(),'topics'=>['maintenance','features','campaigns','notifications','support','feedback','documents','profile','ai','wallet','store']];
        }
        return null;
    }

    public function serve(bool $stream): never
    {
        $principal=$this->principal();
        if(!$principal)Http::json(['success'=>false,'message'=>'Sign in to receive updates.'],401);
        if($stream)Http::json(['success'=>false,'code'=>'TRANSPORT_RETIRED','message'=>'PHP-held streams have been retired. Reload to use nonblocking updates.'],410);
        RateLimiter::enforce('realtime-delta',$principal['role'].':'.$principal['id'],180,60);
        // Passive reads do not change session data or renew its storage expiry.
        if(session_status()===PHP_SESSION_ACTIVE)session_abort();
        $store=new RealtimeEvents($this->db);$store->dispatch();
        $maintenance=(new MaintenanceService($this->db))->status();
        if($maintenance['active']&&$principal['role']==='user')$principal['topics']=['maintenance'];
        $cursor=max(0,(int)($_GET['since']??0));
        Http::json(['success'=>true,...$store->read($principal,$cursor),'topics'=>$principal['topics'],'maintenance'=>$maintenance]);
    }
}
