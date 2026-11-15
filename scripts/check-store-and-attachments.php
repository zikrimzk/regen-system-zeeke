<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require dirname(__DIR__).'/vendor/autoload.php';
use ReGen\{AdminAccess,AdminRepository,BonusCreditService,ConcurrentUpdate,Config,FeaturePricing,SupportAttachments,SupportConfiguration,TokenStore,UserRepository};
Config::load(dirname(__DIR__));
if(!in_array(Config::get('app.env'),['development','test','testing'],true)||!in_array(Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('Use an isolated local development database.');
$connect=static fn(?string $name=null):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').($name?';dbname='.$name:'').';charset=utf8mb4',Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if(($argv[1]??'')==='--buyer'){
    if(!preg_match('/^regen_store_test_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
    if(isset($argv[7]))while(microtime(true)<(float)$argv[7])usleep(1000);
    try{(new FeaturePricing($connect($argv[2])))->purchase((int)$argv[3],$argv[4],(int)$argv[5],$argv[6]);echo 'purchased';}catch(DomainException){echo 'insufficient';}exit;
}
$server=$connect();$name='regen_store_test_'.bin2hex(random_bytes(6));$server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4');$db=null;$files=[];$directories=[];$count=0;
$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
$reject=static function(callable $action,string $message)use($check):void{try{$action();}catch(DomainException|ConcurrentUpdate|OutOfBoundsException){$check(true,$message);return;}$check(false,$message);};
try{
    $db=$connect($name);$db->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));$users=new UserRepository($db);$user=$users->create(['firstName'=>'Token','lastName'=>'Tester','email'=>'tokens@qa.regen.local','password'=>'Fixture-Password-123456']);$id=(int)$user['id'];$admin=(int)(new AdminRepository($db))->findByEmail('admin@regen.com')['id'];
    $wallet=new BonusCreditService($db);$pricing=new FeaturePricing($db);$store=new TokenStore($db);
    $check(count(array_filter($pricing->all(),static fn(array $item):bool=>$item['mode']==='package_only'))===count(FeaturePricing::CATALOGUE),'Every commercial feature starts with strict package access.');
    $db->exec('UPDATE feature_prices SET version=0');
    $package=['name'=>'Room to grow','description'=>'A real fixture package.','tokens'=>50,'bonusTokens'=>5,'priceMinor'=>1900,'currency'=>'MYR','badge'=>'Extra room','highlighted'=>true,'active'=>false,'sortOrder'=>10];
    $packageId=$store->savePackage(null,$package,$admin);$check($store->packages(false)['total']===0,'Draft packages must not leak into the user catalogue.');
    $store->savePackage($packageId,[...$package,'active'=>true,'version'=>1],$admin);$public=$store->packages(false);$check($public['total']===1&&$public['items'][0]['price_minor']===1900&&$public['items'][0]['tokens']===50,'Published package quantities and integer monetary prices persist.');
    $metadata=json_decode((string)$db->query("SELECT metadata FROM audit_logs WHERE event_type='admin.token_package_saved' ORDER BY id DESC LIMIT 1")->fetchColumn(),true);
    $check(($metadata['tokens']??null)===50&&($metadata['bonusTokens']??null)===5,'Audit records retain numeric package quantities without treating them as credentials.');
    $reject(fn()=>$store->savePackage($packageId,[...$package,'version'=>1],$admin),'Stale package edits must be rejected.');
    $reject(fn()=>$store->savePackage(null,[...$package,'tokens'=>-5],$admin),'Negative token packages must be rejected.');
    $reject(fn()=>$store->savePackage(null,[...$package,'currency'=>'BAD'], $admin),'Unsupported currencies must be rejected.');
    for($index=0;$index<13;$index++)$store->savePackage(null,[...$package,'name'=>'Package '.$index,'active'=>true],$admin);
    $check(count($store->packages(false)['items'])===12&&count($store->packages(false,2)['items'])===2,'Token packages paginate on both sides.');
    $policy=$store->policy();$store->savePolicy([...$policy,'enabled'=>false],$admin);$check(!$store->policy()['enabled'],'Store visibility is administrator controlled.');
    $reject(fn()=>$store->savePolicy($policy,$admin),'Store policy edits use revisions.');
    $wallet->adjust($id,30,'Fixture reward','test','fixture-wallet-initial');
    $pricing->save('pdf_download',['mode'=>'per_use','cost'=>5,'version'=>0],$admin);
    $pricing->save('resume_editor',['mode'=>'unlock','cost'=>7,'version'=>0],$admin);
    $before=(int)$db->query('SELECT COALESCE(MAX(id),0) FROM realtime_outbox')->fetchColumn();
    $pricing->purchase($id,'pdf_download',1,'fixture-pdf-access-0001');$check($wallet->balance($id)['balance']===25,'Feature purchases use the permanent wallet.');
    $events=$db->query('SELECT topic,audience,recipient_id FROM realtime_outbox WHERE id>'.$before)->fetchAll();
    $check(count(array_filter($events,static fn(array $event):bool=>$event['topic']==='wallet'&&$event['audience']==='user'&&(int)$event['recipient_id']===$id))===1&&!array_filter($events,static fn(array $event):bool=>$event['audience']==='users'),'A purchase sends one private wallet signal without refreshing all users.');

    $pricing->purchase($id,'pdf_download',1,'fixture-pdf-access-0001');$check($wallet->balance($id)['balance']===25,'Retrying a purchase must not charge twice.');
    $reject(fn()=>$pricing->purchase($id,'resume_editor',1,'fixture-pdf-access-0001'),'A purchase reference cannot be reused for another feature.');
    $reject(fn()=>$pricing->purchase($id,'pdf_download',0,'fixture-pdf-access-stale'),'Stale prices must be reviewed before spending.');
    $reservation=$pricing->reserve($id,['pdf_download']);$check($reservation['allowed']&&count($reservation['reservations'])===1,'An available credit can be reserved.');
    $check(!$pricing->reserve($id,['pdf_download'])['allowed'],'Concurrent actions cannot spend the same credit.');
    $pricing->settle($reservation['reservations'],false);$check($pricing->all($id)['pdf_download']['credits']===1,'An unsuccessful operation returns its unused credit.');
    $again=$pricing->reserve($id,['pdf_download']);$pricing->settle($again['reservations'],true);$check(!$pricing->reserve($id,['pdf_download'])['allowed'],'A successful action consumes exactly one credit.');
    $reject(fn()=>$pricing->refund($id,$again['reservations'][0]['id']),'A used credit cannot be refunded.');
    $pricing->purchase($id,'pdf_download',1,'fixture-pdf-access-0002');$credit=(int)$db->query("SELECT MAX(id) FROM feature_use_credits WHERE state='available'")->fetchColumn();$pricing->refund($id,$credit);$check($wallet->balance($id)['balance']===25,'Returning an unused credit restores its original token amount.');$pricing->refund($id,$credit);$check($wallet->balance($id)['balance']===25,'Duplicate refunds cannot create tokens.');
    $pricing->purchase($id,'resume_editor',1,'fixture-editor-unlock-01');$check($wallet->balance($id)['balance']===18&&$pricing->reserve($id,['resume_editor'])['allowed'],'Permanent unlocks provide lasting access.');
    $pricing->save('resume_editor',['mode'=>'unlock','cost'=>20,'version'=>1],$admin);$check($pricing->reserve($id,['resume_editor'])['allowed'],'Price changes honor previously purchased unlocks.');
    $reject(fn()=>$pricing->save('resume_editor',['mode'=>'per_use','cost'=>5,'version'=>2],$admin),'Automatic editor saves cannot receive per-use pricing.');
    $pricing->purchase($id,'pdf_download',1,'fixture-expired-hold-0001');
    $expired=$pricing->reserve($id,['pdf_download'])['reservations'][0]['id'];
    $db->prepare('UPDATE feature_use_credits SET reserved_until=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id=?')->execute([$expired]);
    $check($store->wallet($id)['credits'][0]['state']==='available','An expired hold is available in the user wallet.');
    $pricing->refund($id,$expired);
    $check($wallet->balance($id)['balance']===18,'An interrupted action can return its unused credit after the hold expires.');
    $pricing->save('photo_upload',['mode'=>'per_use','cost'=>19,'version'=>0],$admin);$reject(fn()=>$pricing->purchase($id,'photo_upload',1,'fixture-no-funds-0001'),'An insufficient balance cannot be overdrawn.');$check($wallet->balance($id)['balance']===18,'Rejected spending leaves the wallet unchanged.');
    $race=$users->create(['firstName'=>'Concurrent','lastName'=>'Buyer','email'=>'race@qa.regen.local','password'=>'Fixture-Password-123456']);$raceId=(int)$race['id'];$wallet->adjust($raceId,5,'Race fixture','test','race-wallet-initial');$pricing->save('photo_upload',['mode'=>'per_use','cost'=>5,'version'=>1],$admin);
    $start=microtime(true)+0.5;$processes=[];foreach(array_merge(...array_fill(0,4,[['pdf_download',1],['photo_upload',2]]))as$index=>[$feature,$version]){$process=proc_open([PHP_BINARY,__FILE__,'--buyer',$name,(string)$raceId,$feature,(string)$version,'race-purchase-ref-000'.$index,(string)$start],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$processes[]=[$process,$pipes];}
    $outcomes=[];$workerResults=[];foreach($processes as[$process,$pipes]){$outcomes[]=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$workerResults[]=[proc_close($process),$error,end($outcomes)];}
    foreach($workerResults as[$exit,$error,$output])$check($exit===0&&$error==='','Concurrent fixture buyer must complete cleanly. Exit '.$exit.'; output '.$output.'; '.$error);
    sort($outcomes);$check($outcomes===[...array_fill(0,7,'insufficient'),'purchased']&&$wallet->balance($raceId)['balance']===0,'Simultaneous purchases cannot overdraw the last tokens.');
    $attachments=new SupportAttachments($db);$config=new SupportConfiguration($db);$check($config->attachmentLimits()['maxFiles']===4,'Support defaults to four attachments per message.');
    $config->saveAttachmentLimits(['maxFiles'=>2,'maxFileBytes'=>1048576,'maxTotalBytes'=>2097152],$admin);$check($config->attachmentLimits()['maxFiles']===2,'Administrators can configure attachment limits.');
    $reject(fn()=>$config->saveAttachmentLimits(['maxFiles'=>99,'maxFileBytes'=>1048576,'maxTotalBytes'=>2097152],$admin),'Attachment counts have a safe upper bound.');
    $folder=dirname(__DIR__).'/tmp';$image=$folder.'/support-fixture-'.bin2hex(random_bytes(4)).'.png';$files[]=$image;$canvas=imagecreatetruecolor(10,10);imagepng($canvas,$image);imagedestroy($canvas);
    $check($attachments->inspect($image,'Screenshot.png',1048576)['mime']==='image/png','Real image content is accepted.');
    $fake=$folder.'/support-fixture-'.bin2hex(random_bytes(4)).'.png';$files[]=$fake;file_put_contents($fake,'<?php echo "not an image";');$reject(fn()=>$attachments->inspect($fake,'Screenshot.png',1048576),'Renaming executable content cannot bypass MIME validation.');
    $svg=$folder.'/support-fixture-'.bin2hex(random_bytes(4)).'.svg';$files[]=$svg;file_put_contents($svg,'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');$reject(fn()=>$attachments->inspect($svg,'Screenshot.svg',1048576),'Active SVG content is not accepted.');
    $pdf=$folder.'/support-fixture-'.bin2hex(random_bytes(4)).'.pdf';$files[]=$pdf;file_put_contents($pdf,"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");$check($attachments->inspect($pdf,'Details.pdf',1048576)['mime']==='application/pdf','PDF attachment content is accepted.');
    // Cleanup tests use a dedicated directory, never another environment's support files.
    $cleanupDirectory=$folder.'/support-cleanup-fixture-'.bin2hex(random_bytes(4));mkdir($cleanupDirectory,0700);$directories[]=$cleanupDirectory;
    $stored=bin2hex(random_bytes(32));$orphan=bin2hex(random_bytes(32));$recent=bin2hex(random_bytes(32));
    foreach([$stored,$orphan,$recent]as$key){$files[]=$cleanupDirectory.'/'.$key;file_put_contents($cleanupDirectory.'/'.$key,'fixture');}
    touch($cleanupDirectory.'/'.$stored,time()-172800);touch($cleanupDirectory.'/'.$orphan,time()-172800);$files[]=$cleanupDirectory.'/.cleanup-state';
    $ticket=(new ReGen\SupportRepository($db))->create($id,['subject'=>'Private attachment fixture','body'=>'A fictional attachment for cleanup verification.','category'=>'technical']);
    $message=(int)$db->query('SELECT MAX(id) FROM support_messages')->fetchColumn();$cleanup=new SupportAttachments($db,$cleanupDirectory);
    $cleanup->attach([['key'=>$stored,'filename'=>'Kept.png','mime'=>'image/png','size'=>7]],$ticket,$message,$id);
    $check($cleanup->prune()===1&&!is_file($cleanupDirectory.'/'.$orphan),'The worker removes an old unreferenced file.');
    $check(is_file($cleanupDirectory.'/'.$stored)&&is_file($cleanupDirectory.'/'.$recent),'Referenced files and recent uploads survive cleanup.');
    $check($cleanup->prune()===0,'Daily cleanup is guarded against repeated cron execution.');
    $access=new AdminAccess($db);$delegate=(new AdminRepository($db))->createAdmin(['firstName'=>'Store','lastName'=>'Reader','email'=>'store-reader@qa.regen.local','password'=>'Fixture-Password-123456','role'=>'admin']);$actor=(new AdminRepository($db))->findById($delegate);
    $check(!$access->allows($actor,'/api/admin/store','GET'),'Delegated administrators receive no store access by default.');
    $access->assign($delegate,['capabilities'=>['pricing.view'],'purpose'=>'Review published package settings.','version'=>0],$admin);$check($access->allows($actor,'/api/admin/store','GET')&&!$access->allows($actor,'/api/admin/store/packages','POST'),'Read access does not permit package or price changes.');
    $check(in_array('pricing.manage',AdminAccess::catalogue(),true),'The unified pricing module has an assignable management permission.');
    echo "Token catalogue, permanent spending, retries, refunds, concurrency, file validation and delegated access passed ($count assertions; isolated database).\n";
}finally{foreach($files as$file)if(is_file($file))unlink($file);foreach($directories as$directory)if(is_dir($directory))rmdir($directory);if($db&&$db->inTransaction())$db->rollBack();$server->exec('DROP DATABASE `'.$name.'`');}
