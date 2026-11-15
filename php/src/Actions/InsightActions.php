<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\{AdminAccess, AdminAlertService, AdminReportRepository, BonusCreditService, ConcurrentUpdate, FeedbackRepository, Http, RateLimiter, Sanitizer, Session};

trait InsightActions
{
    private function insightRoutes(string $path, string $method): void
    {
        try {
            if(preg_match('#^/api/admin/templates/([a-z]+)/resumes(?:/(\d+)/(preview|pdf))?$#D',$path,$match)&&$method==='GET') {
                $manager=new \ReGen\TemplateManagement($this->db);
                if(empty($match[2]))Http::json(['success'=>true,...$manager->usage($match[1],(int)($_GET['page']??1),(string)($_GET['q']??''))]);
                $record=$manager->savedResume($match[1],(int)$match[2]);
                $this->audit->log('admin.resume_viewed','resume',$record['id'],['userId'=>$record['userId'],'template'=>$match[1],'format'=>$match[3]]);
                session_write_close();
                if($match[3]==='pdf') {
                    header('Content-Type: application/pdf');header('Content-Disposition: inline; filename="saved-resume-'.$record['id'].'.pdf"');
                    echo $this->pdf->generate($record['data']);exit;
                }
                Http::html(\ReGen\TemplateCatalog::browserHtml(\ReGen\ResumeTemplate::buildHtml($record['data'])));
            }
            if ($path==='/api/admin/templates' && $method==='GET') Http::json(['success'=>true,'items'=>(new \ReGen\TemplateManagement($this->db))->report()]);
            if (preg_match('#^/api/admin/templates/([a-z]+)/preview$#D',$path,$match) && $method==='GET') {
                if (!\ReGen\TemplateCatalog::valid($match[1])) Http::html('Template not found.',404);
                Http::html(\ReGen\TemplateCatalog::browserHtml(\ReGen\ResumeTemplate::buildHtml(\ReGen\TemplateCatalog::sample($match[1]))));
            }
            if (preg_match('#^/api/admin/templates/([a-z]+)$#D',$path,$match) && $method==='PATCH') {
                (new \ReGen\TemplateManagement($this->db))->update($match[1],Http::jsonBody(),Session::adminId());
                Http::json(['success'=>true]);
            }
            if ($path==='/api/admin/email/config' && $method==='GET') Http::json(['success'=>true,'settings'=>(new \ReGen\RuntimeMailSettings($this->projectRoot))->publicSettings()]);
            if ($path==='/api/admin/email/config' && $method==='PUT') {
                $body=Http::jsonBody();$current=$this->admins->findByEmail((string)($_SESSION['adminEmail']??''));
                RateLimiter::enforce('mail-settings-reauth',(string)Session::adminId(),6,900);
                if (!$current || !$this->admins->verifyPassword((string)($body['adminPassword']??''),$current)) Http::json(['success'=>false,'message'=>'Confirm this email configuration change with your administrator password.'],403);
                $settings=new \ReGen\RuntimeMailSettings($this->projectRoot);$before=$settings->publicSettings();$settings->save($body);
                $this->audit->log('admin.mail_configuration_updated','settings','mail',['before'=>$before,'after'=>$settings->publicSettings()]);Http::json(['success'=>true]);
            }
            if ($path==='/api/admin/tickets/configuration' && $method==='GET') Http::json(['success'=>true,'configuration'=>(new \ReGen\SupportConfiguration($this->db))->get()]);
            if ($path==='/api/admin/tickets/configuration' && $method==='PUT') { (new \ReGen\SupportConfiguration($this->db))->save(Http::jsonBody(),Session::adminId());Http::json(['success'=>true]); }
            if ($path==='/api/feedback' && $method==='GET') Http::json(['success'=>true,...(new FeedbackRepository($this->db))->eligibility(Session::userId())]);
            if ($path==='/api/feedback' && $method==='POST') {
                RateLimiter::enforce('feedback-submit',(string)Session::userId(),5,3600);
                Http::json(['success'=>true,...(new FeedbackRepository($this->db))->submit(Session::userId(),Http::jsonBody())],201);
            }
            if ($path==='/api/admin/feedback' && $method==='GET') Http::json(['success'=>true,...(new FeedbackRepository($this->db))->listing((string)($_GET['status']??''),(int)($_GET['page']??1),AdminReportRepository::period($_GET))]);
            if (preg_match('#^/api/admin/feedback/(\d+)/reviews$#D',$path,$match) && $method==='GET') Http::json(['success'=>true,'items'=>(new FeedbackRepository($this->db))->reviews((int)$match[1])]);
            if ($path==='/api/admin/feedback/summary' && $method==='GET') {
                $data=(new AdminReportRepository($this->db))->summary(AdminReportRepository::period($_GET));
                Http::json(['success'=>true,...array_intersect_key($data,array_flip(['period','satisfaction','ratings','areas','trend']))]);
            }
            if ($path==='/api/admin/feedback/policy' && $method==='PUT') {
                (new FeedbackRepository($this->db))->savePolicy(Http::jsonBody(),Session::adminId());
                $this->audit->log('admin.feedback_policy_updated','settings','feedback',Http::jsonBody());Http::json(['success'=>true]);
            }
            if (preg_match('#^/api/admin/feedback/(\d+)$#D',$path,$match) && $method==='PATCH') {
                (new FeedbackRepository($this->db))->review((int)$match[1],Http::jsonBody(),Session::adminId());Http::json(['success'=>true]);
            }
            if (preg_match('#^/api/admin/users/(\d+)/bonus$#D',$path,$match)) {
                $userId=(int)$match[1];
                if (!$this->admins->userById($userId)) Http::json(['success'=>false,'message'=>'Account not found.'],404);
                if ($method==='GET') Http::json(['success'=>true,...(new BonusCreditService($this->db))->history($userId,(int)($_GET['page']??1))]);
                if ($method==='POST') {
                    $admin=$this->admins->findById(Session::adminId());
                    if (!in_array('ai.manage',(new AdminAccess($this->db))->capabilities($admin),true)) Http::json(['success'=>false,'message'=>'AI management permission is required to adjust bonus credits.'],403);
                    $body=Http::jsonBody();$amount=filter_var($body['amount']??null,FILTER_VALIDATE_INT);$key=(string)($body['requestKey']??'');
                    if ($amount===false || !preg_match('/^[a-f0-9-]{36}$/D',$key)) throw new \DomainException('Enter an adjustment and a valid request reference.');
                    $reason=Sanitizer::cleanText($body['reason']??'',false,300);
                    $result=(new BonusCreditService($this->db))->adjust($userId,$amount,$reason,'admin','admin:'.$key,Session::adminId());
                    if (!$result['duplicate']) $this->audit->log('admin.bonus_adjusted','user',$userId,['amount'=>$amount,'reason'=>$reason,'balance'=>$result['balance']]);
                    Http::json(['success'=>true,...$result]);
                }
            }
            if ($path==='/api/admin/reports' && $method==='GET') Http::json(['success'=>true,...(new AdminReportRepository($this->db))->summary(AdminReportRepository::period($_GET))]);
            if ($path==='/api/admin/audit/search' && $method==='GET') Http::json(['success'=>true,...(new AdminReportRepository($this->db))->audit($_GET)]);
            if (preg_match('#^/api/admin/(reports|feedback|audit)/export$#D',$path,$match) && $method==='GET') {
                $period=AdminReportRepository::period($_GET);[$headers,$rows]=(new AdminReportRepository($this->db))->export($match[1],$period);
                $this->audit->log('admin.report_exported','report',$match[1],['from'=>$period['from'],'to'=>$period['to'],'rows'=>count($rows)]);
                header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="regen-'.$match[1].'-'.$period['from'].'-'.$period['to'].'.csv"');
                echo AdminReportRepository::csv($headers,$rows);exit;
            }
            if ($path==='/api/admin/alerts' && $method==='GET') {
                (new AdminAlertService($this->db))->detect();
                Http::json(['success'=>true,...(new AdminAlertService($this->db))->inbox($this->admins->findById(Session::adminId()),(int)($_GET['page']??1))]);
            }
            if ($path==='/api/admin/alerts/read' && $method==='POST') { $body=Http::jsonBody();(new AdminAlertService($this->db))->read(Session::adminId(),isset($body['id'])?(int)$body['id']:null);Http::json(['success'=>true]); }
            if($method==='DELETE'&&preg_match('#^/api/admin/alerts/(\d+)$#D',$path,$match)){
                (new AdminAlertService($this->db))->remove(Session::adminId(),(int)$match[1]);
                Http::json(['success'=>true]);
            }
            if ($path==='/api/admin/preferences' && $method==='GET') Http::json(['success'=>true,'preferences'=>(new AdminAlertService($this->db))->preferences(Session::adminId())]);
            if ($path==='/api/admin/preferences' && $method==='PUT') { (new AdminAlertService($this->db))->savePreferences(Session::adminId(),Http::jsonBody());Http::json(['success'=>true]); }
            if (preg_match('#^/api/admin/security/incidents/(\d+)$#D',$path,$match) && $method==='PATCH') {
                $body=Http::jsonBody();$status=(string)($body['status']??'');$note=Sanitizer::cleanText($body['note']??'',true,1000);
                if (!in_array($status,['acknowledged','resolved'],true) || strlen($note)<10) throw new \DomainException('Choose a status and explain the investigation or resolution.');
                $query=$this->db->prepare('UPDATE security_incidents SET status=?,resolution_note=?,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?');$query->execute([$status,$note,Session::adminId(),(int)$match[1]]);
                $this->audit->log('admin.incident_updated','incident',(int)$match[1],['status'=>$status,'note'=>$note]);Http::json(['success'=>true]);
            }
            if (preg_match('#^/api/admin/admins/(\d+)/permissions$#D',$path,$match)) {
                $this->requireSuperAdmin();$id=(int)$match[1];$access=new AdminAccess($this->db);$target=$this->admins->findById($id);
                if (!$target) Http::json(['success'=>false,'message'=>'Administrator not found.'],404);
                if ($method==='GET') Http::json(['success'=>true,'modules'=>AdminAccess::MODULES,'catalogue'=>AdminAccess::catalogue(),'capabilities'=>$access->capabilities($target),'assignment'=>$access->assignment($id)]);
                if ($method==='PUT') {
                    $body=Http::jsonBody();$current=$this->admins->findByEmail((string)($_SESSION['adminEmail']??''));
                    RateLimiter::enforce('admin-access-reauth',(string)Session::adminId(),8,900);
                    if (!$current || !$this->admins->verifyPassword((string)($body['password']??''),$current)) {
                        $this->audit->log('security.permission_reauthentication_failed','admin',$id);
                        Http::json(['success'=>false,'message'=>'Enter your current administrator password to confirm this access change.'],403);
                    }
                    $access->assign($id,$body,Session::adminId());Http::json(['success'=>true]);
                }
            }
        } catch (ConcurrentUpdate $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],409); }
        catch (\OutOfBoundsException $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],404); }
        catch (\DomainException $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],422); }
    }
}
