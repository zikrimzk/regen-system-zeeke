<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/vendor/autoload.php';

// Run only against the isolated localhost visual fixture, never a deployed installation.
$base=getenv('REGEN_HTTP_TEST_BASE')?:'http://127.0.0.1:8099';$root=dirname(__DIR__);$folder=$root.'/tmp/live-http';
if(!in_array($base,['http://127.0.0.1:8098','http://127.0.0.1:8099'],true))throw new RuntimeException('Only the isolated localhost fixture is allowed.');
if(($argv[1]??'')==='--watch'){
    $jar=$argv[2];$trace=$argv[3];$since=(int)$argv[4];$until=microtime(true)+30;
    do{
        $handle=curl_init($base.'/api/realtime/changes?since='.$since);
        curl_setopt_array($handle,[CURLOPT_COOKIEFILE=>$jar,CURLOPT_TIMEOUT=>5,CURLOPT_RETURNTRANSFER=>true]);$raw=curl_exec($handle);unset($handle);$batch=json_decode((string)$raw,true);
        if(isset($batch['events'])){
            $records=[['name'=>'ready','data'=>[]],['name'=>'maintenance','data'=>$batch['maintenance']]];
            foreach($batch['events']as$event)$records[]=['name'=>'change','data'=>$event];
            foreach($records as$record)file_put_contents($trace,json_encode(['at'=>microtime(true),...$record])."\n",FILE_APPEND|LOCK_EX);
            $since=(int)$batch['cursor'];
        }
        usleep(250000); // Test observers only; the production client uses adaptive intervals.
    }while(microtime(true)<$until);
    exit;
}
$fixture=json_decode((string)file_get_contents($root.'/tmp/admin-qa-fixture.json'),true);
if(!preg_match('/^regen_admin_test_[a-f0-9]{12}$/D',$fixture['database']??''))throw new RuntimeException('Create an isolated fixture first.');
$count=0;$children=[];
$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
$call=static function(string $role,string $path,string $method='GET',?array $body=null,?string $csrf=null)use($base,$folder):array{
    $h=curl_init($base.$path);$headers=['Accept: application/json'];if($body!==null)$headers[]='Content-Type: application/json';if($csrf)$headers[]='X-CSRF-Token: '.$csrf;
    curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_COOKIEFILE=>$folder.'/'.$role.'.cookies',CURLOPT_COOKIEJAR=>$folder.'/'.$role.'.cookies',CURLOPT_HTTPHEADER=>$headers,CURLOPT_CUSTOMREQUEST=>$method]);
    if($body!==null)curl_setopt($h,CURLOPT_POSTFIELDS,json_encode($body));$raw=curl_exec($h);$status=curl_getinfo($h,CURLINFO_RESPONSE_CODE);curl_setopt($h,CURLOPT_COOKIELIST,'FLUSH');unset($h);
    return ['status'=>$status,'raw'=>$raw,'data'=>json_decode((string)$raw,true)??[]];
};
$wait=static function(callable $condition,string $message,int $seconds=5):void{$until=microtime(true)+$seconds;do{if($condition())return;usleep(100000);}while(microtime(true)<$until);throw new RuntimeException($message);};
$trace=static function(string $role)use($folder):array{return array_values(array_filter(array_map(static fn($line)=>json_decode($line,true),is_file($folder.'/'.$role.'.ndjson')?file($folder.'/'.$role.'.ndjson',FILE_IGNORE_NEW_LINES):[])));};
$received=static fn(string $role,string $topic,float $after):bool=>count(array_filter($trace($role),static fn($row)=>$row['at']>=$after&&$row['name']==='change'&&($row['data']['topic']??'')===$topic))>0;
try{
    foreach(['user','admin','second','delegate','anonymous']as$role){foreach(['.cookies','.ndjson']as$ext)if(is_file($folder.'/'.$role.$ext))unlink($folder.'/'.$role.$ext);}
    $check($call('anonymous','/api/realtime/events')['status']===401,'Anonymous event streams must be rejected.');
    $check($call('user','/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890'])['status']===200,'Fixture user sign-in failed.');
    foreach(['admin'=>'jamie@qa.regen.local','second'=>'casey@qa.regen.local']as$role=>$email)$check($call($role,'/api/admin/auth/login','POST',['email'=>$email,'password'=>'Qa-Admin-567891'])['status']===200,'Fixture admin sign-in failed.');
    $userToken=$call('user','/api/auth/me')['data']['csrfToken'];$adminToken=$call('admin','/api/admin/me')['data']['csrfToken'];
    $check($call('admin','/api/realtime/events')['status']===410,'Legacy PHP-held streams must fail immediately without occupying a worker.');
    $check($call('admin','/api/realtime/session')['data']['transport']==='poll','The unconfigured fixture must choose nonblocking updates.');
    $check($call('admin','/api/admin/session/active','POST',[])['status']===403,'Activity heartbeats must require CSRF.');
    $check($call('admin','/api/admin/session/active','POST',[],$adminToken)['status']===200,'Authenticated activity heartbeat must remain available without extra module access.');
    foreach(['admin','second','user']as$role){
        $cursor=$call($role,'/api/realtime/session')['data']['cursor'];
        $process=proc_open([PHP_BINARY,__FILE__,'--watch',$folder.'/'.$role.'.cookies',$folder.'/'.$role.'.ndjson',(string)$cursor],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
        $children[]=[$process,$pipes];
        $wait(static fn()=>count(array_filter($trace($role),static fn($row)=>$row['name']==='ready'))>0,'The short update endpoint did not respond.');
    }
    $at=microtime(true);$body=['title'=>'Live announcement verification','body'=>'An actual HTTP announcement for the isolated verification run.','color'=>'blue','audience'=>'all','status'=>'draft','rewardEnabled'=>false,'rewardAmount'=>5,'rewardLimit'=>1,'totalClaimLimit'=>0];
    $created=$call('admin','/api/admin/campaigns','POST',$body,$adminToken);$id=$created['data']['id']??0;$check($created['status']===201,'Draft must save through the real API.');
    $check($call('admin','/api/admin/campaigns/'.$id,'PUT',[...$body,'status'=>'active','version'=>1],$adminToken)['status']===200,'Campaign must publish through the real API.');
    $wait(fn()=>$received('user','campaigns',$at),'Connected user did not receive the campaign event.');
    $wait(fn()=>$received('second','campaigns',$at),'Second administrator did not receive the campaign event.');$check(true,'Both audiences receive campaign events.');
    $campaigns=$call('user','/api/campaigns');$check(in_array($id,array_column($campaigns['data']['items'],'id'),true),'Published campaign must be in the real dashboard API.');
    $inbox=$call('user','/api/notifications');$check(in_array($body['title'],array_column($inbox['data']['items'],'title'),true),'Campaign must persist in the notification inbox.');
    $before=$call('admin','/api/admin/work-queues')['data']['counts']['support'];$at=microtime(true);
    $created=$call('user','/api/support/tickets','POST',['subject'=>'Live support verification','category'=>'technical','body'=>'Please verify the live support conversation in this isolated test.'],$userToken);$ticket=(int)($created['data']['id']??0);$check($created['status']===201,'User must create a real support ticket.');
    $wait(fn()=>$received('admin','support',$at),'Admin did not receive new support work.');$check($call('admin','/api/admin/work-queues')['data']['counts']['support']===$before+1,'Pending staff work count must increase.');
    $detail=$call('admin','/api/admin/tickets/'.$ticket)['data'];$at=microtime(true);
    $check($call('admin','/api/admin/tickets/'.$ticket,'PATCH',['version'=>(int)$detail['ticket']['version'],'status'=>'waiting_user','body'=>'We received your request and are checking the details.'],$adminToken)['status']===200,'Admin reply must save.');
    $wait(fn()=>$received('user','support',$at),'User did not receive a live conversation update.');
    $detail=$call('user','/api/support/tickets/'.$ticket)['data'];$check($detail['ticket']['status']==='waiting_user'&&count($detail['messages'])===2,'Conversation and status must reflect the actual reply.');
    $check($call('admin','/api/admin/work-queues')['data']['counts']['support']===$before,'Waiting for a user must leave the staff queue.');
    $at=microtime(true);$check($call('user','/api/support/tickets/'.$ticket,'PATCH',['version'=>(int)$detail['ticket']['version'],'body'=>'Thank you. This is the next user reply in the live test.'],$userToken)['status']===200,'User reply must save.');
    $wait(fn()=>$received('admin','alerts',$at),'User reply did not notify administrators.');$check($call('admin','/api/admin/work-queues')['data']['counts']['support']===$before+1,'User reply must return to the staff queue.');
    $check($call('user','/api/admin/templates/classic/resumes')['status']===401,'User sessions must not access the private admin viewer.');
    $usage=$call('admin','/api/admin/templates/classic/resumes');$check($usage['status']===200&&!empty($usage['data']['items']),'Authorized administrator must see actual saved records.');
    $resume=$usage['data']['items'][0]['id'];$check($call('admin','/api/admin/templates/classic/resumes/'.$resume.'/preview')['status']===200,'Actual saved resume HTML must render.');
    $pdf=$call('admin','/api/admin/templates/classic/resumes/'.$resume.'/pdf');$check($pdf['status']===200&&str_starts_with($pdf['raw'],'%PDF-'),'Private saved resume PDF must use the real export renderer.');
    $audit=$call('admin','/api/admin/audit/search?event=admin.resume_viewed');$check(($audit['data']['total']??0)>=2,'Private content views must be recorded for audit.');
    $check($call('delegate','/api/admin/auth/login','POST',['email'=>'agent@qa.regen.local','password'=>'Qa-Agent-567890'])['status']===200,'Delegated fixture admin must sign in.');
    $check($call('delegate','/api/admin/templates/classic/resumes')['status']===403,'Delegates without the separate resume grant must be denied.');
    $check($call('admin','/api/admin/templates/modern/resumes/'.$resume.'/preview')['status']===404,'Modified template URL must reject a mismatched record.');
    $state=$call('admin','/api/admin/maintenance')['data']['maintenance'];$now=time();
    $maintenance=['mode'=>'scheduled','title'=>'We are taking care of ReGen.','message'=>'This is an isolated maintenance verification. Your work remains saved.','startsAt'=>gmdate('Y-m-d\TH:i:s\Z',$now+3),'endsAt'=>gmdate('Y-m-d\TH:i:s\Z',$now+9),'estimatedAt'=>null,'version'=>$state['version']];
    $check($call('admin','/api/admin/maintenance','PUT',$maintenance,$adminToken)['status']===200,'Maintenance must schedule through the API.');
    $wait(fn()=>($call('anonymous','/api/system/status')['data']['maintenance']['active']??false),'Scheduled maintenance did not activate.',5);
    foreach(['/dashboard','/builder','/cover-letters','/support','/notifications','/profile','/api/dashboard','/api/notifications','/api/support/tickets']as$path)$check($call('user',$path)['status']===503,'Maintenance bypass at '.$path);
    $check($call('user','/api/support/tickets','POST',['subject'=>'Blocked request','body'=>'This action must not succeed.','category'=>'technical'],$userToken)['status']===503,'Maintenance must reject direct mutations.');
    $check($call('admin','/admin')['status']===200&&$call('admin','/api/admin/maintenance')['status']===200,'Admin management must remain accessible.');
    $check($call('anonymous','/api/health')['status']===200,'Essential health checks must remain accessible.');
    $wait(fn()=>!($call('anonymous','/api/system/status')['data']['maintenance']['active']??true),'Scheduled maintenance did not end.',12);
    $check($call('user','/dashboard')['status']===200,'Existing user session must regain access after the end.');
    $check(count(array_filter($trace('user'),static fn($row)=>$row['name']==='maintenance'&&($row['data']['active']??false)))>0,'An already connected user must receive the active maintenance state.');
    $poll=$call('user','/api/realtime/changes?since=0');$check($poll['status']===200&&isset($poll['data']['events'],$poll['data']['cursor']),'The authenticated recovery endpoint must return real replay data.');
    echo "Nonblocking HTTP delivery, two administrators, support queues, resume privacy and scheduled maintenance passed ($count assertions; isolated fixture, no external delivery).\n";
}finally{
    foreach($children as[$process,$pipes]){if(is_resource($process)){proc_terminate($process);foreach($pipes as$pipe)fclose($pipe);proc_close($process);}}
}
