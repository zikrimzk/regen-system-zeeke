<?php
declare(strict_types=1);
namespace ReGen\Actions;
use ReGen\{AdminAccess, FeaturePolicy, NotificationService, SupportRepository, RecoveryService, OperationsMonitor, Http, Session, RateLimiter, Sanitizer, EmailVerificationService, Config};

trait ControlCentreActions
{
    private function controlCentreRoutes(string $path, string $method): void
    {
        $admin=str_starts_with($path,'/api/admin/');
        try {
            if($path==='/api/support/configuration' && $method==='GET') {
                $configuration=(new \ReGen\SupportConfiguration($this->db))->get();Http::json(['success'=>true,'message'=>$configuration['message'],'attachments'=>(new \ReGen\SupportConfiguration($this->db))->attachmentLimits()]);
            }
            if($path==='/api/capabilities' && $method==='GET')Http::json(['success'=>true,'features'=>(new FeaturePolicy($this->db))->all()]);
            if($path==='/api/auth/password-reset' && $method==='POST') {
                RateLimiter::enforce('password-reset',RateLimiter::clientIdentity(),10,900); $body=Http::jsonBody();
                if(($body['password']??'')!==($body['confirmPassword']??'') || !(new \ReGen\PasswordResetService($this->db))->consume((string)($body['token']??''),(string)($body['password']??'')))Http::json(['success'=>false,'message'=>'The reset link is invalid or expired, or the passwords do not match (10 to 128 characters).'],422);
                Http::json(['success'=>true,'message'=>'Password updated. Sign in with your new password.']);
            }
            if($path==='/api/admin/features' && $method==='GET')Http::json(['success'=>true,'features'=>(new FeaturePolicy($this->db))->all()]);
            if(preg_match('#^/api/admin/features/([a-z_]+)$#D',$path,$m) && $method==='PUT') {
                (new FeaturePolicy($this->db))->save($m[1],Http::jsonBody(),Session::adminId());
                $this->audit->log('admin.feature_updated','feature',$m[1],Http::jsonBody()); Http::json(['success'=>true,'feature'=>(new FeaturePolicy($this->db))->all()[$m[1]]]);
            }
            if($path==='/api/admin/analytics' && $method==='GET')Http::json(['success'=>true,...(new OperationsMonitor($this->db))->analytics()]);
            if($path==='/api/admin/security' && $method==='GET')Http::json(['success'=>true,...(new OperationsMonitor($this->db))->security()]);
            if($path==='/api/admin/security/blocks' && $method==='POST') {
                (new OperationsMonitor($this->db))->block(Http::jsonBody(),Session::adminId()); $this->audit->log('admin.network_blocked','network',Http::jsonBody()['identityHash']??''); Http::json(['success'=>true]);
            }
            if(preg_match('#^/api/admin/security/blocks/([a-f0-9]{64})$#D',$path,$m) && $method==='DELETE') {
                (new OperationsMonitor($this->db))->unblock($m[1]); $this->audit->log('admin.network_unblocked','network',$m[1]); Http::json(['success'=>true]);
            }
            if($path==='/api/admin/operations/health' && $method==='GET')Http::json(['success'=>true,'health'=>(new OperationsMonitor($this->db))->health()]);
            if($path==='/api/admin/notifications' && $method==='GET')Http::json(['success'=>true,...(new NotificationService($this->db))->status()]);
            if($path==='/api/admin/notifications/policy' && $method==='PUT') { (new NotificationService($this->db))->savePolicy(Http::jsonBody(),Session::adminId()); $this->audit->log('admin.notification_policy_updated'); Http::json(['success'=>true]); }
            if($path==='/api/admin/notifications/campaigns' && $method==='POST') {
                RateLimiter::enforce('admin-broadcast',(string)Session::adminId(),5,3600);
                $id=(new NotificationService($this->db))->campaign(Http::jsonBody(),Session::adminId()); $this->audit->log('admin.broadcast_queued','campaign',$id); Http::json(['success'=>true,'id'=>$id],201);
            }
            if($path==='/api/admin/notifications/retry' && $method==='POST') {
                $id=(int)(Http::jsonBody()['id']??0);
                $q=$this->db->prepare("UPDATE email_outbox SET status='pending',attempts=0,available_at=UTC_TIMESTAMP() WHERE id=? AND status='failed'"); $q->execute([$id]);
                $this->audit->log('admin.email_retry_queued','email_outbox',$id); Http::json(['success'=>true,'queued'=>$q->rowCount()]);
            }
            if($path==='/api/notifications' && $method==='GET'){(new \ReGen\CampaignService($this->db))->syncUser(Session::userId());Http::json(['success'=>true,...(new NotificationService($this->db))->inbox(Session::userId(),max(1,(int)($_GET['page']??1)))]);}
            if($path==='/api/notifications/count' && $method==='GET'){(new \ReGen\CampaignService($this->db))->syncUser(Session::userId());Http::json(['success'=>true,...(new NotificationService($this->db))->unread(Session::userId())]);}
            if($path==='/api/notifications/read' && $method==='POST') { $id=Http::jsonBody()['id']??null; (new NotificationService($this->db))->read(Session::userId(),$id===null?null:(int)$id); Http::json(['success'=>true]); }
            if($path==='/api/notifications/preferences' && $method==='PUT') { (new NotificationService($this->db))->savePreferences(Session::userId(),Http::jsonBody()); Http::json(['success'=>true]); }
            if($path==='/api/notifications/preferences' && $method==='GET')Http::json(['success'=>true,'preferences'=>(new NotificationService($this->db))->preferences(Session::userId())]);
            if($method==='DELETE'&&preg_match('#^/api/notifications(?:/(\d+))?$#D',$path,$match)){
                (new NotificationService($this->db))->remove(Session::userId(),isset($match[1])?(int)$match[1]:null);
                Http::json(['success'=>true]);
            }
            if(in_array($path,['/api/admin/tickets','/api/support/tickets'],true)) {
                $support=new SupportRepository($this->db);
                if($method==='GET')Http::json(['success'=>true,...$support->listing($admin?null:Session::userId(),(string)($_GET['status']??''),Sanitizer::cleanText($_GET['search']??'',false,100),max(1,(int)($_GET['page']??1))),...($admin?['assignees'=>$support->assignees()]:[])]);
                if(!$admin && $method==='POST') {
                    RateLimiter::enforce('support-create',(string)Session::userId(),5,3600); $id=$support->create(Session::userId(),$this->supportBody(),$_FILES['attachments']??[]); Http::json(['success'=>true,'id'=>$id],201);
                }
            }
            if(preg_match('#^/api/(admin|support)/tickets/(\d+)$#D',$path,$m)) {
                $support=new SupportRepository($this->db); $owner=$admin?null:Session::userId();
                if($method==='GET') { $detail=$support->detail((int)$m[2],$owner,(int)($_GET['messagePage']??1)); if(!$detail)Http::json(['success'=>false,'message'=>'Ticket not found.'],404); Http::json(['success'=>true,...$detail,...($admin?['assignees'=>$support->assignees()]:[])]); }
                if($method==='PATCH'||($method==='POST'&&str_starts_with((string)($_SERVER['CONTENT_TYPE']??''),'multipart/form-data'))) { RateLimiter::enforce('support-reply',($admin?'admin:':'user:').($admin?Session::adminId():Session::userId()),30,3600); $support->update((int)$m[2],$owner,$admin?Session::adminId():Session::userId(),$this->supportBody(),$_FILES['attachments']??[]); Http::json(['success'=>true]); }
            }
            if(preg_match('#^/api/(admin|support)/tickets/(\d+)/attachments/(\d+)$#D',$path,$m)&&$method==='GET') (new \ReGen\SupportAttachments($this->db))->serve((int)$m[2],(int)$m[3],$admin?null:Session::userId());
            if($path==='/api/admin/recovery' && $method==='GET')Http::json(['success'=>true,'items'=>(new RecoveryService($this->db))->listing((int)($_GET['userId']??0)),'policy'=>(new RecoveryService($this->db))->policy()]);
            if($path==='/api/admin/recovery/policy' && $method==='PUT') { (new RecoveryService($this->db))->savePolicy(Http::jsonBody(),Session::adminId());$this->audit->log('admin.recovery_policy_updated','settings','recovery',Http::jsonBody());Http::json(['success'=>true]); }
            if($path==='/api/admin/recovery' && $method==='POST') {
                RateLimiter::enforce('recovery-create',(string)Session::adminId(),20,3600); $body=Http::jsonBody();
                $id=(new RecoveryService($this->db))->snapshot((int)($body['userId']??0),Sanitizer::cleanText($body['label']??'Manual recovery point',false,180),Session::adminId()); $this->audit->log('admin.recovery_created','recovery',$id); Http::json(['success'=>true,'id'=>$id],201);
            }
            if (preg_match('#^/api/admin/recovery/(\d+)$#D', $path, $m) && $method === 'GET') {
                $item = (new RecoveryService($this->db))->inspect((int) $m[1]);
                if (!$item) Http::json(['success'=>false, 'message'=>'Recovery point not found.'], 404);
                $this->audit->log('admin.recovery_inspected', 'recovery', (int) $m[1], ['userId' => $item['userId']]);
                Http::json(['success'=>true, 'item'=>$item]);
            }
            if(preg_match('#^/api/admin/recovery/(\d+)/restore$#D',$path,$m) && $method==='POST') {
                $body = Http::jsonBody();
                if (($body['confirmation'] ?? '') !== 'RESTORE ' . $m[1]) throw new \DomainException('Type the recovery confirmation exactly.');
                $this->reauthenticatePrivateDocuments($body['password'] ?? null, 'restore');
                $userId=(new RecoveryService($this->db))->restore((int)$m[1],Session::adminId()); $this->audit->log('admin.documents_restored','user',$userId,['recoveryPoint'=>(int)$m[1]]); Http::json(['success'=>true]);
            }
            if(preg_match('#^/api/admin/users/(\d+)$#D',$path,$m) && $method==='GET') {
                $user=$this->admins->userById((int)$m[1]); if(!$user)Http::json(['success'=>false,'message'=>'User not found.'],404);
                $sessions=$this->db->prepare('SELECT id,device_label,browser_label,last_seen_at,created_at,revoked_at FROM account_sessions WHERE user_id=? ORDER BY last_seen_at DESC LIMIT 30'); $sessions->execute([(int)$m[1]]);
                Http::json(['success'=>true,'user'=>$user,'sessions'=>$sessions->fetchAll(),'quota'=>$this->aiQuota->status((int)$m[1]),'resumes'=>$this->resumes->getSummariesByUser((int)$m[1]),'coverLetters'=>(new \ReGen\CoverLetterRepository($this->db))->list((int)$m[1])]);
            }
            if (preg_match('#^/api/admin/users/(\d+)/export$#D', $path, $m) && in_array($method, ['GET', 'POST'], true)) {
                $this->accountDataExport((int) $m[1], $method);
            }
            if(preg_match('#^/api/admin/users/(\d+)/verification$#D',$path,$m) && $method==='POST') {
                RateLimiter::enforce('admin-verify-user',$m[1],3,3600);
                if(!$this->emailVerification->configured())Http::json(['success'=>false,'message'=>'Configure email delivery first.'],503);
                $user=$this->admins->userById((int)$m[1]); if(!$user)throw new \OutOfBoundsException('User not found.');
                $token=EmailVerificationService::createToken(); $user=$this->users->issueVerificationTokenForEmail($user['email'],EmailVerificationService::hashToken($token),$this->emailVerification->expiresAt());
                if(!$user)throw new \DomainException('This email is already verified.');
                $ok=$this->emailVerification->send($user['email'],$user['first_name'],$token); $this->emailDeliveries->record('admin_verification_resend',$user['email'],(string)Config::get('mail.transport','smtp'),$ok); $this->audit->log('admin.verification_resent','user',(int)$m[1],['accepted'=>$ok]);
                Http::json(['success'=>$ok,'message'=>$ok?'Verification email accepted.':'Mail delivery failed. Check delivery configuration.'],$ok?200:502);
            }
            if(preg_match('#^/api/admin/users/(\d+)/password-reset$#D',$path,$m) && $method==='POST') {
                RateLimiter::enforce('admin-password-reset',$m[1],3,3600);
                $user=$this->admins->userById((int)$m[1]); if(!$user)throw new \OutOfBoundsException('User not found.');
                if(!$this->emailVerification->configured() || !$user['email_verified_at'])throw new \DomainException('A verified account and configured mail delivery are required.');
                $token=(new \ReGen\PasswordResetService($this->db))->issue((int)$m[1]); $ok=$this->emailVerification->sendPasswordReset($user['email'],$token);
                $this->emailDeliveries->record('admin_password_reset',$user['email'],(string)Config::get('mail.transport','smtp'),$ok); $this->audit->log('admin.password_reset_requested','user',(int)$m[1],['accepted'=>$ok]);
                Http::json(['success'=>$ok,'message'=>$ok?'Reset email accepted. The link expires in 30 minutes.':'Reset email delivery failed.'],$ok?200:502);
            }
            if(preg_match('#^/api/admin/users/(\d+)/delete$#D',$path,$m) && $method==='POST') {
                $this->requireSuperAdmin(); $body=Http::jsonBody(); if(($body['confirmation']??'')!=='DELETE USER '.$m[1])throw new \DomainException('Type the deletion confirmation exactly.');
                $user=$this->admins->userById((int)$m[1]); if(!$user)throw new \OutOfBoundsException('User not found.');
                $current=$this->admins->findByEmail((string)($_SESSION['adminEmail']??'')); if(!$current || !$this->admins->verifyPassword((string)($body['password']??''),$current))Http::json(['success'=>false,'message'=>'Enter your administrator password.'],403);
                $this->accounts->deleteAccount((int)$m[1]); $this->audit->log('admin.user_deleted','user',(int)$m[1]); Http::json(['success'=>true]);
            }
        } catch(\ReGen\ConcurrentUpdate $e) { Http::json(['success'=>false,'message'=>$e->getMessage()],409); }
        catch(\OutOfBoundsException $e) { Http::json(['success'=>false,'message'=>$e->getMessage()],404); }
        catch(\DomainException $e) { Http::json(['success'=>false,'message'=>$e->getMessage()],422); }
    }

