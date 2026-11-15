<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);
require $root.'/vendor/autoload.php';
require __DIR__.'/fixtures/StoreHttpFixture.php';
$fixture=new StoreHttpFixture($root);
try {
$f=$fixture->start();$folder=$fixture->directory;$base=$fixture->base;
$count=0;$check=static function(bool $ok,string $message)use(&$count):void{$count++;if(!$ok)throw new RuntimeException($message);};
$call=static function(string $role,string $path,string $method='GET',?array $body=null,string $csrf='',array $files=[])use($folder,$base):array{
    $handle=curl_init($base.$path);$jar=$folder.'/'.$role.'.cookies';$headers=['Accept: application/json'];if($csrf!=='')$headers[]='X-CSRF-Token: '.$csrf;
    if($files){$payload=$body??[];foreach($files as$index=>[$pathName,$name,$mime])$payload['attachments['.$index.']']=new CURLFile($pathName,$mime,$name);}
    else{$payload=$body!==null?json_encode($body):null;if($body!==null)$headers[]='Content-Type: application/json';}
    curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_HEADER=>true]);if($payload!==null)curl_setopt($handle,CURLOPT_POSTFIELDS,$payload);
    $raw=(string)curl_exec($handle);$status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);$headerSize=curl_getinfo($handle,CURLINFO_HEADER_SIZE);$headers=substr($raw,0,$headerSize);$raw=substr($raw,$headerSize);curl_setopt($handle,CURLOPT_COOKIELIST,'FLUSH');unset($handle);
    return ['status'=>$status,'raw'=>$raw,'data'=>json_decode($raw,true)??[],'headers'=>$headers];
};
$check($call('anonymous','/api/store')['status']===401,'The token store API requires authentication.');
$check($call('user','/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890'])['status']===200,'Fixture user sign-in failed.');
$check($call('admin','/api/admin/auth/login','POST',['email'=>'jamie@qa.regen.local','password'=>'Qa-Admin-567891'])['status']===200,'Fixture administrator sign-in failed.');
$check($call('other','/api/auth/login','POST',['email'=>'other@qa.regen.local','password'=>'Qa-Other-567890'])['status']===200,'Second fixture user sign-in failed.');
$check($call('delegate','/api/admin/auth/login','POST',['email'=>'agent@qa.regen.local','password'=>'Qa-Agent-567890'])['status']===200,'Delegated fixture sign-in failed.');
$userCsrf=$call('user','/api/auth/me')['data']['csrfToken'];$adminCsrf=$call('admin','/api/admin/me')['data']['csrfToken'];
$check($call('user','/api/store/access','POST',['feature'=>'templates','version'=>1,'reference'=>'forged-ref-no-csrf'])['status']===403,'Spending requires CSRF protection.');
$store=$call('user','/api/store')['data'];$initial=(int)$store['wallet']['wallet']['balance'];$check(count($store['items'])===3&&!$store['checkoutAvailable'],'Published packages are real and payment remains unavailable.');
$check($call('user','/api/store/checkout','POST',['paid'=>true,'tokens'=>999999],$userCsrf)['status']===503,'Clients cannot claim purchased tokens while checkout is disconnected.');
$check((int)$call('user','/api/store')['data']['wallet']['wallet']['balance']===$initial,'A fake checkout cannot credit a wallet.');
$check($call('delegate','/api/admin/pricing')['status']===403,'Unassigned pricing access is denied to delegated administrators.');
$catalogue=$call('user','/api/templates');$check($catalogue['status']===200&&$catalogue['data']['access']['items']['modern']['state']==='individual_unlock','Template previews are browseable while actual selection requires access.');
$check($call('user','/api/resume/'.$f['resumeId'].'/section','POST',['section'=>'templateId','data'=>'modern'],$userCsrf)['status']===402,'Direct template writes enforce individual gallery access.');
$purchase=['feature'=>'templates','version'=>1,'reference'=>'http-template-unlock-0001'];$check($call('user','/api/store/access','POST',$purchase,$userCsrf)['status']===200,'A confirmed permanent unlock can be purchased.');
$call('user','/api/store/access','POST',$purchase,$userCsrf);$check((int)$call('user','/api/store')['data']['wallet']['wallet']['balance']===$initial-4,'A retried purchase is not charged twice.');
$check($call('user','/api/templates')['status']===200,'A purchased unlock grants real feature access.');
$check($call('user','/api/pdf/'.$f['resumeId'].'/generate')['status']===402,'PDF download requires one-use access when priced per use.');
$check($call('user','/api/store/access','POST',['feature'=>'pdf_download','version'=>1,'reference'=>'http-pdf-credit-00001'],$userCsrf)['status']===200,'A PDF use credit can be purchased.');
$check($call('user','/api/pdf/999999/generate')['status']===404,'Invalid PDF records remain inaccessible.');
$prices=$call('user','/api/store/prices')['data'];$check($prices['prices']['pdf_download']['credits']===1,'An unsuccessful export leaves its use credit available.');
$pdf=$call('user','/api/pdf/'.$f['resumeId'].'/generate');$check($pdf['status']===200&&str_starts_with($pdf['raw'],'%PDF-'),'Real PDF export succeeds through the priced action.');
$check($call('user','/api/pdf/'.$f['resumeId'].'/generate')['status']===402,'A completed export consumes exactly one use credit.');
$png=[$folder.'/screenshot.png','Screenshot.png','image/png'];$document=[$folder.'/details.pdf','Details.pdf','application/pdf'];$body=['subject'=>'Attachment upload verification','category'=>'technical','body'=>'Please review these fictional screenshots and details.'];
$created=$call('user','/api/support/tickets','POST',$body,$userCsrf,[$png,$document,[$png[0],'Second.png',$png[2]],[$png[0],'Third.png',$png[2]]]);$check($created['status']===201,'Users can attach four valid files to a real request.');$ticket=(int)($created['data']['id']??0);
$detail=$call('user','/api/support/tickets/'.$ticket)['data'];$attachments=$detail['messages'][0]['attachments'];$check(count($attachments)===4,'Saved attachments are associated with the correct conversation message.');
$image=$call('user',$attachments[0]['url']);$check($image['status']===200&&str_contains($image['headers'],'image/png')&&str_contains(strtolower($image['headers']),'no-store'),'Owned images are privately served with no-store responses.');
$check($call('other',$attachments[0]['url'])['status']===404,'Another user cannot view a private support attachment.');
$check($call('anonymous',$attachments[0]['url'])['status']===401,'Anonymous attachment access is denied.');
$adminDetail=$call('admin','/api/admin/tickets/'.$ticket)['data'];$adminFile=$adminDetail['messages'][0]['attachments'][0]['url'];$check($call('admin',$adminFile)['status']===200,'Authorized support staff can view the uploaded image.');
$check($call('delegate',$adminFile)['status']===200,'A representative with support permission can view a private attachment.');
$check($call('user',$adminFile)['status']===401,'A user session cannot use the administrator file route.');
$download=$call('user',$attachments[1]['url']);$check($download['status']===200&&str_contains(strtolower($download['headers']),'content-disposition: attachment'),'PDFs download rather than execute as inline active content.');
$check($call('user','/api/support/tickets','POST',$body,$userCsrf,[$png,$png,$png,$png,$png])['status']===422,'The attachment count limit is enforced on the server.');
$check($call('user','/api/support/tickets','POST',$body,$userCsrf,[[$folder.'/invalid.svg','Screenshot.svg','image/png']])['status']===422,'Forging the browser MIME type cannot upload SVG script content.');
$version=(int)$adminDetail['ticket']['version'];$check($call('admin','/api/admin/tickets/'.$ticket,'PATCH',['version'=>$version,'status'=>'closed'],$adminCsrf)['status']===200,'Support can close the request.');
$check($call('user','/api/support/tickets/'.$ticket,'POST',['version'=>$version+1,'body'=>'A new attachment should be rejected.'],$userCsrf,[$png])['status']===422,'Closed requests cannot receive uploaded replies.');
$check($call('admin','/api/admin/tickets/'.$ticket,'PATCH',['version'=>$version+1,'body'=>'This reply must wait for reopening.'],$adminCsrf)['status']===422,'Administrators also must reopen a closed request before replying.');
$check($call('admin','/api/admin/tickets/'.$ticket.'/reopen','POST',['version'=>$version+1],$adminCsrf)['status']===200,'Support can reopen the request before further replies.');
$cursor=$call('user','/api/realtime/session')['data']['cursor'];$version=(int)$call('admin','/api/admin/tickets/'.$ticket)['data']['ticket']['version'];
$check($call('admin','/api/admin/tickets/'.$ticket,'PATCH',['version'=>$version,'status'=>'waiting_user','body'=>'Our team received your screenshots.'],$adminCsrf)['status']===200,'The administrator can send a real reply.');
$batch=$call('user','/api/realtime/changes?since='.$cursor)['data'];$topics=array_column($batch['events'],'topic');$check(in_array('support',$topics,true)&&in_array('notifications',$topics,true),'The user receives both a conversation update and a persistent notification event.');
$preferences=['account_email'=>false,'support_email'=>false,'announcement_email'=>false,'security_email'=>false,'in_app_enabled'=>true,'browser_enabled'=>false];$check($call('user','/api/notifications/preferences','PUT',$preferences,$userCsrf)['status']===200,'On-screen notification consent can be enabled without enabling any emails.');
$check($call('admin','/api/admin/settings/support-attachments','PUT',['maxFiles'=>2,'maxFileBytes'=>5242880,'maxTotalBytes'=>20971520],$adminCsrf)['status']===200,'System settings can change the attachment limit.');
$check($call('user','/api/support/configuration')['data']['attachments']['maxFiles']===2,'The user receives the current administrator-configured limit.');
$check($call('user','/api/support/tickets','POST',$body,$userCsrf,[$png,$png,$png])['status']===422,'The revised limit applies to new uploads immediately.');
$call('admin','/api/admin/settings/support-attachments','PUT',['maxFiles'=>4,'maxFileBytes'=>5242880,'maxTotalBytes'=>20971520],$adminCsrf);

