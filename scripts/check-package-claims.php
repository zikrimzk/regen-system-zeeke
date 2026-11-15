<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';require __DIR__.'/fixtures/StoreHttpFixture.php';
use ReGen\{BonusCreditService,Config,PackageAccess,PackageClaims,TokenStore};
Config::load($root);
$connect=static fn(string $name):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$name.';charset=utf8mb4',Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if(($argv[1]??'')==='--worker'){
    if(!preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
    try{echo json_encode((new PackageClaims($connect($argv[2])))->claim((int)$argv[3],(int)$argv[4],1));}catch(DomainException){echo 'false';}exit;
}
$fixture=new StoreHttpFixture($root);$count=0;
$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
$reject=static function(callable $fn,string $message)use($check):void{try{$fn();$check(false,$message);}catch(DomainException){$check(true,$message);}};
try{
    $f=$fixture->start();$db=$connect($f['database']);$user=$f['userId'];$other=(int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();$admin=(int)$db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
    $store=new TokenStore($db);$claims=new PackageClaims($db);$wallet=new BonusCreditService($db);
    $offer=['name'=>'Launch access','description'=>'Fictional claim test.','tokens'=>3,'bonusTokens'=>1,'priceMinor'=>0,'currency'=>'MYR','badge'=>'Launch offer','highlighted'=>true,'active'=>true,'sortOrder'=>1,'features'=>['ai_assist'=>null,'templates'=>2],'templateTiers'=>['basic'],'validityDays'=>7,'landingVisible'=>false,'claimEnabled'=>true,'claimStartsAt'=>gmdate('Y-m-d\TH:i:s\Z',time()-60),'claimEndsAt'=>gmdate('Y-m-d\TH:i:s\Z',time()+3600),'claimLimit'=>1];
    $id=$store->savePackage(null,$offer,$admin);
    $check(!in_array($id,array_column($store->packages(false,1,true)['items'],'id'),true),'Landing-hidden packages never enter the public catalogue.');
    $check(in_array($id,array_column($store->packages(false)['items'],'id'),true),'Landing visibility does not remove store access.');
    $policy=$store->policy();$store->savePolicy([...$policy,'displayMode'=>'simple','showOnLanding'=>false],$admin);
    $check($store->policy()['displayMode']==='simple'&&!$store->policy()['showOnLanding'],'Presentation and landing switches persist independently.');
    $reject(fn()=>$store->savePolicy([...$store->policy(),'displayMode'=>'script'], $admin),'Unsupported presentation modes are rejected.');
    foreach([['claimLimit'=>0],['claimLimit'=>null],['claimEndsAt'=>null],['claimEndsAt'=>$offer['claimStartsAt']],['landingVisible'=>'yes']] as $bad)$reject(fn()=>$store->savePackage(null,[...$offer,...$bad],$admin),'Invalid free-claim settings are rejected.');
    $jar=$fixture->directory.'/claims.cookies';
    $call=static function(string $path,string $method='GET',?array $body=null,string $csrf='')use($fixture,$jar):array{$h=curl_init($fixture->base.$path);$headers=['Accept: application/json'];if($body!==null)$headers[]='Content-Type: application/json';if($csrf!=='')$headers[]='X-CSRF-Token: '.$csrf;curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_TIMEOUT=>15,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers]);if($body!==null)curl_setopt($h,CURLOPT_POSTFIELDS,json_encode($body));$raw=(string)curl_exec($h);$status=curl_getinfo($h,CURLINFO_RESPONSE_CODE);curl_setopt($h,CURLOPT_COOKIELIST,'FLUSH');unset($h);return ['status'=>$status,'json'=>json_decode($raw,true)??[],'body'=>$raw];};
    $check($call('/site/pricing.json')['json']['total']===0,'Global landing opt-out returns no public packages.');
    $check($call('/api/store/packages/'.$id.'/claim','POST',['version'=>1])['status']===401,'Claims require authentication.');
    $check($call('/store')['status']===302,'The public offer opens sign-in for a visitor.');
    $login=$call('/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890']);
    $check($login['status']===200&&$login['json']['redirect']==='/store','Sign-in returns an offer visitor to the store.');$csrf=$call('/api/auth/me')['json']['csrfToken'];
    $check($call('/api/store/packages/'.$id.'/claim','POST',['version'=>1],'forged')['status']===403,'Claims enforce CSRF.');
    $db->prepare('UPDATE token_packages SET claim_starts_at=UTC_TIMESTAMP()+INTERVAL 1 HOUR WHERE id=?')->execute([$id]);$reject(fn()=>$claims->claim($id,$user,1),'Upcoming claims cannot be taken early.');
    $db->prepare('UPDATE token_packages SET claim_starts_at=UTC_TIMESTAMP()-INTERVAL 2 HOUR,claim_ends_at=UTC_TIMESTAMP()-INTERVAL 1 HOUR WHERE id=?')->execute([$id]);$reject(fn()=>$claims->claim($id,$user,1),'Expired claims are rejected by the server.');
    $db->prepare('UPDATE token_packages SET claim_ends_at=UTC_TIMESTAMP()+INTERVAL 1 HOUR,active=0 WHERE id=?')->execute([$id]);$reject(fn()=>$claims->claim($id,$user,1),'Draft packages cannot be claimed.');$db->prepare('UPDATE token_packages SET active=1 WHERE id=?')->execute([$id]);
    $db->prepare('UPDATE users SET email_verified_at=NULL WHERE id=?')->execute([$other]);$reject(fn()=>$claims->claim($id,$other,1),'Unverified accounts cannot claim.');$db->prepare('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?')->execute([$other]);
    $before=[$user=>$wallet->balance($user)['balance'],$other=>$wallet->balance($other)['balance']];
    $workers=[];foreach([$user,$other] as $account){$p=proc_open([PHP_BINARY,__FILE__,'--worker',$f['database'],(string)$id,(string)$account],[1=>['pipe','w'],2=>['pipe','w']],$pipes,$root);$workers[]=[$p,$pipes];}
    $wins=0;foreach($workers as [$p,$pipes]){$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($p)===0&&$error==='','Concurrent claim worker succeeds.');if(json_decode($out,true))$wins++;}
    $check($wins===1&&(int)$db->query('SELECT COUNT(*) FROM package_claims')->fetchColumn()===1,'Exactly one account obtains the final claim.');
    $row=$db->query('SELECT * FROM package_claims')->fetch();$winner=(int)$row['user_id'];$loser=$winner===$user?$other:$user;
    $check($wallet->balance($winner)['balance']===$before[$winner]+4&&$wallet->balance($loser)['balance']===$before[$loser],'Only the winner receives the configured tokens.');
    $benefits=(new PackageAccess($db))->benefits($winner);$check($benefits['ai_assist']['unlocked']&&$benefits['templates']['uses']===2,'Claims include the actual package feature snapshot.');
    $check($claims->claim($id,$winner,1)['duplicate']&&$wallet->balance($winner)['balance']===$before[$winner]+4,'Repeating a claim cannot duplicate benefits or tokens.');
    $reject(fn()=>$claims->claim($id,$loser,1),'Capacity cannot be bypassed after the final claim.');
    $result=$call('/api/store/packages/'.$id.'/claim','POST',['version'=>1,'userId'=>$other,'tokens'=>99999,'claimLimit'=>99999],$csrf);
    $check($result['status']===($winner===$user?200:422),'Forged account, currency and capacity fields cannot change server eligibility.');
    $store->savePackage($id,[...$offer,'version'=>1,'claimLimit'=>2,'tokens'=>10,'landingVisible'=>true],$admin);
    $reject(fn()=>$claims->claim($id,$loser,1),'A changed package requires the current version.');
    $check($claims->claim($id,$winner,1)['duplicate'],'Earlier successful claims remain idempotent after catalogue edits.');
    $claims->claim($id,$loser,2);$reject(fn()=>$store->savePackage($id,[...$offer,'version'=>2],$admin),'Capacity cannot be reduced below existing claims.');
    $policy=$store->policy();$store->savePolicy([...$policy,'showOnLanding'=>true],$admin);$public=$call('/site/pricing.json')['json'];
    $check(in_array($id,array_column($public['items'],'id'),true),'Landing-eligible offers appear when globally enabled.');
    $check(!str_contains(json_encode($public),'qa.regen.local')&&!str_contains(json_encode($public),'granted_by'),'Public offers expose no claimant or administrator identities.');
    $policy=$store->policy();$store->savePolicy([...$policy,'enabled'=>false],$admin);
    $second=$store->savePackage(null,[...$offer,'name'=>'Paused giveaway'],$admin);$reject(fn()=>$claims->claim($second,$user,1),'The store master switch pauses new claims.');
    // Deleting an account must not replenish a giveaway's global capacity.
    $db->prepare('DELETE FROM users WHERE id=?')->execute([$other]);
    $q=$db->prepare('SELECT COUNT(*) FROM package_claims WHERE package_id=?');$q->execute([$id]);$check((int)$q->fetchColumn()===2,'Claim counts survive account removal without retaining account identity.');
    echo "Package claims, final-place concurrency, replay protection, privacy and presentation checks passed ($count assertions; disposable database).\n";
}finally{$fixture->close();}
