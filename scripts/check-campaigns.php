<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/vendor/autoload.php';
use ReGen\{AdminAccess,AdminRepository,AiQuotaService,BonusCreditService,CampaignService,Config,ConcurrentUpdate,NotificationService,SupportRepository,UserRepository};
Config::load(dirname(__DIR__));
if(!in_array(Config::get('app.env'),['development','test','testing'],true)||!in_array(Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('Checks require a local development database.');
$connect=static fn(?string $name=null):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').($name?';dbname='.$name:'').';charset=utf8mb4',(string)Config::get('db.user'),(string)Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if(($argv[1]??'')==='--claim'){
    if(!preg_match('/^regen_campaign_test_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
    try{(new CampaignService($connect($argv[2])))->claim((int)$argv[3],(int)$argv[4],$argv[5]);echo '1';}catch(DomainException){echo '0';}exit;
}
$server=$connect();$name='regen_campaign_test_'.bin2hex(random_bytes(6));$server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');$count=0;
$check=static function(bool $ok,string $message)use(&$count):void{if(!$ok)throw new RuntimeException($message);$count++;};
$reject=static function(callable $call,string $message)use($check):void{try{$call();}catch(DomainException|OutOfBoundsException|ConcurrentUpdate){$check(true,$message);return;}$check(false,$message);};
$uuid=static fn():string=>bin2hex(random_bytes(4)).'-'.bin2hex(random_bytes(2)).'-4'.substr(bin2hex(random_bytes(2)),1).'-8'.substr(bin2hex(random_bytes(2)),1).'-'.bin2hex(random_bytes(6));
try{
    $db=$connect($name);$db->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));
    $admins=new AdminRepository($db);$admin=(int)$admins->findByEmail('admin@regen.com')['id'];$users=new UserRepository($db);
    $ids=[];foreach(['One','Two','Three'] as $index=>$first){$user=$users->create(['firstName'=>$first,'lastName'=>'Tester','email'=>'campaign'.$index.'@qa.regen.local','password'=>'Qa-User-567890']);$ids[]=(int)$user['id'];}
    [$one,$two,$three]=$ids;$db->prepare('UPDATE users SET email_verified_at=NULL WHERE id=?')->execute([$three]);$db->prepare('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id IN (?,?)')->execute([$one,$two]);
    $service=new CampaignService($db);$bonus=new BonusCreditService($db);
    $body=['title'=>'Thank you for trying ReGen','body'=>'Your honest feedback helps us improve.','color'=>'blue','status'=>'draft','audience'=>'all','rewardEnabled'=>true,'rewardAmount'=>5,'rewardLimit'=>1,'totalClaimLimit'=>0,'startsAt'=>null,'endsAt'=>null];
    $access=new AdminAccess($db);$delegate=$admins->createAdmin(['firstName'=>'Campaign','lastName'=>'Reader','email'=>'reader@qa.regen.local','password'=>'Qa-Reader-567890','role'=>'admin']);
    $access->assign($delegate,['capabilities'=>['campaigns.view','support.view'],'purpose'=>'Review campaigns and support records only','version'=>0],$admin);$reader=$admins->findById($delegate);
    $check($access->allows($reader,'/api/admin/campaigns','GET')&&!$access->allows($reader,'/api/admin/campaigns','POST'),'Campaign read access must not allow publication.');
    $check(!$access->allows($reader,'/api/admin/tickets/1/reopen','POST'),'Reopening must require Support change access.');
    $id=$service->save(null,$body,$admin);$check($service->forUser($one)['items']===[],'Drafts must stay private.');$reject(fn()=>$service->detail($id,$one),'Draft detail must not leak.');
    $publish=static function(int $id,array $changes=[])use($service,$body,$admin,$db):void{$q=$db->prepare('SELECT version FROM campaigns WHERE id=?');$q->execute([$id]);$service->save($id,array_replace($body,['version'=>(int)$q->fetchColumn(),'status'=>'active'],$changes),$admin);};
    $publish($id);$check(count($service->forUser($one)['items'])===1,'Published notice must appear on the dashboard.');$notifications=new NotificationService($db);$service->syncUser($one);$service->deliverBatch();
    $q=$db->prepare('SELECT COUNT(*) FROM user_notifications WHERE user_id=? AND link=?');$q->execute([$one,'/notifications?campaign='.$id]);$check((int)$q->fetchColumn()===1,'Worker and page delivery must deduplicate.');$check((int)$db->query('SELECT COUNT(*) FROM email_outbox')->fetchColumn()===0,'Campaigns must not send unsolicited email.');
    $reject(fn()=>$service->claim($id,$one,str_repeat('-',36)),'Malformed claim references must fail.');$key=$uuid();$result=$service->claim($id,$one,$key);$check($result['rewardGranted']===5&&$bonus->balance($one)['balance']===5,'A claim must add persistent bonus tokens.');$check($service->claim($id,$one,$key)['duplicate'],'Retry must be idempotent.');$reject(fn()=>$service->claim($id,$one,$uuid()),'Per-user cap must reject excess claims.');
    $service->dismiss($id,$one);$check($service->forUser($one)['items']===[],'Dismissal hides only the dashboard banner.');$check($service->detail($id,$one)['title']===$body['title'],'Dismissed detail must remain accessible.');
    $publish($id,['rewardLimit'=>2]);$service->claim($id,$one,$uuid());$check($bonus->balance($one)['balance']===10,'Increasing the configured count enables one more claim.');
    $publish($id,['status'=>'paused']);$reject(fn()=>$service->claim($id,$two,$uuid()),'Paused rewards must be blocked.');$check(!$service->detail($id,$one)['active'],'Paused details remain readable.');
    $reject(fn()=>$service->save($id,array_replace($body,['version'=>1]),$admin),'Stale administrator updates must fail.');
    $future=$service->save(null,array_replace($body,['title'=>'Future announcement']),$admin);$publish($future,['startsAt'=>gmdate('Y-m-d\TH:i:s\Z',time()+3600)]);$reject(fn()=>$service->claim($future,$one,$uuid()),'Scheduled claims must wait for the start.');
    $scheduled=array_values(array_filter($service->listing()['items'],static fn(array $row):bool=>(int)$row['id']===$future))[0];
    $check($scheduled['visibility']['state']==='scheduled'&&!$scheduled['visibility']['visible'],'Future publication must be labelled Scheduled in admin.');
    $reject(fn()=>$service->detail($future,$one),'A guessed URL must not reveal a scheduled notice before its start.');
    $check($service->forUser($one)['nextChangeAt']!==null,'The user client must receive its next scheduled transition.');
    $db->exec('UPDATE campaigns SET starts_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id='.$future);$service->forUser($one);$service->syncUser($one);
    $check($service->detail($future,$one)['active'],'A scheduled campaign must activate when its start time arrives.');
    $q=$db->prepare('SELECT COUNT(*) FROM user_notifications WHERE user_id=? AND link=?');$q->execute([$one,'/notifications?campaign='.$future]);$check((int)$q->fetchColumn()===1,'Schedule transition sync must create exactly one inbox message.');
    $db->exec('UPDATE campaigns SET ends_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id='.$future);
    $ended=array_values(array_filter($service->listing()['items'],static fn(array $row):bool=>(int)$row['id']===$future))[0];$check($ended['visibility']['state']==='ended','Expired campaigns must be labelled Ended.');
    $check(!$service->detail($future,$one)['active'],'Previously delivered campaign details remain readable after their end.');
    $verified=$service->save(null,array_replace($body,['title'=>'Verified user reward']),$admin);$publish($verified,['audience'=>'verified']);$reject(fn()=>$service->detail($verified,$three),'Unverified users cannot inspect verified-only notices.');$reject(fn()=>$service->claim($verified,$three,$uuid()),'Audience restrictions apply to claims.');
    $plain=$service->save(null,array_replace($body,['title'=>'Message only']),$admin);$publish($plain,['rewardEnabled'=>false]);$check(!$service->detail($plain,$one)['canClaim'],'Message-only notices must have no claim.');$reject(fn()=>$service->claim($plain,$one,$uuid()),'Direct claims cannot bypass disabled rewards.');
    $cap=$service->save(null,array_replace($body,['title'=>'Limited reward']),$admin);$publish($cap,['totalClaimLimit'=>1]);
    $workers=[];foreach([$one,$two] as $uid){$process=proc_open([PHP_BINARY,__FILE__,'--claim',$name,(string)$cap,(string)$uid,$uuid()],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$workers[]=[$process,$pipes];}
    $wins=0;foreach($workers as [$process,$pipes]){$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0,'Concurrent worker failed: '.$error);$wins+=(int)$out;}$check($wins===1,'A campaign cap must hold across concurrent users.');$check((int)$db->query('SELECT claim_count FROM campaigns WHERE id='.$cap)->fetchColumn()===1,'Only one global claim may be recorded.');
    $parallel=$service->save(null,array_replace($body,['title'=>'One claim per account']),$admin);$publish($parallel);$workers=[];foreach([1,2]as$_){$process=proc_open([PHP_BINARY,__FILE__,'--claim',$name,(string)$parallel,(string)$two,$uuid()],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$workers[]=[$process,$pipes];}$wins=0;foreach($workers as[$process,$pipes]){$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0,'Concurrent account worker failed: '.$error);$wins+=(int)$out;}$check($wins===1,'Per-user cap must hold across concurrent requests.');
    $check(AdminAccess::moduleForRoute('/api/admin/campaigns')==='campaigns','Campaign access must use its dedicated permission.');$check(AdminAccess::moduleForRoute('/api/admin/profile')===null,'My profile requires no delegated module grant.');
    $support=new SupportRepository($db);$ticket=$support->create($one,['subject'=>'Closed request fixture','category'=>'technical','body'=>'Please investigate this test request.']);$support->update($ticket,null,$admin,['version'=>1,'status'=>'closed']);
    $reject(fn()=>$support->update($ticket,$one,$one,['version'=>2,'body'=>'User reply blocked.']),'Closed tickets must reject user replies.');$reject(fn()=>$support->update($ticket,null,$admin,['version'=>2,'body'=>'Internal note blocked.','internalNote'=>true]),'Closed tickets must reject admin notes.');$reject(fn()=>$support->update($ticket,null,$admin,['version'=>2,'status'=>'open']),'A generic update cannot reopen a closed request.');$support->reopen($ticket,$admin,2);$check($support->detail($ticket,$one)['ticket']['status']==='open','Explicit administrator reopening must work.');
    for($i=0;$i<22;$i++){$detail=$support->detail($ticket,$one);$support->update($ticket,$one,$one,['version'=>(int)$detail['ticket']['version'],'body'=>'Message pagination fixture '.$i]);}
    $detail=$support->detail($ticket,$one);$check(count($detail['messages'])===20&&$detail['messagePagination']['pages']===2,'Conversation messages must paginate.');$check(count($support->detail($ticket,$one,2)['messages'])===3,'Older conversation messages must remain accessible.');
    $settings=$admins->settings();$admins->updateSettings(array_replace($settings,['aiRenewable'=>false,'aiDefaultLimit'=>2,'aiEnabled'=>true]),$admin);$quota=new AiQuotaService($db);$hold=$quota->consume($three,'assist');$quota->finalize($three,$hold['windowStartedAt'],$hold['reservationToken']);$db->prepare('UPDATE ai_usage_windows SET window_started_at=UNIX_TIMESTAMP()-1000000 WHERE user_id=?')->execute([$three]);$status=$quota->status($three);$check($status['used']===1&&$status['resetAt']===null&&!$status['renewable'],'Fixed allowances must preserve old usage without a reset date.');$hold=$quota->consume($three,'assist');$quota->finalize($three,$hold['windowStartedAt'],$hold['reservationToken']);$check(!$quota->consume($three,'assist')['allowed'],'Fixed allowances must enforce exhaustion.');
    $admins->updateSettings(array_replace($admins->settings(),['aiRenewable'=>true]),$admin);$check((new AiQuotaService($db))->status($three)['used']===0,'Turning renewal on must restore expiry behavior.');
    echo 'Campaign, ticket lifecycle and fixed allowance checks passed ('.$count." assertions).\n";
}finally{$db=null;$server->exec('DROP DATABASE IF EXISTS `'.$name.'`');}