$package=$store['items'][0];$grant=['userId'=>$f['userId'],'version'=>$package['version'],'reference'=>'http-package-grant-0001','reason'=>'HTTP grant verification'];
$lookup=$call('admin','/api/admin/store/accounts?search=amina%40qa.regen.local')['data'];$check($lookup['success']&&count($lookup['items'])===1&&(int)$lookup['items'][0]['id']===$f['userId'],'Pricing administrators can find the intended grant recipient by email.');
$check($call('delegate','/api/admin/store/packages/'.$package['id'].'/grant','POST',$grant)['status']===403,'Support permission does not permit package grants.');
$check($call('admin','/api/admin/store/packages/'.$package['id'].'/grant','POST',$grant)['status']===403,'Package grants require CSRF protection.');
$check($call('admin','/api/admin/store/packages/'.$package['id'].'/grant','POST',$grant,$adminCsrf)['status']===201,'Pricing administrators can grant a package without payment.');
$granted=$call('user','/api/store')['data'];$balance=$granted['balance'];
$check(count($granted['grants'])===1&&$balance['total']===$balance['base']+$balance['bonus'],'The store shows the granted package and a consistent balance breakdown.');
$check($call('user','/token-activity')['status']===200&&$call('anonymous','/api/store/activity')['status']===401,'Token activity has its own authenticated destination.');
$public=$call('anonymous','/site/pricing.json')['data'];$check($public['success']&&count($public['items'])===3&&!isset($public['wallet']),'The landing catalogue shares published packages without exposing account balances.');
$asset=$call('anonymous','/js/commerce-ui.js');$check($asset['status']===200&&str_contains($asset['raw'],'ReGenCommerce')&&str_contains(strtolower($asset['headers']),'javascript'),'The disposable HTTP fixture serves real frontend assets.');
echo "HTTP token access, package grants, shared public catalogue, disabled checkout, private uploads and permissions passed ($count assertions; isolated fixture).\n";

} finally { $fixture->close(); }
