<?php
declare(strict_types=1);
namespace ReGen\Actions;
use ReGen\{AdminAccess,ConcurrentUpdate,Http,MaintenanceController,MaintenanceService,ManagedRealtime,RealtimeConnection,RealtimeEvents,Routes,Session};

trait LiveActions
{
    private function liveRoutes(string $path,string $method): void
    {
        if($path==='/api/realtime/authorize'&&$method==='POST') {
            Http::requireSameOriginForMutation();Http::requireCsrfToken(Session::csrfToken());
            $principal=(new RealtimeConnection($this->db))->principal();
            if(!$principal)Http::json(['success'=>false,'message'=>'Sign in to receive updates.'],401);
            if ($principal['role'] === 'user') {
                $maintenance = (new MaintenanceService($this->db))->status();
                if ($maintenance['active']) MaintenanceController::unavailable($maintenance);
            }
            \ReGen\RateLimiter::enforce('realtime-authorize',$principal['role'].':'.$principal['id'],120,60);
            $body=Http::jsonBody();
            try{
                $channels=$body['channels']??[$body['channel_name']??''];
                if(!is_array($channels)||count($channels)<1||count($channels)>32)throw new \DomainException('Choose valid update channels.');
                $authorizations=[];foreach($channels as$channel){$authorizations[(string)$channel]=ManagedRealtime::authorize($principal,(string)$channel,(string)($body['socket_id']??''));}
                if(session_status()===PHP_SESSION_ACTIVE)session_abort();
                Http::json(['success'=>true,'authorizations'=>$authorizations]);
            }
            catch(\DomainException $error){Http::json(['success'=>false,'message'=>$error->getMessage()],403);}
        }
        if($method!=='GET')return;
        if($path==='/api/system/status')Http::json(['success'=>true,'maintenance'=>(new MaintenanceService($this->db))->status()]);
        if ($path === '/maintenance') {
            $return = is_string($_GET['returnTo'] ?? null) ? $_GET['returnTo'] : '/dashboard';
            (new MaintenanceController(new MaintenanceService($this->db)))->render($this->projectRoot, $return);
        }
        if(!Routes::realtime($path, $method))return;
        $connection=new RealtimeConnection($this->db);$principal=$connection->principal();
        if(!$principal){\ReGen\RateLimiter::enforce('realtime-denied',\ReGen\RateLimiter::clientIdentity(),60,60);Http::json(['success'=>false,'message'=>'Authentication required for live updates.'],401);}
        if($path==='/api/realtime/session') {
            (new RealtimeEvents($this->db))->dispatch();
            $maintenance=(new MaintenanceService($this->db))->status();
            $maintenanceOnly = $maintenance['active'] && $principal['role'] === 'user';
            if ($maintenanceOnly) $principal['topics'] = ['maintenance'];
            $managed = $maintenanceOnly ? null : ManagedRealtime::publicConfiguration($principal);
            $csrf=Session::csrfToken();if(session_status()===PHP_SESSION_ACTIVE)session_abort();
            Http::json(['success'=>true,'role'=>$principal['role'],'id'=>$principal['id'],'topics'=>$principal['topics'],
                'transport'=>$managed === null ? 'poll' : 'pusher','managed'=>$managed,
                'csrfToken'=>$csrf,'cursor'=>(new RealtimeEvents($this->db))->cursor(),
                'maintenance'=>$maintenance]);
        }
        if($path==='/api/realtime/events')$connection->serve(true);
        if($path==='/api/realtime/changes')$connection->serve(false);
    }

    private function adminLiveRoutes(string $path,string $method): void
    {
        if($path==='/api/admin/session/active'&&$method==='POST')Http::json(['success'=>true]);
        $maintenance=new MaintenanceService($this->db);
        if($path==='/api/admin/maintenance'&&$method==='GET')Http::json(['success'=>true,'maintenance'=>$maintenance->status(),'delivery'=>(new ManagedRealtime($this->db))->status()]);
        if($path==='/api/admin/maintenance'&&$method==='PUT') {
            try { Http::json(['success'=>true,'maintenance'=>$maintenance->save(Http::jsonBody(),Session::adminId())]); }
            catch(ConcurrentUpdate $e){Http::json(['success'=>false,'message'=>$e->getMessage()],409);}
            catch(\DomainException $e){Http::json(['success'=>false,'message'=>$e->getMessage()],422);}
        }
        if ($path === '/api/admin/maintenance/preview' && $method === 'GET') {
            (new MaintenanceController($maintenance))->render($this->projectRoot, preview: true);
        }
        if($path==='/api/admin/work-queues'&&$method==='GET') {
            $modules=(new AdminAccess($this->db))->permissions($this->admins->findById(Session::adminId()));$counts=[];
            if(in_array('support',$modules,true))$counts['support']=(int)$this->db->query("SELECT COUNT(*) FROM support_tickets WHERE status IN ('open','in_progress')")->fetchColumn();
            if(in_array('feedback',$modules,true))$counts['feedback']=(int)$this->db->query("SELECT COUNT(*) FROM user_feedback WHERE status='new'")->fetchColumn();
            Http::json(['success'=>true,'counts'=>$counts]);
        }
    }
}
