<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';require __DIR__.'/fixtures/StoreHttpFixture.php';
use ReGen\{AccountPackages,AdminAccess,BonusCreditService,Config,FeaturePricing,PackageAccess,ResumeRepository,TemplateAccess,TokenStore};
Config::load($root);
$connect=static fn(string $name):PDO=>new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$name.';charset=utf8mb4',Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_INIT_COMMAND=>"SET time_zone='+00:00'"]);
if(($argv[1]??'')==='--replace'){
 if(!preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$argv[2]??''))exit(2);
 try{(new AccountPackages($connect($argv[2])))->change((int)$argv[3],(int)$argv[4],'replace',['version'=>1,'packageId'=>(int)$argv[5],'packageVersion'=>1,'reference'=>$argv[6],'reason'=>'Concurrent replacement test'],(int)$argv[7]);echo '1';}catch(DomainException|ReGen\ConcurrentUpdate){echo '0';}exit;
}
$fixture=new StoreHttpFixture($root);$count=0;
$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
$reject=static function(callable $fn,string $message)use($check):void{try{$fn();$check(false,$message);}catch(DomainException|OutOfBoundsException|ReGen\ConcurrentUpdate){$check(true,$message);}};
try{
 $f=$fixture->start();$db=$connect($f['database']);$user=$f['userId'];$other=(int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();$admin=(int)$db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
 $store=new TokenStore($db);$manager=new AccountPackages($db);$access=new PackageAccess($db);$pricing=new FeaturePricing($db);$wallet=new BonusCreditService($db);$repo=new ResumeRepository($db);
 $base=['name'=>'Hero access','description'=>'Fictional package.','tokens'=>3,'bonusTokens'=>1,'priceMinor'=>3000,'currency'=>'MYR','badge'=>'','highlighted'=>true,'active'=>true,'sortOrder'=>1,'features'=>['templates'=>2,'pdf_download'=>2,'ai_assist'=>null],'templateTiers'=>['basic','premium'],'validityDays'=>30,'cardLayout'=>'hero','coinColor'=>'sapphire'];
 $a=$store->savePackage(null,$base,$admin);$b=$store->savePackage(null,[...$base,'name'=>'Token row','tokens'=>10,'bonusTokens'=>0,'features'=>['pdf_download'=>3,'templates'=>1],'templateTiers'=>['basic'],'cardLayout'=>'row','coinColor'=>'gold'],$admin);$c=$store->savePackage(null,[...$base,'name'=>'Replacement access','tokens'=>50,'bonusTokens'=>0,'features'=>['pdf_download'=>1]],$admin);
 $catalog=$store->packages(true);$rows=array_column($catalog['items'],null,'id');$check($rows[$a]['card_layout']==='hero'&&$rows[$b]['card_layout']==='row'&&$rows[$a]['coin_color']==='sapphire','Each package stores its own layout and coin colour.');
 $check($store->packages(false,1,false,null,'row')['total']===1,'One-line offers have an independent catalogue.');
 $reject(fn()=>$store->savePackage(null,[...$base,'cardLayout'=>'script'],$admin),'Unsupported layouts are rejected.');$reject(fn()=>$store->savePackage(null,[...$base,'coinColor'=>'red;url(x)'],$admin),'Coin colours are restricted to safe named palettes.');
 $start=$wallet->balance($user)['balance'];$add=['packageId'=>$a,'packageVersion'=>1,'reason'=>'Account package test','reference'=>'qa-account-package-add-001'];$ga=$manager->change($user,null,'add',$add,$admin)['id'];
 $check($manager->change($user,null,'add',$add,$admin)['id']===$ga&&$wallet->balance($user)['balance']===$start+4,'Adding and retrying a package credits its bundle once.');
 $gb=$manager->change($user,null,'add',[...$add,'packageId'=>$b,'reference'=>'qa-account-package-add-002'],$admin)['id'];
 $check(count(array_filter($manager->overview($user)['items'],fn($g)=>$g['active']))===2&&$access->benefits($user)['pdf_download']['uses']===5,'Independent packages coexist and their finite uses aggregate.');
 $repo->saveSection($f['resumeId'],$user,'templateId','executive');$hold=$pricing->reserve($user,['pdf_download']);$pricing->settle($hold['reservations'],true);
 $adjust=['version'=>1,'features'=>['templates'=>2,'pdf_download'=>3,'ai_assist'=>5],'templateTiers'=>['basic','premium'],'expiresAt'=>gmdate('Y-m-d\TH:i:s\Z',time()+86400),'reason'=>'Correct allowance','reference'=>'qa-account-package-adjust-001'];
 $manager->change($user,$ga,'adjust',$adjust,$admin);$grants=array_column($manager->overview($user)['items'],null,'id');$fa=array_column($grants[$ga]['features'],null,'key');
 $check($fa['pdf_download']['remaining']===2&&$fa['templates']['consumed']===1&&$grants[$ga]['version']===2,'Allowance edits preserve actual use and distinct template history.');
 $held=$pricing->reserve($user,['pdf_download']);$reject(fn()=>$manager->change($user,$ga,'adjust',[...$adjust,'version'=>2,'features'=>['pdf_download'=>1],'reference'=>'qa-account-package-adjust-low'],$admin),'Limits cannot fall below used plus reserved actions.');
 $balance=$wallet->balance($user)['balance'];$revoke=['version'=>2,'reference'=>'qa-account-package-revoke-001','reason'=>'Mistaken grant'];$manager->change($user,$ga,'revoke',$revoke,$admin);
 $check($manager->change($user,$ga,'revoke',$revoke,$admin)['duplicate']&&$wallet->balance($user)['balance']===$balance,'Revocation retries are safe and do not silently reverse saved tokens.');
 $check(!isset($access->benefits($user)['ai_assist'])&&$access->benefits($user)['pdf_download']['uses']===3,'Revoked benefits disappear while another active package remains available.');
 $reject(fn()=>$pricing->settle($held['reservations'],true),'A revoked in-flight package reservation cannot release a successful result.');
 $repo->saveSection($f['resumeId'],$user,'templateId','executive');$reject(fn()=>$repo->saveSection($f['resumeId'],$user,'templateId','horizon'),'Revocation retains the existing document but blocks new restricted template selections.');
 $replace=['version'=>1,'packageId'=>$c,'packageVersion'=>1,'reason'=>'Replace wrong package','reference'=>'qa-account-package-replace-001'];$gc=$manager->change($user,$gb,'replace',$replace,$admin)['id'];
 $check($wallet->balance($user)['balance']===$balance&&$manager->change($user,$gb,'replace',$replace,$admin)['id']===$gc,'Replacing access does not mint replacement tokens by default or on retries.');
 $reject(fn()=>$manager->change($user,$gb,'replace',[...$replace,'includeTokens'=>true],$admin),'Reusing a reference with different currency instructions is rejected.');
 $grants=array_column($manager->overview($user)['items'],null,'id');$check($grants[$gb]['revoked']&&$grants[$gc]['active']&&$grants[$gc]['credited_tokens']===0,'Replacement retains the old grant history and records zero credited tokens for access-only corrections.');
 $reject(fn()=>$manager->change($other,$gc,'revoke',['version'=>1,'reference'=>'qa-account-package-cross-user','reason'=>'Forbidden account mismatch'],$admin),'A grant cannot be changed through another account.');
 $manager->change($user,$gc,'adjust',['version'=>1,'features'=>['pdf_download'=>4],'templateTiers'=>['basic'],'expiresAt'=>null,'reference'=>'qa-account-package-no-expiry','reason'=>'Remove expiry'],$admin);
 $manager->change($user,null,'add',[...$add,'reference'=>'qa-account-package-add-again'],$admin);
 $check($wallet->balance($user)['balance']===$balance+4&&count(array_filter($manager->overview($user)['items'],fn($g)=>$g['active']))===2,'The same account can obtain another independent package without replacing existing access.');
 $go=$manager->change($other,null,'add',[...$add,'packageId'=>$b,'reference'=>'qa-account-package-other-add'],$admin)['id'];$jobs=[];
 foreach(['qa-account-replace-worker-001','qa-account-replace-worker-002'] as $ref){$p=proc_open([PHP_BINARY,__FILE__,'--replace',$f['database'],(string)$other,(string)$go,(string)$c,$ref,(string)$admin],[1=>['pipe','w'],2=>['pipe','w']],$pipes,$root);$jobs[]=[$p,$pipes];}
 $wins=0;foreach($jobs as [$p,$pipes]){$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$check(proc_close($p)===0&&$err==='','Concurrent replacement worker completed.');$wins+=(int)$out;}
 $check($wins===1&&$manager->overview($other)['total']===2,'Competing replacements create exactly one replacement grant.');
 $permissions=new AdminAccess($db);$delegate=(int)$db->query("SELECT id FROM admins WHERE email='agent@qa.regen.local'")->fetchColumn();
 $permissions->assign($delegate,['capabilities'=>['users.view','users.manage'],'purpose'=>'Account profile management only','version'=>1],$admin);$actor=(new ReGen\AdminRepository($db))->findById($delegate);
 $check(!$permissions->allows($actor,'/api/admin/users/'.$user.'/packages','POST')&&$permissions->allows($actor,'/api/admin/users/'.$user.'/packages','GET'),'Account write access alone cannot grant currency-bearing packages.');
 $permissions->assign($delegate,['capabilities'=>['users.view','users.packages'],'purpose'=>'Explicit account package administration','version'=>2],$admin);$check($permissions->allows($actor,'/api/admin/users/'.$user.'/packages/'.$gc.'/adjust','POST'),'The explicit package permission permits account package changes.');
 $jar=$fixture->directory.'/account-packages.cookies';
 $http=static function(string $path,string $method='GET',?array $body=null,string $csrf='')use($fixture,$jar):array{$h=curl_init($fixture->base.$path);$headers=['Accept: application/json'];if($body!==null)$headers[]='Content-Type: application/json';if($csrf!=='')$headers[]='X-CSRF-Token: '.$csrf;curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_TIMEOUT=>15,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers]);if($body!==null)curl_setopt($h,CURLOPT_POSTFIELDS,json_encode($body));$raw=(string)curl_exec($h);$status=curl_getinfo($h,CURLINFO_RESPONSE_CODE);curl_setopt($h,CURLOPT_COOKIELIST,'FLUSH');unset($h);return ['status'=>$status,'data'=>json_decode($raw,true)??[]];};
 $check($http('/api/admin/users/'.$user.'/packages')['status']===401,'Account package data requires an administrator session.');
 $check($http('/api/admin/auth/login','POST',['email'=>'agent@qa.regen.local','password'=>'Qa-Agent-567890'])['status']===200,'Delegated package test administrator signs in.');$csrf=$http('/api/admin/me')['data']['csrfToken'];
 $check($http('/api/admin/users/'.$user.'/packages')['data']['total']===4,'The account package history endpoint includes active and revoked grants.');
 $catalogue=$http('/api/admin/users/'.$user.'/packages/catalogue');$check($catalogue['status']===200&&$catalogue['data']['total']>=3,'Package selection has a scoped paginated catalogue endpoint.');
 $gift=['packageId'=>$a,'packageVersion'=>1,'reason'=>'HTTP grant verification','reference'=>'qa-account-package-http-add','includeTokens'=>false,'tokens'=>999999,'userId'=>$other];$beforeWallet=$wallet->balance($user)['balance'];
 $check($http('/api/admin/users/'.$user.'/packages','POST',$gift,'invalid')['status']===403,'Package changes enforce CSRF.');
 $permissions->assign($delegate,['capabilities'=>['users.view','users.manage'],'purpose'=>'Profile editing without package privileges','version'=>3],$admin);
 $check($http('/api/admin/users/'.$user.'/packages','POST',$gift,$csrf)['status']===403,'User profile write permission cannot bypass the package-specific permission over HTTP.');
 $permissions->assign($delegate,['capabilities'=>['users.view','users.packages'],'purpose'=>'Explicit package rights for HTTP verification','version'=>4],$admin);
 $added=$http('/api/admin/users/'.$user.'/packages','POST',$gift,$csrf);$check($added['status']===200&&$wallet->balance($user)['balance']===$beforeWallet,'An authorised access-only HTTP grant ignores forged currency and account fields.');
 $check($http('/api/admin/users/'.$user.'/packages','POST',$gift,$csrf)['data']['duplicate'],'HTTP retries return the original managed grant.');
 $check($http('/api/admin/users/'.$other.'/packages/'.$gc.'/revoke','POST',['version'=>2,'reference'=>'qa-account-package-http-cross','reason'=>'Ownership verification'],$csrf)['status']===404,'HTTP changes enforce the grant-to-account relationship.');
 $creditGrant=$manager->change($user,null,'add',[...$add,'reference'=>'qa-account-credit-reversal-add'],$admin)['id'];$beforeReverse=$wallet->balance($user)['balance'];
 $reverse=['version'=>1,'reason'=>'Reverse mistaken credit','reference'=>'qa-account-credit-reversal-do','reverseTokens'=>true];$manager->change($user,$creditGrant,'revoke',$reverse,$admin);$manager->change($user,$creditGrant,'revoke',$reverse,$admin);
 $check($wallet->balance($user)['balance']===$beforeReverse-4,'An explicit credit reversal deducts the server-recorded amount exactly once.');
 $history=array_column($manager->overview($user)['items'],null,'id');$check($history[$creditGrant]['reversed_tokens']===4,'The reversed amount is retained in grant history.');
 $spentGrant=$manager->change($other,null,'add',[...$add,'packageId'=>$b,'reference'=>'qa-account-credit-spent-add'],$admin)['id'];$wallet->adjust($other,-$wallet->balance($other)['balance'],'Fictional completed spending','test','qa-account-credit-spent-wallet');
 $reject(fn()=>$manager->change($other,$spentGrant,'revoke',[...$reverse,'reference'=>'qa-account-credit-spent-revoke'],$admin),'Spent credits cannot be silently clawed back or make the wallet negative.');
 $history=array_column($manager->overview($other)['items'],null,'id');$check($history[$spentGrant]['active']&&$wallet->balance($other)['balance']===0,'An unaffordable combined reversal rolls back the access revocation too.');
 $manager->change($other,$spentGrant,'revoke',[...$reverse,'reference'=>'qa-account-credit-access-only','reverseTokens'=>false],$admin);
 $check(!$access->grants($other)[0]['active'],'The administrator can still revoke access while preserving an already-spent wallet.');
 for($i=0;$i<13;$i++)$store->savePackage(null,[...$base,'name'=>'Row pagination '.$i,'features'=>[],'cardLayout'=>'row','coinColor'=>'slate'],$admin);
 $sections=$store->sections(false,$user,1,2);$check($sections['hero']['total']===5&&$sections['row']['total']===14&&count($sections['row']['items'])===2,'Hero cards and one-line offers paginate independently.');
 echo "Per-package layouts, multi-package accounts, corrections, revocation, concurrency and permissions passed ($count assertions; disposable database).\n";
}finally{$fixture->close();}