    private function accountDataExport(int $userId, string $method): never
    {
        if ($method === 'GET') {
            Http::json(['success' => false, 'code' => 'ADMIN_REAUTH_REQUIRED',
                'message' => 'Confirm your administrator password in User accounts before downloading.'], 428);
        }
        $this->reauthenticatePrivateDocuments(Http::jsonBody()['password'] ?? null, 'export');
        $user = $this->admins->userById($userId);
        if (!$user) throw new \OutOfBoundsException('User not found.');
        $documents = $this->accounts->documentExport($userId);
        $this->audit->log('admin.user_data_exported', 'user', $userId);
        header('Content-Disposition: attachment; filename="regen-user-' . $userId . '.json"');
        Http::json(['success' => true, 'exportedAt' => gmdate(DATE_ATOM), 'profile' => $user, ...$documents]);
    }

    private function reauthenticatePrivateDocuments(mixed $password, string $operation): void
    {
        $adminId = Session::adminId();
        RateLimiter::enforce('admin-document-reauth', (string) $adminId, 8, 900);
        $admin = $this->admins->findByEmail((string) ($_SESSION['adminEmail'] ?? ''));
        if (!is_string($password) || !$admin || (int) $admin['id'] !== $adminId || !$this->admins->verifyPassword($password, $admin)) {
            $this->audit->log('security.admin_document_reauth_denied', 'operation', $operation);
            Http::json(['success' => false, 'code' => 'ADMIN_REAUTH_REQUIRED', 'message' => 'Enter your current administrator password.'], 403);
        }
    }

