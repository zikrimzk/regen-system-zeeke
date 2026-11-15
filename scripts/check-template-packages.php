<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';require __DIR__.'/fixtures/StoreHttpFixture.php';
use ReGen\{AiQuotaService,BonusCreditService,Config,DocumentWriteGuard,FeaturePricing,Http,PackageAccess,ResumeRepository,TemplateAccess,TemplateAccessDenied,TokenStore};
Config::load($root);
$connect=static fn(string $name):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$name.';charset=utf8mb4',Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if(($argv[1]??'')==='--worker'){
    if(!preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
    try{(new ResumeRepository($connect($argv[2])))->saveSection((int)$argv[4],(int)$argv[3],'templateId',$argv[5]);echo '1';}catch(TemplateAccessDenied){echo '0';}exit;
}
$fixture=new StoreHttpFixture($root);$count=0;
$check=static function(bool $condition,string $message)use(&$count):void{$count++;if(!$condition)throw new RuntimeException($message);};
$reject=static function(callable $fn,string $message)use($check):void{try{$fn();$check(false,$message);}catch(DomainException){$check(true,$message);}};
try{
    $f=$fixture->start();$db=$connect($f['database']);$user=$f['userId'];$rid=$f['resumeId'];$admin=(int)$db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();$other=(int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();
    $pricing=new FeaturePricing($db);$store=new TokenStore($db);$packages=new PackageAccess($db);$templates=new TemplateAccess($db);$repo=new ResumeRepository($db);$wallet=new BonusCreditService($db);$before=$wallet->balance($user)['balance'];
    $pricing->save('templates',['mode'=>'package_only','cost'=>0,'version'=>1],$admin);
    $db->prepare("INSERT IGNORE INTO user_template_library (user_id,template_id) VALUES (?,'classic')")->execute([$user]);
    $base=['name'=>'Basic collection','description'=>'A QA package.','tokens'=>0,'bonusTokens'=>0,'priceMinor'=>3000,'currency'=>'MYR','badge'=>'','highlighted'=>false,'active'=>true,'sortOrder'=>1,'validityDays'=>30,'features'=>['templates'=>2,'ai_assist'=>null,'pdf_download'=>null],'templateTiers'=>['basic']];
    $id=$store->savePackage(null,$base,$admin);$grant=$packages->grant($id,['userId'=>$user,'version'=>1,'reference'=>'qa-template-basic-grant','reason'=>'Distinct template verification'],$admin);
    $jar=$fixture->directory.'/template-security.cookies';
    $call=static function(string $path,string $method='GET',?array $body=null,string $csrf='')use($fixture,$jar):array{
        $handle=curl_init($fixture->base.$path);$headers=['Accept: application/json'];if($body!==null)$headers[]='Content-Type: application/json';if($csrf!=='')$headers[]='X-CSRF-Token: '.$csrf;
        curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_TIMEOUT=>20,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers]);if($body!==null)curl_setopt($handle,CURLOPT_POSTFIELDS,json_encode($body));
        $raw=(string)curl_exec($handle);$size=curl_getinfo($handle,CURLINFO_HEADER_SIZE);$status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);curl_setopt($handle,CURLOPT_COOKIELIST,'FLUSH');unset($handle);return ['status'=>$status,'headers'=>substr($raw,0,$size),'body'=>substr($raw,$size),'json'=>json_decode(substr($raw,$size),true)??[]];
    };
    $check($call('/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890'])['status']===200,'HTTP security test account signs in.');$csrf=$call('/api/auth/me')['json']['csrfToken'];
    $forged=$call('/api/resume/'.$rid.'/section','POST',['section'=>'templateId','data'=>'executive','userId'=>$other,'unlimited'=>true,'templateTiers'=>['premium'],'cost'=>0],$csrf);
    $check($forged['status']===403&&$forged['json']['code']==='TEMPLATE_PACKAGE_REQUIRED','Forged client eligibility, price and ownership cannot select Premium.');
    $fakeDraft=ReGen\TemplateCatalog::sample('executive');
    $check($call('/api/pdf/'.$rid.'/document','POST',['resumeData'=>$fakeDraft],$csrf)['status']===403,'Draft PDF requests cannot bypass template application and unlocks.');
    $check($call('/api/pdf/'.$rid.'/preview-data','POST',['resumeData'=>$fakeDraft],$csrf)['status']===403,'Legacy preview routes enforce the same template restriction.');
    $preview=$call('/api/pdf/'.$rid.'/document');$download=$call('/api/pdf/'.$rid.'/generate');
    $check($preview['status']===200&&$download['status']===200&&str_starts_with($preview['body'],'%PDF-')&&hash('sha256',$preview['body'])!==hash('sha256',$download['body']),'Private previews and clean paid exports are different artifacts.');
    $check($call('/api/pdf/'.$rid.'/preview')['status']===302,'Legacy HTML previews do not expose a clean printable document.');
    $letter=$call('/api/cover-letters','POST',['company'=>'Example Company','role'=>'Analyst','body'=>'A fictional application letter.'],$csrf);$letterId=(int)($letter['json']['data']['id']??0);
    $letterPreview=$call('/api/cover-letters/'.$letterId.'/document');$letterDownload=$call('/api/cover-letters/'.$letterId.'/pdf');
    $check($letterId>0&&$letterPreview['status']===200&&$letterDownload['status']===200&&hash('sha256',$letterPreview['body'])!==hash('sha256',$letterDownload['body']),'Cover-letter previews cannot substitute for clean exports either: '.json_encode([$letter['status'],$letter['json'],$letterPreview['status'],$letterPreview['json'],$letterDownload['status'],$letterDownload['json']]));
    $check($call('/api/cover-letters/'.$letterId.'/preview')['status']===302,'The legacy letter preview follows the protected PDF path.');
    $access=$templates->catalogue($user,'classic');$check($access['items']['modern']['allowed']&&!$access['items']['executive']['allowed'],'Basic packages permit Basic templates and deny Premium.');
    $reject(fn()=>$repo->saveSection($rid,$user,'templateId','executive'),'Direct repository writes cannot bypass package tiers.');
    $check($repo->getById($rid,$user)['resume_data']['templateId']==='classic'&&$wallet->balance($user)['balance']===$before,'Denied selection preserves the resume and wallet.');
    $repo->saveSection($rid,$user,'templateId','modern');$repo->saveSection($rid,$user,'templateId','classic');$repo->saveSection($rid,$user,'templateId','modern');
    $check($templates->catalogue($user,'modern')['packages'][0]['remaining']===1,'Switching between owned templates does not consume another distinct unlock.');
    $repo->saveSection($rid,$user,'templateId','minimal');$access=$templates->catalogue($user,'minimal');
    $check($access['packages'][0]['remaining']===0&&$access['items']['modern']['allowed']&&!$access['items']['heritage']['allowed'],'Exhausted packages retain unlocked choices and deny new ones.');
    $reject(fn()=>$repo->saveSection($rid,$user,'templateId','heritage'),'A forged direct selection cannot exceed the distinct unlock limit.');
    $check(!$templates->catalogue($other)['items']['modern']['allowed'],'Another account does not inherit template ownership.');
    $price=$pricing->all($user);$check($price['ai_assist']['packageUnlimited']&&$price['pdf_download']['packageUnlimited'],'Unlimited AI and download benefits are clearly represented.');
    $quota=new AiQuotaService($db);$initial=$quota->status($user);
    for($i=0;$i<5;$i++){$use=$quota->consume($user,'assist');$check($use['allowed']&&$use['cost']===0,'Unlimited AI remains available without charging tokens.');$pricing->settle([$use['benefitReservation']],true);}
    $after=$quota->status($user);$check($after['baseRemaining']===$initial['baseRemaining']&&$wallet->balance($user)['balance']===$before,'Unlimited usage leaves both token balances intact.');
    $one=$pricing->reserve($user,['pdf_download']);$two=$pricing->reserve($user,['pdf_download']);$check($one['allowed']&&$two['allowed'],'Unlimited benefits support concurrent reservations.');$pricing->settle($one['reservations'],true);$pricing->settle($two['reservations'],true);
    $check(count(array_filter($store->activity($user)['ledger'],fn($row)=>$row['bucket']==='package'))>=7,'Unlimited actions remain recorded in token activity.');
    $store->savePackage($id,[...$base,'version'=>1,'features'=>['templates'=>99],'templateTiers'=>['basic','premium']],$admin);
    $check(!$templates->catalogue($user)['items']['executive']['allowed']&&$templates->catalogue($user)['packages'][0]['limit']===2,'Catalogue edits cannot expand existing grant snapshots.');
    $db->prepare('UPDATE package_grants SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=?')->execute([$grant]);
    $check(!$templates->catalogue($user,'minimal')['items']['modern']['allowed'],'Expired package rights cannot unlock a different design.');
    $repo->saveSection($rid,$user,'summary','An ordinary edit after expiry.');$check($repo->getById($rid,$user)['resume_data']['templateId']==='minimal','Expiry does not remove an existing document design.');
    $reject(fn()=>$repo->saveSection($rid,$user,'templateId','classic'),'A strict rule requires an active collection even for a pre-upgrade owned design.');
    $premium=$store->savePackage(null,[...$base,'name'=>'Premium collection','features'=>['templates'=>1],'templateTiers'=>['premium']],$admin);
    $packages->grant($premium,['userId'=>$user,'version'=>1,'reference'=>'qa-template-premium-grant','reason'=>'Concurrent distinct unlock verification'],$admin);
    $jobs=[];foreach(['executive','horizon'] as $target){$process=proc_open([PHP_BINARY,__FILE__,'--worker',$f['database'],(string)$user,(string)$rid,$target],[1=>['pipe','w'],2=>['pipe','w']],$pipes,$root);$jobs[]=[$process,$pipes];}
    $successes=0;foreach($jobs as [$process,$pipes]){$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0&&$error==='','Concurrent template worker completed.');$successes+=(int)$out;}
    $check($successes===1,'Only one competing request obtains the final distinct template unlock.');
    $unlimited=$store->savePackage(null,[...$base,'name'=>'Both collections','features'=>['templates'=>null],'templateTiers'=>['basic','premium']],$admin);
    $packages->grant($unlimited,['userId'=>$user,'version'=>1,'reference'=>'qa-template-unlimited-grant','reason'=>'Unlimited collection verification'],$admin);
    foreach(['heritage','essential','graduate','atlas','meridian'] as $target)$repo->saveSection($rid,$user,'templateId',$target);
    $check($templates->catalogue($user)['items']['executive']['allowed']&&$templates->catalogue($user)['items']['minimal']['allowed'],'Unlimited access supports both configured collections.');
    $reject(fn()=>$store->savePackage(null,[...$base,'templateTiers'=>['admin']],$admin),'Unsupported template tiers are rejected.');
    $reject(fn()=>$store->savePackage(null,[...$base,'features'=>['ai_assist'=>-1]],$admin),'Unlimited is explicit null, never a negative or forged quantity.');
    $reject(fn()=>$pricing->purchase($other,'templates',$pricing->all()['templates']['version'],'qa-cannot-buy-package-only'),'Package-only access cannot be forged as a zero-cost token purchase.');
    $basicUnlimited=$store->savePackage(null,[...$base,'features'=>['templates'=>null]],$admin);
    $packages->grant($basicUnlimited,['userId'=>$other,'version'=>1,'reference'=>'qa-template-basic-unlimited','reason'=>'Basic-only gallery fallback verification'],$admin);
    $q=$db->prepare('SELECT * FROM users WHERE id=?');$q->execute([$other]);$otherResume=$repo->getOrCreatePrimary($other,$q->fetch(),'QA resume','classic');
    $pricing->save('templates',['mode'=>'unlock','cost'=>4,'version'=>$pricing->all()['templates']['version']],$admin);
    $check($templates->catalogue($other)['items']['executive']['state']==='individual_unlock','Unlimited Basic access does not incorrectly include Premium.');
    $call('/api/auth/login','POST',['email'=>'other@qa.regen.local','password'=>'Qa-Other-567890']);$otherCsrf=$call('/api/auth/me')['json']['csrfToken'];
    $galleryGate=$call('/api/resume/'.$otherResume['id'].'/section','POST',['section'=>'templateId','data'=>'executive'],$otherCsrf);
    $check($galleryGate['status']===402&&$galleryGate['json']['ignorePackageBenefits']===true,'The gallery purchase review cannot be skipped by an unrelated unlimited package.');
    $reject(fn()=>$pricing->purchase($other,'templates',$pricing->all()['templates']['version'],'qa-gallery-insufficient-funds'),'Insufficient saved tokens cannot unlock a gallery.');
    $wallet->adjust($other,10,'Fictional security test balance','admin_adjustment','qa-template-security-wallet',$admin);
    $otherBalance=$wallet->balance($other)['balance'];$pricing->purchase($other,'templates',$pricing->all()['templates']['version'],'qa-lifetime-gallery-unlock');
    $repo->saveSection($otherResume['id'],$other,'templateId','executive');
    $check($wallet->balance($other)['balance']===$otherBalance-4&&$templates->catalogue($other)['items']['horizon']['allowed'],'An explicit individual gallery unlock is charged once and includes both collections.');
    $pricing->save('templates',['mode'=>'package_only','cost'=>0,'version'=>$pricing->all()['templates']['version']],$admin);
    $check(!$templates->catalogue($other)['items']['horizon']['allowed'],'Strict access cannot be bypassed by an old individual gallery unlock outside the active collection.');
    $pricing->save('photo_upload',['mode'=>'per_use','cost'=>1,'version'=>0],$admin);$pricing->purchase($user,'photo_upload',1,'qa-credit-settlement-001');$old=$pricing->reserve($user,['photo_upload'])['reservations'];$db->prepare('UPDATE feature_use_credits SET reserved_until=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=?')->execute([$old[0]['id']]);$fresh=$pricing->reserve($user,['photo_upload'])['reservations'];
    $sent=false;Http::onSuccess(fn()=>$pricing->settle($old,true));try{Http::completeSuccess();$sent=true;}catch(DomainException){}$check(!$sent,'An expired or replaced reservation cannot release a successful result.');
    $pricing->settle($fresh,true);$pricing->settle($fresh,true);$reject(fn()=>$pricing->refund($user,$fresh[0]['id']),'A fulfilled credit cannot be refunded or replayed.');
    echo "Unlimited benefits, distinct template ownership, tiers, expiry, concurrency and token fulfillment checks passed ($count assertions; disposable database).\n";
}finally{$fixture->close();}
