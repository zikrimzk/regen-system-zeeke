<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/vendor/autoload.php';
use ReGen\{AdminAccess,AdminRepository,Config,ConcurrentUpdate,ResumeRepository,TemplateCatalog,TemplateManagement,UserRepository};
Config::load(dirname(__DIR__));
if(!in_array(Config::get('app.env'),['development','testing','test'],true)||!in_array(Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('Use a local development configuration.');
$connect=static fn(?string $name=null):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').($name?';dbname='.$name:'').';charset=utf8mb4',(string)Config::get('db.user'),(string)Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
if(($argv[1]??'')==='--hide'){
 if(!preg_match('/^regen_template_test_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
 try{(new TemplateManagement($connect($argv[2])))->update($argv[3],['visible'=>false,'popular'=>false,'sortOrder'=>10,'version'=>1],(int)$argv[4]);echo '1';}catch(DomainException){echo '0';}exit;
}
$server=$connect();$name='regen_template_test_'.bin2hex(random_bytes(6));$server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');$checks=0;
$check=static function(bool $ok,string $message)use(&$checks){$checks++;if(!$ok)throw new RuntimeException($message);};
try{
 $db=$connect($name);$db->exec("SET time_zone='+00:00'");$schema=file_get_contents(dirname(__DIR__).'/database/schema.sql');$start=strpos($schema,'-- Apply once after 012.');if($start===false)throw new RuntimeException('Missing migration boundary.');$db->exec(substr($schema,0,$start));
 $admins=new AdminRepository($db);$owner=(int)$admins->findByEmail('admin@regen.com')['id'];$delegate=$admins->createAdmin(['firstName'=>'Upgrade','lastName'=>'Reader','email'=>'upgrade@qa.regen.local','password'=>'Local-Test-Password-123','role'=>'admin']);$db->prepare("INSERT INTO admin_permissions (admin_id,module) VALUES (?,'users'),(?,'audit')")->execute([$delegate,$delegate]);
 $users=new UserRepository($db);$user=$users->create(['firstName'=>'Template','lastName'=>'Tester','email'=>'templates@qa.regen.local','password'=>'Local-Test-Password-123']);$uid=(int)$user['id'];$db->prepare('INSERT INTO resumes (user_id,title,resume_data) VALUES (?,?,?)')->execute([$uid,'Pre-upgrade resume',json_encode(TemplateCatalog::sample('classic'))]);$rid=(int)$db->lastInsertId();$db->prepare('INSERT INTO notification_preferences (user_id,account_email,support_email,announcement_email) VALUES (?,1,0,0)')->execute([$uid]);
 $db->exec(substr($schema,$start));$db->exec("UPDATE feature_prices SET mode='free',token_cost=0 WHERE feature_key='templates'");$management=new TemplateManagement($db);$access=new AdminAccess($db);$caps=$access->capabilities($admins->findById($delegate));
 $check(in_array('users.view',$caps,true)&&in_array('users.manage',$caps,true)&&in_array('audit.view',$caps,true)&&!in_array('users.export',$caps,true),'Upgrade preserves prior operational grants without granting exports.');
 $check((int)$db->query('SELECT account_email FROM notification_preferences')->fetchColumn()===0 && (int)$db->query('SELECT security_email FROM notification_preferences')->fetchColumn()===0,'Upgrade does not treat legacy email defaults as explicit consent.');
 $items=$management->report();$classic=array_values(array_filter($items,static fn($t)=>$t['id']==='classic'))[0];$check($classic['currentUsers']===1&&$classic['recordedUsers']===1,'Upgrade backfills current adoption.');
 $management->update('modern',['visible'=>true,'popular'=>true,'sortOrder'=>1,'version'=>1],$owner);$check($management->catalogue()[0]['id']==='modern'&&$management->catalogue()[0]['popular'],'Badge and sort order reach customer catalogue.');
 try{$management->update('modern',['visible'=>false,'popular'=>false,'sortOrder'=>1,'version'=>1],$owner);$check(false,'Stale template edit accepted.');}catch(ConcurrentUpdate){$check(true,'Stale template edits are rejected.');}
 $repo=new ResumeRepository($db);$repo->saveSection($rid,$uid,'templateId','modern');$modern=array_values(array_filter($management->report(),static fn($t)=>$t['id']==='modern'))[0];$check($modern['currentUsers']===1&&$modern['recordedUsers']===1,'Changing design updates current and recorded usage.');
 $repo->saveSection($rid,$uid,'templateId','modern');$check((int)$db->query("SELECT COUNT(*) FROM template_selection_events WHERE template_id='modern'")->fetchColumn()===1,'Repeated saves do not inflate adoption events.');
 $management->update('modern',['visible'=>false,'popular'=>true,'sortOrder'=>1,'version'=>2],$owner);$check(!$management->selectable('modern')&&!in_array('modern',array_column($management->catalogue(),'id'),true),'Hidden designs cannot be selected or listed.');
 $saved=$repo->getById($rid,$uid);$check(str_contains(ReGen\ResumeTemplate::buildHtml($saved['resume_data']),'Zamir'),'Hidden designs remain renderable for existing resumes.');
 try{$repo->saveSection($rid,$uid,'templateId','modern');$check(false,'Hidden template selected.');}catch(DomainException){$check(true,'Repository also enforces availability.');}
 $check(!$access->allows($admins->findById($delegate),'/api/admin/templates','GET'),'Template management requires its own assigned module.');
 $db->exec("UPDATE template_controls SET visible=0,version=1");$db->exec("UPDATE template_controls SET visible=1 WHERE template_id IN ('classic','modern')");
 $jobs=[];foreach(['classic','modern'] as $id){$pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'--hide',$name,$id,(string)$owner],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$jobs[]=[$process,$pipes];}
 $hidden=0;foreach($jobs as [$process,$pipes]){$output=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0&&$errors==='','Concurrent template update failed.');$hidden+=(int)$output;}
 $check($hidden===1&&(int)$db->query('SELECT COUNT(*) FROM template_controls WHERE visible=1')->fetchColumn()===1,'Concurrent changes cannot hide the last available design.');
 echo "Template visibility, adoption, badges, concurrent edits and migration preservation passed ($checks assertions; isolated database).\n";
}finally{$db=null;if(!preg_match('/^regen_template_test_[a-f0-9]{12}$/D',$name))throw new RuntimeException('Unsafe cleanup target.');$server->exec('DROP DATABASE `'.$name.'`');}
