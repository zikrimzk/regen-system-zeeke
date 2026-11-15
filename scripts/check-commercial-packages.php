<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';require __DIR__.'/fixtures/StoreHttpFixture.php';
use ReGen\{AiQuotaService,BonusCreditService,Config,FeaturePricing,PackageAccess,TokenStore};
Config::load($root);
$connect=static fn(string $name):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$name.';charset=utf8mb4',Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if (($argv[1]??'')==='--worker') {
    if (!preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$argv[2]??'')) exit(2);
    echo json_encode((new PackageAccess($connect($argv[2])))->reserve((int)$argv[3],'pdf_download'));exit;
}
$fixture=new StoreHttpFixture($root);$count=0;
$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
try {
    $f=$fixture->start();$db=$connect($f['database']);$user=$f['userId'];$admin=(int)$db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
    // Exercise the upgrade as well as the complete fresh-install schema.
    $db->exec('DROP TABLE package_grant_operations,package_claims,user_template_library,package_template_unlocks,package_use_reservations,package_entitlements,package_grants,ai_token_activity');
    $db->exec('ALTER TABLE ai_usage_reservations DROP operation');
    $db->exec('ALTER TABLE token_packages DROP card_layout,DROP coin_color,DROP landing_visible,DROP claim_enabled,DROP claim_starts_at,DROP claim_ends_at,DROP claim_limit,DROP template_tiers,DROP features_json,DROP validity_days,DROP compare_price_minor,DROP promotion_starts_at,DROP promotion_ends_at,DROP promotion_motion');
    $db->exec(file_get_contents($root.'/database/migrations/020_commercial_packages.sql'));
    $db->exec(file_get_contents($root.'/database/migrations/021_template_package_access.sql'));
    $db->exec(file_get_contents($root.'/database/migrations/022_package_claims_and_presentation.sql'));
    $db->exec(file_get_contents($root.'/database/migrations/023_package_layouts_and_account_management.sql'));
    $store=new TokenStore($db);$pricing=new FeaturePricing($db);$access=new PackageAccess($db);$wallet=new BonusCreditService($db);
    $package=['name'=>'ReGen 30','description'=>'A complete application.','tokens'=>2,'bonusTokens'=>1,'priceMinor'=>3000,'currency'=>'MYR','badge'=>'Launch offer','highlighted'=>true,'active'=>true,'sortOrder'=>1,'features'=>['pdf_download'=>1,'ai_assist'=>2,'templates'=>null],'validityDays'=>30,'comparePriceMinor'=>4500,'promotionMotion'=>'glow'];
    $id=$store->savePackage(null,$package,$admin);
    $version=1;$grant=['userId'=>$user,'reason'=>'Isolated package verification','reference'=>'qa-package-grant-000001','version'=>$version];
    $initial=$wallet->balance($user)['balance'];$grantId=$access->grant($id,$grant,$admin);
    $check($wallet->balance($user)['balance']===$initial+3,'Token bundle contents are credited with the grant.');
    $check($access->grant($id,$grant,$admin)===$grantId && $wallet->balance($user)['balance']===$initial+3,'Grant retries are idempotent.');
    $check($pricing->all($user)['templates']['packageUnlocked'],'Workspace access is included.');
    $check($pricing->all($user)['pdf_download']['packageUses']===1,'Package action limits appear in current prices.');
    $other=(int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();
    $check(!$pricing->all($other)['templates']['packageUnlocked'],'Benefits belong only to the granted account.');
    $hold=$pricing->reserve($user,['pdf_download']);$check($hold['allowed']&&$hold['reservations'][0]['package'],'Package use precedes individual pricing.');
    $check(!$pricing->reserve($user,['pdf_download'])['allowed'],'Held package uses cannot be reserved twice.');
    $pricing->settle($hold['reservations'],false);$check($pricing->all($user)['pdf_download']['packageUses']===1,'Failed actions restore the package use.');
    // Competing PHP workers must not both obtain the final included use.
    $workers=[];
    for($i=0;$i<2;$i++){$process=proc_open([PHP_BINARY,__FILE__,'--worker',$f['database'],(string)$user],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,$root);fclose($pipes[0]);$workers[]=[$process,$pipes];}
    $wins=[];foreach($workers as [$process,$pipes]){$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($process)===0,'Concurrent package worker completed: '.$error);$wins[]=json_decode($out,true);}
    $check(count(array_filter($wins))===1,'Exactly one concurrent request obtains the final package use.');
    $winner=array_values(array_filter($wins))[0];$access->settle($winner,true);
    $check($pricing->all($user)['pdf_download']['packageUses']===0,'Successful actions consume one included use.');
    $check(!$pricing->reserve($user,['pdf_download'])['allowed'],'After exhaustion the individual token price applies.');
    $pricing->purchase($user,'pdf_download',1,'qa-package-fallback-00001');$paid=$pricing->reserve($user,['pdf_download']);$check($paid['allowed']&&!isset($paid['reservations'][0]['package']),'Individual prepaid access remains supported.');$pricing->settle($paid['reservations'],true);
    $quota=new AiQuotaService($db);$db->prepare('UPDATE users SET ai_token_limit=2 WHERE id=?')->execute([$user]);
    $ai=$quota->consume($user,'assist');$check($ai['allowed']&&isset($ai['benefitReservation'])&&$ai['cost']===0,'An included AI action costs no base or saved tokens.');$pricing->settle([$ai['benefitReservation']],false);
    $check($access->benefits($user)['ai_assist']['uses']===2,'Failed AI restores included usage.');
    for($i=0;$i<2;$i++){$ai=$quota->consume($user,'assist');$pricing->settle([$ai['benefitReservation']],true);}
    $check($quota->status($user)['baseRemaining']===2,'Included AI uses leave base tokens intact.');
    $price=$pricing->all()['ai_assist'];$pricing->save('ai_assist',['mode'=>'per_use','cost'=>3,'version'=>$price['version']],$admin);
    $before=$wallet->balance($user)['balance'];$ai=$quota->consume($user,'assist');
    $check($ai['cost']===3&&$ai['baseRemaining']===0&&$ai['bonusRemaining']===$before-1,'AI holds use base tokens before saved tokens at the unified price.');
    $quota->refund($user,$ai['windowStartedAt'],$ai['reservationToken']);
    $check($quota->status($user)['baseRemaining']===2&&$wallet->balance($user)['balance']===$before,'Failed AI releases both token balances.');
    $ai=$quota->consume($user,'assist');$quota->finalize($user,$ai['windowStartedAt'],$ai['reservationToken']);
    $check($quota->status($user)['baseRemaining']===0&&$wallet->balance($user)['balance']===$before-1,'Successful AI settles exactly one combined charge.');
    $check(count(array_filter($store->activity($user)['ledger'],fn($event)=>$event['bucket']==='base'))===1,'Successful base spending is recorded once in token activity.');
    $balance=$store->balance($user);$check($balance['total']===$balance['base']+$balance['bonus'],'Store totals equal the same base and saved balances used by AI.');
    $package['features']['ai_assist']=99;$store->savePackage($id,[...$package,'version'=>1],$admin);
    $check($access->benefits($user)['ai_assist']['uses']===0,'Catalogue edits do not change previously granted usage.');
    $db->prepare('UPDATE package_grants SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=?')->execute([$grantId]);
    $check(!$pricing->all($user)['templates']['packageUnlocked'],'Expired grants no longer unlock features.');
    $check($access->grants($user)[0]['expired'],'Expired packages remain traceable in account history.');
    $p=$store->packages(true)['items'];$p=array_values(array_filter($p,fn($item)=>$item['id']===$id))[0];
    $check($p['discount_percent']===33&&$p['display_price_minor']===3000,'Current promotion uses the configured money price.');
    $p['promotion_ends_at']=gmdate('Y-m-d H:i:s',time()-5);$p=TokenStore::promotion($p);
    $check(!$p['promotion_active']&&$p['display_price_minor']===4500&&$p['discount_percent']===0,'Expired promotions restore the original price and remove the discount.');
    try{$store->savePackage(null,[...$package,'comparePriceMinor'=>2000],$admin);$check(false,'Invalid discount accepted.');}catch(DomainException){$check(true,'Invalid discounts are rejected.');}
    try{$access->grant($id,[...$grant,'reference'=>'qa-stale-package-grant'], $admin);$check(false,'Stale package grant accepted.');}catch(ReGen\ConcurrentUpdate){$check(true,'Stale package versions require review.');}
    echo "Commercial package expiry, concurrency, snapshot grants, fallback pricing, combined AI billing and promotion checks passed ($count assertions; isolated database; no AI or payments).\n";
} finally {$fixture->close();}
