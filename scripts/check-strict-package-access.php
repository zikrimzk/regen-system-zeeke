<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';require __DIR__.'/fixtures/StoreHttpFixture.php';
use ReGen\{AccountPackages,AiQuotaService,BonusCreditService,Config,CoverLetterRepository,FeaturePricing,PackageAccess,TemplateAccess,TokenStore};
Config::load($root);
$connect=static fn(string $name):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$name.';charset=utf8mb4',Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if(($argv[1]??'')==='--reserve'){
 if(!preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
 $db=$connect($argv[2]);$prices=new FeaturePricing($db);$held=$prices->reserve((int)$argv[3],['pdf_download']);if($held['allowed'])$prices->settle($held['reservations'],true);echo $held['allowed']?'1':'0';exit;
}
$fixture=new StoreHttpFixture($root);$count=0;
$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
try{
 $f=$fixture->start();$db=$connect($f['database']);$user=$f['userId'];$other=(int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();$admin=(int)$db->query('SELECT MIN(id) FROM admins')->fetchColumn();
 $db->exec("UPDATE feature_prices SET mode='package_only',token_cost=0,version=version+1");
 $pricing=new FeaturePricing($db);$packages=new PackageAccess($db);$store=new TokenStore($db);$manager=new AccountPackages($db);$wallet=new BonusCreditService($db);
 $check(count(array_filter($pricing->all($user),fn($p)=>$p['mode']==='package_only'))===count(FeaturePricing::CATALOGUE),'Every commercial feature supports strict package access.');
 $check(!$pricing->reserve($user,['cover_letters'])['allowed']&&!$pricing->reserve($user,['pdf_download'])['allowed'],'An empty account has no free feature access even at a zero price.');
 $wallet->adjust($user,1000,'Fictional wallet for access checks','test','strict-access-wallet-check');
 $db->prepare('INSERT INTO user_feature_entitlements (user_id,feature_key,paid_tokens) VALUES (?,?,1)')->execute([$user,'cover_letters']);
 $db->prepare('INSERT INTO feature_use_credits (user_id,feature_key,paid_tokens) VALUES (?,?,1)')->execute([$user,'pdf_download']);
 $check(!$pricing->reserve($user,['cover_letters'])['allowed']&&!$pricing->reserve($user,['pdf_download'])['allowed'],'Saved currency, legacy permanent unlocks and prepaid credits cannot bypass strict rules.');
 $check(!(new AiQuotaService($db))->consume($user,'assist')['allowed'],'Base AI allowance cannot unlock an excluded AI feature.');
 $marker=$db->query("SELECT payload FROM operations_settings WHERE setting_key='strict_package_upgrade_024'")->fetchColumn();$db->exec("DELETE FROM operations_settings WHERE setting_key='strict_package_upgrade_024'");$db->exec("UPDATE feature_prices SET mode='free' WHERE feature_key='cover_letters'");
 $check($pricing->all($user)['cover_letters']['mode']==='package_only'&&!$pricing->reserve($user,['cover_letters'])['allowed'],'An installation missing the policy migration fails closed despite legacy Free settings.');
 $db->prepare("INSERT INTO operations_settings (setting_key,payload) VALUES ('strict_package_upgrade_024',?)")->execute([$marker]);$db->exec("UPDATE feature_prices SET mode='package_only' WHERE feature_key='cover_letters'");
 $base=['name'=>'Basic strict','sortOrder'=>0,'tokens'=>0,'bonusTokens'=>0,'priceMinor'=>3000,'currency'=>'MYR','highlighted'=>false,'active'=>true,'features'=>['resume_editor'=>null,'document_preview'=>null,'templates'=>1,'pdf_download'=>2],'templateTiers'=>['basic'],'validityDays'=>30];
 $package=$store->savePackage(null,$base,$admin);$grant=$packages->grant($package,['userId'=>$user,'version'=>1,'reference'=>'strict-basic-grant-0001','reason'=>'Strict access regression'],$admin);
 $letterId=(new CoverLetterRepository($db))->save(null,$user,$f['resumeId'],['company'=>'Example Studio','role'=>'Operations Specialist','body'=>"First paragraph with useful evidence.\n\nThank you for considering my application.",'letter_date'=>'2026-11-08','recipient_address'=>"18 Example Road\nMelaka"]);
 $jar=$fixture->directory.'/strict.cookies';
 $http=static function(string $path,string $method='GET',?array $body=null,string $csrf='',array $extraHeaders=[])use($fixture,$jar):array{$h=curl_init($fixture->base.$path);$headers=['Accept: application/json',...$extraHeaders];if($body!==null)$headers[]='Content-Type: application/json';if($csrf!=='')$headers[]='X-CSRF-Token: '.$csrf;curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_TIMEOUT=>30,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers]);if($body!==null)curl_setopt($h,CURLOPT_POSTFIELDS,json_encode($body));$raw=(string)curl_exec($h);$status=curl_getinfo($h,CURLINFO_RESPONSE_CODE);$headerSize=curl_getinfo($h,CURLINFO_HEADER_SIZE);$payload=substr($raw,$headerSize);curl_setopt($h,CURLOPT_COOKIELIST,'FLUSH');unset($h);return ['status'=>$status,'raw'=>$payload,'data'=>json_decode($payload,true)??[]];};
 $check($http('/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890'])['status']===200,'The isolated user signs in.');$csrf=$http('/api/auth/me')['data']['csrfToken'];
 foreach([['/api/cover-letters','GET',null],['/api/cover-letters','POST',['company'=>'X','role'=>'Y']],['/api/cover-letters/'.$letterId,'PUT',['company'=>'X','role'=>'Y']],['/api/cover-letters/'.$letterId.'/pdf','GET',null],['/api/cover-letters/'.$letterId.'/document','GET',null],['/api/cover-letters/'.$letterId.'/ai-suggest','POST',[]]] as [$path,$method,$body]){$r=$http($path,$method,$body,$csrf);$check($r['status']===403&&$r['data']['code']==='PACKAGE_ACCESS_REQUIRED','Excluded cover-letter routes are denied: '.$method.' '.$path);}
 $check($http('/cover-letters')['status']===403,'Direct page navigation does not unlock cover letters.');
 $check($http('/api/resume/'.$f['resumeId'].'/section','POST',['section'=>'documentSettings','data'=>[]],$csrf)['status']===403,'Appearance settings require their own included access.');
 $check($http('/api/store/access','POST',['feature'=>'cover_letters','version'=>$pricing->all($user)['cover_letters']['version'],'reference'=>'strict-forged-purchase-01'],$csrf)['status']===422,'Strict features cannot be individually purchased through a forged client request.');
 $check($http('/api/resume/'.$f['resumeId'].'/section','POST',['section'=>'templateId','data'=>'executive'],$csrf)['status']===403,'A Basic package cannot write a Premium template.');
 $db->prepare("INSERT INTO user_template_library (user_id,template_id) VALUES (?,'executive')")->execute([$user]);
 $db->prepare("UPDATE resumes SET resume_data=JSON_SET(resume_data,'$.templateId','executive') WHERE id=?")->execute([$f['resumeId']]);
 $check($http('/api/pdf/'.$f['resumeId'].'/generate')['status']===403&&$pricing->all($user)['pdf_download']['packageUses']===2,'A previously saved or owned Premium design cannot bypass a Basic-only package on clean export.');
 $db->prepare("UPDATE resumes SET resume_data=JSON_SET(resume_data,'$.templateId','classic') WHERE id=?")->execute([$f['resumeId']]);
 $check($http('/api/pdf/'.$f['resumeId'].'/generate','GET',null,'',['Sec-Fetch-Site: cross-site'])['status']===403&&$pricing->all($user)['pdf_download']['packageUses']===2,'A cross-site navigation cannot drain the download allowance.');
 $check($http('/api/pdf/'.$f['resumeId'].'/generate','GET',null,'',['Referer: https://unrelated.example/page'])['status']===403,'A foreign referrer is rejected even without fetch metadata.');
 $first=$http('/api/pdf/'.$f['resumeId'].'/generate');$check($first['status']===200&&str_starts_with($first['raw'],'%PDF-'),'The first included PDF succeeds.');
 $check($pricing->all($user)['pdf_download']['packageUses']===1,'A successful PDF consumes one package use even at a zero individual price.');
 $preview=$http('/api/pdf/'.$f['resumeId'].'/document');$check($preview['status']===200&&str_starts_with($preview['raw'],'%PDF-')&&$pricing->all($user)['pdf_download']['packageUses']===1,'Preview does not consume a clean download.');
 preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s',$preview['raw'],$streams);$decoded='';foreach($streams[1] as $stream)$decoded.=@gzuncompress($stream)?:$stream;
 $check(str_contains($decoded,'PREVIEW'),'Strict limited downloads cannot be bypassed through a clean preview PDF.');
 $check($http('/api/pdf/'.$f['resumeId'].'/generate')['status']===200,'The second included PDF succeeds.');
 $third=$http('/api/pdf/'.$f['resumeId'].'/generate');$check($third['status']===403&&$third['data']['code']==='PACKAGE_LIMIT_REACHED'&&!str_starts_with($third['raw'],'%PDF-'),'A third clean PDF is denied without spending saved or base tokens.');
 $check($pricing->all($user)['pdf_download']['credits']===0,'Old prepaid credits remain excluded under a strict rule.');
 $extra=$store->savePackage(null,[...$base,'name'=>'Letter pack','features'=>['cover_letters'=>null,'cover_letter_create'=>1,'pdf_download'=>1,'ai_assist'=>1]],$admin);$g2=$packages->grant($extra,['userId'=>$user,'version'=>1,'reference'=>'strict-letter-grant-0001','reason'=>'Multiple packages'],$admin);
 $check($http('/api/cover-letters')['status']===200,'A separate qualifying package enables the cover-letter workspace.');
 $check($http('/api/cover-letters','POST',['company'=>'Example','role'=>'Engineer','letter_date'=>'2026-02-30'],$csrf)['status']===422&&$pricing->all($user)['cover_letter_create']['packageUses']===1,'An invalid date does not consume a letter creation allowance.');
 $saved=$http('/api/cover-letters','POST',['company'=>'Example Company','role'=>'Engineer','body'=>"A wrapped\nline remains one paragraph.\n\nThe second paragraph.",'letter_date'=>'2026-10-21','recipient_address'=>"24 Example Street\nMelaka"],$csrf);
 $check($saved['status']===201&&$saved['data']['data']['letter_date']==='2026-10-21'&&str_contains($saved['data']['data']['recipient_address'],"\n"),'A letter retains the chosen date and postal address.');
 $check($saved['data']['data']['body']==="A wrapped line remains one paragraph.\n\nThe second paragraph.",'Saving preserves paragraph breaks and joins pasted soft line wraps.');
 $edited=$http('/api/cover-letters/'.$saved['data']['data']['id'],'PUT',['company'=>'Example Company','role'=>'Engineer','body'=>'An updated body.'],$csrf);
 $check($edited['status']===200&&$edited['data']['data']['letter_date']==='2026-10-21'&&$edited['data']['data']['recipient_address']==="24 Example Street\nMelaka",'Editing an existing letter needs no new creation use and older clients retain its date and address.');
 $check($http('/api/cover-letters','POST',['company'=>'Another','role'=>'Engineer'],$csrf)['data']['code']==='PACKAGE_LIMIT_REACHED','Creating another letter stops at its included creation limit.');
 $check($http('/api/cover-letters/'.$letterId.'/pdf')['status']===200&&$http('/api/pdf/'.$f['resumeId'].'/generate')['status']===403,'Resume and cover-letter downloads share the same remaining PDF allowance.');
 $ai=(new AiQuotaService($db))->consume($user,'assist');$check($ai['allowed']&&isset($ai['benefitReservation']),'An included AI action reserves its package benefit.');$pricing->settle([$ai['benefitReservation']],true);
 $denied=(new AiQuotaService($db))->consume($user,'assist');$check(!$denied['allowed']&&!empty($denied['accessDenied']),'AI cannot spill into a large base or saved balance after a strict limit.');
 $rule=$pricing->all($user)['pdf_download'];$pricing->save('pdf_download',['mode'=>'per_use','cost'=>3,'version'=>$rule['version']],$admin);
 $check($http('/api/pdf/'.$f['resumeId'].'/generate')['status']===200,'Explicit token fallback can use a previously purchased PDF credit.');
 $check($http('/api/pdf/'.$f['resumeId'].'/generate')['status']===402,'Token fallback requires a real prepaid action after package and existing credit are exhausted.');
 $before=$wallet->balance($user)['balance'];$price=$pricing->all($user)['pdf_download'];$buy=['feature'=>'pdf_download','version'=>$price['version'],'reference'=>'strict-explicit-fallback-01'];
 $check($http('/api/store/access','POST',$buy,$csrf)['status']===200&&$http('/api/pdf/'.$f['resumeId'].'/generate')['status']===200&&$wallet->balance($user)['balance']===$before-3,'Admin-enabled token fallback charges exactly the configured amount.');
 $pricing->save('pdf_download',['mode'=>'package_only','cost'=>3,'version'=>$price['version']],$admin);
 $manager->change($user,$g2,'revoke',['version'=>1,'reason'=>'Wrong package','reference'=>'strict-letter-revoke-001'],$admin);
 $check($http('/api/cover-letters')['status']===403&&$http('/api/pdf/'.$f['resumeId'].'/generate')['status']===403,'Revocation immediately removes only the selected grant and strict access remains enforced.');
 $single=$store->savePackage(null,[...$base,'name'=>'One concurrent PDF','features'=>['pdf_download'=>1]],$admin);$packages->grant($single,['userId'=>$other,'version'=>1,'reference'=>'strict-concurrent-grant-01','reason'=>'Final-place race'],$admin);$jobs=[];
 for($i=0;$i<2;$i++){$p=proc_open([PHP_BINARY,__FILE__,'--reserve',$f['database'],(string)$other],[1=>['pipe','w'],2=>['pipe','w']],$pipes,$root);$jobs[]=[$p,$pipes];}
 $wins=0;foreach($jobs as [$p,$pipes]){$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($p)===0&&$err==='','Concurrent worker exits cleanly.');$wins+=(int)$out;}
 $check($wins===1&&$pricing->all($other)['pdf_download']['packageUses']===0,'Concurrent downloads cannot both spend the final package use.');
 $unlimited=$store->savePackage(null,[...$base,'name'=>'Unlimited exports','features'=>['pdf_download'=>null]],$admin);$packages->grant($unlimited,['userId'=>$user,'version'=>1,'reference'=>'strict-unlimited-grant-01','reason'=>'Unlimited exports'],$admin);
 for($i=0;$i<3;$i++){$held=$pricing->reserve($user,['pdf_download']);$check($held['allowed'],'An explicitly Unlimited package supports repeated use.');$pricing->settle($held['reservations'],true);}
 $check($pricing->all($user)['pdf_download']['packageUnlimited'],'Unlimited access stays separate from finite allowances.');
 echo "Strict package routes, PDF caps, AI gates, fallback, revocation, letter persistence and concurrency passed ($count assertions; disposable database, no provider calls).\n";
}finally{$fixture->close();}