    private function enforceFeatureRoute(string $path,string $method): void
    {
        $features=null;
        foreach(FeaturePolicy::forRoute($path,$method) as $key) {
            $features??=(new FeaturePolicy($this->db))->all();$feature=$features[$key];
            if(!$feature['available']) {
                $message=$feature['message']?:$feature['name'].' is temporarily unavailable.';
                if(str_starts_with($path,'/api/'))Http::json(['success'=>false,'code'=>'FEATURE_UNAVAILABLE','feature'=>$key,'message'=>$message,'availableAfter'=>$feature['downtimeEnd']],503);
                \ReGen\PageRenderer::render($this->projectRoot,'unavailable.html',['{{MESSAGE}}'=>htmlspecialchars($message,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')],503);
            }
        }
    }

    private function supportBody(): array
    {
        if(!str_starts_with((string)($_SERVER['CONTENT_TYPE']??''),'multipart/form-data'))return Http::jsonBody();
        if(!$_POST&&!$_FILES&&Http::contentLength()>0)Http::json(['success'=>false,'message'=>'This upload exceeds the hosting upload limit. Choose smaller files.'],413);
        $body=$_POST;
        if(isset($body['clientContext']))$body['clientContext']=json_decode((string)$body['clientContext'],true)?:[];
        if(isset($body['internalNote']))$body['internalNote']=filter_var($body['internalNote'],FILTER_VALIDATE_BOOLEAN);
        return $body;
    }
}
