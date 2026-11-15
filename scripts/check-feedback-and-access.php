<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__).'/vendor/autoload.php';

use ReGen\{AdminAccess,AdminAlertService,AdminReportRepository,AdminRepository,AiQuotaService,BonusCreditService,Config,FeedbackRepository,NotificationService,EmailVerificationService,RuntimeMailSettings,UserRepository};

Config::load(dirname(__DIR__));
if (!in_array(Config::get('app.env'),['development','test','testing'],true) || !in_array(Config::get('db.host'),['localhost','127.0.0.1','::1'],true)) throw new RuntimeException('Checks require a local development database.');
$connect=static fn(?string $name=null): PDO => new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').($name?';dbname='.$name:'').';charset=utf8mb4',(string)Config::get('db.user'),(string)Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if (in_array($argv[1]??'',['--submit','--reserve'],true)) {
    if (!preg_match('/^regen_refinement_test_[a-f0-9]{12}$/D',$argv[2]??'')) exit(2);
    if ($argv[1]==='--reserve') { echo (new AiQuotaService($connect($argv[2])))->consume((int)$argv[3],'refine')['allowed']?'1':'0';exit; }
    $result=(new FeedbackRepository($connect($argv[2])))->submit((int)$argv[3],['rating'=>1,'area'=>'overall','source'=>'general','comment'=>'A genuine concurrent feedback test.','submissionKey'=>$argv[4]]);
    echo $result['rewardGranted']; exit;
}
$server=$connect();$name='regen_refinement_test_'.bin2hex(random_bytes(6));$server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$checks=0;$check=static function(bool $ok,string $message)use(&$checks):void{$checks++;if(!$ok)throw new RuntimeException($message);};
$reject=static function(callable $action,string $message)use($check):void{try{$action();$check(false,$message);}catch(DomainException){$check(true,$message);}};
$uuid=static fn():string=>sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6)));
$configRoot=dirname(__DIR__).'/tmp/refinement-config-'.bin2hex(random_bytes(6));
try {
    $db=$connect($name);$db->exec("SET time_zone='+00:00'");$db->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));
    $users=new UserRepository($db);$admins=new AdminRepository($db);$access=new AdminAccess($db);$feedback=new FeedbackRepository($db);$wallet=new BonusCreditService($db);$notifications=new NotificationService($db);$alerts=new AdminAlertService($db);
    $owner=$admins->findByEmail('admin@regen.com');$ownerId=(int)$owner['id'];
    $user=$users->create(['firstName'=>'Feedback','lastName'=>'Tester','email'=>'feedback@qa.regen.local','password'=>'Test-Password-567890']);$uid=(int)$user['id'];
    $db->prepare('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?')->execute([$uid]);
    $submission=['rating'=>1,'functionalityRating'=>2,'easeRating'=>3,'area'=>'downloads','source'=>'resume_download','comment'=>'The download flow could explain progress more clearly.','submissionKey'=>$uuid()];
    $result=$feedback->submit($uid,$submission);$check($result['rewardGranted']===5 && $wallet->balance($uid)['balance']===5,'A critical first rating earns the full configured reward.');
    $repeat=$feedback->submit($uid,$submission);$check($repeat['duplicate'] && $wallet->balance($uid)['balance']===5,'Retrying a submission cannot duplicate a reward.');
    $feedback->submit($uid,[...$submission,'rating'=>5,'submissionKey'=>$uuid()]);$check($wallet->balance($uid)['balance']===5,'A later rating cannot earn another first-feedback reward.');
    $reject(fn()=>$feedback->submit($uid,[...$submission,'rating'=>6,'submissionKey'=>$uuid()]),'Invalid star values must be rejected.');
    $check(!$feedback->eligibility($uid)['rewardEligible'],'Eligibility must reflect the persisted first reward.');
    $feedback->review((int)$result['id'],['status'=>'reviewed','note'=>'Investigating the download progress display.','version'=>1],$ownerId);
    $feedback->review((int)$result['id'],['status'=>'planned','note'=>'Progress wording is scheduled for improvement.','version'=>2],$ownerId);
    $reviews=$feedback->reviews((int)$result['id']);
    $check(count($reviews)===2 && $reviews[0]['status']==='reviewed' && $reviews[1]['status']==='planned','Feedback follow-up retains each previous review.');
    $second=$users->create(['firstName'=>'Parallel','lastName'=>'Tester','email'=>'parallel@qa.regen.local','password'=>'Test-Password-567890']);$secondId=(int)$second['id'];
    $jobs=[];for($i=0;$i<2;$i++){$pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'--submit',$name,(string)$secondId,$uuid()],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$jobs[]=[$process,$pipes];}
    $rewards=0;foreach($jobs as [$process,$pipes]){$output=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);$check($exit===0&&$errors==='','Concurrent feedback worker failed.');$rewards+=(int)$output;}
    $check($rewards===5 && $wallet->balance($secondId)['balance']===5,'Concurrent first submissions must award once.');
    $feedback->savePolicy(['enabled'=>true,'downloadPrompt'=>false,'reward'=>9],$ownerId);
    $third=$users->create(['firstName'=>'Policy','lastName'=>'Tester','email'=>'policy@qa.regen.local','password'=>'Test-Password-567890']);
    $thirdResult=$feedback->submit((int)$third['id'],[...$submission,'submissionKey'=>$uuid()]);$check($thirdResult['rewardGranted']===9 && $wallet->balance($uid)['balance']===5,'Policy changes affect future rewards without rewriting existing balances.');
    $admins->updateSettings(['aiEnabled'=>true,'aiDefaultLimit'=>3,'aiRenewalHours'=>24,'aiCosts'=>['assist'=>1,'refine'=>3,'cover_letter'=>1,'review'=>0]],$ownerId);
    $pricing=new ReGen\FeaturePricing($db);$price=$pricing->all()['ai_refine'];$pricing->save('ai_refine',['mode'=>'per_use','cost'=>3,'version'=>$price['version']],$ownerId);
    $quota=new AiQuotaService($db);$hold=$quota->consume($uid,'refine');
    $check($hold['allowed']&&$hold['bonusReserved']===0&&$hold['baseRemaining']===0&&$hold['remaining']===5,'AI reservations use base tokens first and retain the saved balance.');
    $check($wallet->balance($uid)['balance']===5,'AI reservations do not spend permanent ReGen tokens.');
    $quota->finalize($uid,$hold['windowStartedAt'],$hold['reservationToken']);$quota->finalize($uid,$hold['windowStartedAt'],$hold['reservationToken']);
    $check($quota->status($uid)['used']===3&&$wallet->balance($uid)['balance']===5,'Success charges the AI allowance exactly once and leaves the wallet unchanged.');
    $jobs=[];for($i=0;$i<8;$i++){$pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'--reserve',$name,(string)$secondId],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$jobs[]=[$process,$pipes];}
    $allowed=0;foreach($jobs as[$process,$pipes]){$output=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0&&$errors==='','Concurrent allowance reservation failed.');$allowed+=(int)$output;}
    $check($allowed===2&&$wallet->balance($secondId)['reserved']===3&&$wallet->balance($secondId)['balance']===5,'Parallel AI workers cannot overspend combined base and saved balances.');
    $fallback=$quota->consume($uid,'refine');$check($fallback['allowed']&&$fallback['bonusReserved']===3,'An explicitly priced AI action falls back to saved tokens after base tokens.');$check(!$quota->consume($uid,'refine')['allowed'],'Combined balances cannot be overdrawn.');$quota->refund($uid,$fallback['windowStartedAt'],$fallback['reservationToken']);
    $db->exec('UPDATE ai_usage_windows SET window_started_at=1');$check($quota->status($uid)['baseRemaining']===3&&$quota->status($uid)['remaining']===8&&$wallet->balance($uid)['balance']===5,'Allowance renewal preserves the permanent wallet.');
    $hold=$quota->consume($uid,'assist');$quota->refund($uid,$hold['windowStartedAt'],$hold['reservationToken']);$check($wallet->balance($uid)['balance']===5,'Failed generations leave the wallet unchanged.');
    $key='admin:'.$uuid();$wallet->adjust($uid,2,'Support compensation','admin',$key,$ownerId);$wallet->adjust($uid,2,'Support compensation','admin',$key,$ownerId);
    $check($wallet->balance($uid)['balance']===7,'Retried administrator adjustments are idempotent.');
    $reject(fn()=>$wallet->adjust($uid,-8,'Invalid removal','admin','admin:'.$uuid(),$ownerId),'Permanent balances cannot become negative.');
    $db->prepare('UPDATE users SET ai_token_limit=0 WHERE id=?')->execute([$uid]);$check(!$quota->consume($uid,'review')['allowed'],'An explicit administrator AI pause remains enforced for saved tokens and packages.');
    $delegate=$admins->createAdmin(['firstName'=>'Read','lastName'=>'Only','email'=>'reader@qa.regen.local','password'=>'Test-Password-567890','role'=>'admin']);$admin=$admins->findById($delegate);
    $access->assign($delegate,['capabilities'=>['support.view'],'purpose'=>'Review requests without making changes','version'=>0,'expiresAt'=>null],$ownerId);
    $check($access->allows($admin,'/api/admin/tickets','GET') && !$access->allows($admin,'/api/admin/tickets/1','PATCH'),'Read access must not allow changes.');
    $check(!$access->allows($admin,'/api/admin/audit/export','GET'),'Exports require their own explicit permission.');
    $reject(fn()=>$access->assign($delegate,['capabilities'=>['users.export'],'purpose'=>'Invalid export-only assignment','version'=>1,'expiresAt'=>null],$ownerId),'Export access requires read access.');
    $reject(fn()=>$access->assign($delegate,['capabilities'=>['admins.manage'],'purpose'=>'Attempt to escalate administrator access','version'=>1,'expiresAt'=>null],$ownerId),'Delegates cannot receive administrator management access.');
    $access->assign($delegate,['capabilities'=>['support.view','support.manage'],'purpose'=>'Handle customer tickets for a temporary shift','version'=>1,'expiresAt'=>gmdate('Y-m-d\TH:i:s\Z',time()+3600)],$ownerId);
    $db->prepare('UPDATE admin_access_assignments SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE admin_id=?')->execute([$delegate]);$check($access->permissions($admin)===[],'Expired access must be denied to an existing account session.');
    $check(!array_filter($notifications->preferences($uid)),'New customer alert channels are off by default.');
    $notifications->notify($uid,'security','Consent fixture','No email without consent.');$check((int)$db->query('SELECT COUNT(*) FROM email_outbox')->fetchColumn()===0,'Security email also requires explicit consent.');
    $prefs=['account_email'=>false,'support_email'=>false,'announcement_email'=>false,'security_email'=>true,'in_app_enabled'=>true,'browser_enabled'=>false];$notifications->savePreferences($uid,$prefs);
    $notifications->notify($uid,'security','Consented fixture','An opted-in security alert.');$check((int)$db->query('SELECT COUNT(*) FROM email_outbox')->fetchColumn()===1,'An opted-in category can queue email.');
    $notifications->savePreferences($uid,[...$prefs,'security_email'=>false]);$sent=0;
    $mailer=new EmailVerificationService('http://localhost:8088','testing','support@regen.local','ReGen','',3600,static function()use(&$sent){$sent++;return true;});
    $notifications->work($mailer,100);$check($sent===0 && (int)$db->query("SELECT COUNT(*) FROM email_outbox WHERE status='skipped'")->fetchColumn()===1,'Withdrawing consent suppresses queued mail before delivery.');
    $check(!$alerts->preferences($ownerId)['email_enabled'],'Administrator email defaults to off.');
    $alerts->incident('fixture-issue','high','Fixture security issue','A reproducible security issue requires investigation.');
    $check(count($alerts->inbox($owner)['items'])>0 && (int)$db->query("SELECT COUNT(*) FROM admin_notifications WHERE email_status='pending'")->fetchColumn()===0,'Administrators receive a portal record without unsolicited email.');
    $period=AdminReportRepository::period([]);$reports=new AdminReportRepository($db);$report=$reports->summary($period);
    $check((int)$report['satisfaction']['responses']===5 && count($report['ratings'])===2,'Reports aggregate all ratings, including negative feedback.');
    $csv=AdminReportRepository::csv(['comment'],[['=HYPERLINK("https://example.invalid")']]);$check(str_contains($csv,"'=HYPERLINK"),'CSV exports neutralise spreadsheet formulas.');
    $reject(fn()=>AdminReportRepository::period(['from'=>'2026-02-31','to'=>'2026-03-01']),'Reports reject impossible calendar dates.');
    $saved=new RuntimeMailSettings($configRoot);$mail=['host'=>'smtp.regen.local','port'=>587,'username'=>'fixture@regen.local','smtpPassword'=>'Fixture-SMTP-Password','fromEmail'=>'support@regen.local','fromName'=>'ReGen','encryption'=>'tls'];
    $saved->save($mail);$check($saved->read()['mail.smtp_password']==='Fixture-SMTP-Password' && !str_contains(file_get_contents($configRoot.'/storage/configuration/mail.json'),'Fixture-SMTP-Password'),'Saved SMTP credentials must be encrypted.');
    $saved->save([...$mail,'smtpPassword'=>'','fromName'=>'ReGen Support']);$check($saved->read()['mail.smtp_password']==='Fixture-SMTP-Password' && !array_key_exists('smtpPassword',$saved->publicSettings()),'A blank password preserves the saved secret without returning it to the browser.');
    $reject(fn()=>$saved->save([...$mail,'encryption'=>'none']),'Portal settings must not allow unencrypted SMTP.');
    $feedback->savePolicy(['enabled'=>true,'downloadPrompt'=>true,'reward'=>7,'rewardLimit'=>2],$ownerId);
    $check($feedback->eligibility($uid)['rewardsRemaining']===1,'Raising the configured reward count creates exactly the remaining opportunity.');
    $jobs=[];for($i=0;$i<2;$i++){$pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'--submit',$name,(string)$uid,$uuid()],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$jobs[]=[$process,$pipes];}
    $earned=0;foreach($jobs as [$process,$pipes]){$output=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0&&$errors==='','Configured reward worker failed.');$earned+=(int)$output;}
    $check($earned===7 && $wallet->balance($uid)['balance']===14 && !$feedback->eligibility($uid)['rewardEligible'],'Concurrent responses cannot exceed the configured reward count.');
    $feedback->savePolicy(['enabled'=>true,'downloadPrompt'=>true,'reward'=>7,'rewardLimit'=>0],$ownerId);
    $check(!$feedback->eligibility((int)$third['id'])['rewardEligible'],'Zero reward opportunities pauses bonuses.');
    $_SERVER['HTTP_USER_AGENT']='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';
    $context=\ReGen\DeviceContext::capture(['page'=>'/support','width'=>390,'height'=>844,'timezone'=>'Asia/Kuala_Lumpur','displayMode'=>'standalone']);
    $check($context['browser']==='Microsoft Edge' && $context['browserVersion']==='140.0.0.0' && $context['device']==='Windows computer','Browser and device context is identified without hardware fingerprinting.');
    $support=new \ReGen\SupportRepository($db);$ticketId=$support->create($uid,['subject'=>'Environment context check','category'=>'technical','body'=>'This is a fictional support context test.','clientContext'=>['page'=>'/support','width'=>390,'height'=>844,'timezone'=>'Asia/Kuala_Lumpur','displayMode'=>'standalone']]);
    $detail=$support->detail($ticketId,null);$check($detail['ticket']['clientContext']['width']===390 && $detail['ticket']['clientContext']['displayMode']==='standalone','Support captures the submission environment for investigation.');
    $check(!array_key_exists('client_context',$support->detail($ticketId,$uid)['ticket']),'Internal support context is excluded from customer ticket payloads.');
    $unread=$notifications->unread($uid);$query=$db->prepare('SELECT COUNT(*) FROM user_notifications WHERE user_id=? AND read_at IS NULL');$query->execute([$uid]);
    $check((int)$unread['counts']['unread']===(int)$query->fetchColumn(),'The bell count includes only the signed-in account’s unread records.');
    $notifications->read($uid,null);$check((int)$notifications->unread($uid)['counts']['unread']===0,'Marking all notifications read clears the bell count.');
    $check((int)$notifications->unread($secondId)['counts']['unread']===0,'Another account’s count is not affected by notification records for this account.');
    (new \ReGen\AuditLogger($db))->log('fixture.device_context','user',$uid,[],'user',$uid);
    $audit=(new AdminReportRepository($db))->audit(['actor'=>'user','actorId'=>(string)$uid,'event'=>'fixture.device_context']);
    $check(count($audit['items'])===1 && $audit['items'][0]['client']['browser']==='Microsoft Edge' && $audit['items'][0]['actor_name']==='Feedback Tester','Audit filtering returns named actors and readable browser/device context.');
    echo "Feedback rewards, persistent credits, scoped access, consent, reporting and encrypted mail settings passed ($checks assertions; isolated database and local fixtures).\n";
} finally {
    $db=null;
    if (!preg_match('/^regen_refinement_test_[a-f0-9]{12}$/D',$name)) throw new RuntimeException('Unsafe test cleanup target.');
    $server->exec('DROP DATABASE `'.$name.'`');
    foreach (['mail.json','mail.key','mail.lock'] as $file) { $path=$configRoot.'/storage/configuration/'.$file;if(is_file($path))unlink($path); }
    foreach ([$configRoot.'/storage/configuration',$configRoot.'/storage',$configRoot] as $directory) if(is_dir($directory))rmdir($directory);
}
