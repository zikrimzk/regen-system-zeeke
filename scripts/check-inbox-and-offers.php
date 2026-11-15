<?php
declare(strict_types=1);

if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);
require $root.'/vendor/autoload.php';
require __DIR__.'/fixtures/StoreHttpFixture.php';

use ReGen\{Config,NotificationService,PortraitImage,TokenStore};

$fixture=new StoreHttpFixture($root);
$count=0;
$check=static function(bool $result,string $message)use(&$count):void{
    $count++;
    if(!$result)throw new RuntimeException($message);
};
try{
    $data=$fixture->start();
    $dsn='mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$data['database'].';charset=utf8mb4';
    $db=new PDO($dsn,Config::get('db.user'),Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $http=static function(string $session,string $path,string $method='GET',?array $body=null,string $csrf='')use($fixture):array{
        $handle=curl_init($fixture->base.$path);
        $jar=$fixture->directory.'/'.$session.'.cookies';
        $headers=['Accept: application/json'];
        if($csrf!=='')$headers[]='X-CSRF-Token: '.$csrf;
        if($body!==null)$headers[]='Content-Type: application/json';
        curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar,CURLOPT_HTTPHEADER=>$headers,CURLOPT_TIMEOUT=>20]);
        if($body!==null)curl_setopt($handle,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
        $content=(string)curl_exec($handle);
        $status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);
        curl_setopt($handle,CURLOPT_COOKIELIST,'FLUSH');
        return [$status,json_decode($content,true)??[]];
    };
    $user=$data['userId'];
    $other=(int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();
    $admin=(int)$db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
    $agent=(int)$db->query("SELECT id FROM admins WHERE email='agent@qa.regen.local'")->fetchColumn();
    $inbox=new NotificationService($db);
    $notice=$inbox->notify($user,'account','Test inbox entry','Fictional content.','/notifications','polish-test-user',false);
    $otherNotice=$inbox->notify($other,'account','Second account entry','Fictional content.','/notifications','polish-test-other',false);
    $check($http('anonymous','/api/notifications/'.$notice,'DELETE')[0]===401,'Notification removal requires an authenticated account.');
    $check($http('user','/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890'])[0]===200,'User fixture signs in.');
    $csrf=$http('user','/api/auth/me')[1]['csrfToken'];
    $check($http('user','/api/notifications/'.$notice,'DELETE')[0]===403,'Removing a notification requires CSRF protection.');
    $http('user','/api/notifications/'.$otherNotice,'DELETE',null,$csrf);
    $check(in_array($otherNotice,array_column($inbox->inbox($other,1)['items'],'id')),'A user cannot remove another account’s notification.');
    $before=(int)$inbox->unread($user)['counts']['unread'];
    $check($http('user','/api/notifications/'.$notice,'DELETE',null,$csrf)[0]===200,'The owner can remove one notification.');
    $check((int)$inbox->unread($user)['counts']['unread']===$before-1&&!in_array($notice,array_column($inbox->inbox($user,1)['items'],'id')),'Removed items are absent from the inbox and unread delivery.');
    $check($inbox->notify($user,'account','Repeated update','Same event.','/notifications','polish-test-user',false)===0,'Removing an inbox item keeps delivery deduplication.');

    $preferences=$http('user','/api/notifications/preferences')[1]['preferences'];
    $preferences['in_app_enabled']=true;
    $check($http('user','/api/notifications/preferences','PUT',$preferences,$csrf)[0]===200&&$http('user','/api/notifications/preferences')[1]['preferences']['in_app_enabled'],'Profile preferences use the account’s existing notification consent.');

    $addAlert=$db->prepare("INSERT INTO admin_notifications (admin_id,module,title,body,dedupe_key) VALUES (?,'support',?,'Fictional content.',?)");
    $addAlert->execute([$admin,'Supervisor alert','polish-test-admin']);
    $adminNotice=(int)$db->lastInsertId();
    $addAlert->execute([$agent,'Agent alert','polish-test-agent']);
    $agentNotice=(int)$db->lastInsertId();
    $check($http('agent','/api/admin/auth/login','POST',['email'=>'agent@qa.regen.local','password'=>'Qa-Agent-567890'])[0]===200,'Delegated administrator fixture signs in.');
    $adminCsrf=$http('agent','/api/admin/me')[1]['csrfToken'];
    $check($http('agent','/api/admin/alerts/'.$agentNotice,'DELETE')[0]===403,'Administrator inbox removal requires CSRF.');
    $http('agent','/api/admin/alerts/'.$adminNotice,'DELETE',null,$adminCsrf);
    $check($db->query('SELECT removed_at FROM admin_notifications WHERE id='.$adminNotice)->fetchColumn()===null,'An administrator cannot remove another administrator’s alert.');
    $check($http('agent','/api/admin/alerts/'.$agentNotice,'DELETE',null,$adminCsrf)[0]===200,'Delegated administrators can remove their own alerts.');
    $check($http('agent','/api/admin/alerts')[1]['unread']===0,'Removed admin alerts do not remain unread.');

    $store=new TokenStore($db);
    $offer=$store->savePackage(null,['name'=>'Test offer','tokens'=>0,'bonusTokens'=>0,'priceMinor'=>1500,'comparePriceMinor'=>3000,'currency'=>'MYR','badge'=>'Launch offer','active'=>true,'highlighted'=>true,'sortOrder'=>1,'features'=>['cover_letters'=>null],'offerHeadline'=>'Prepare your next cover letter','offerCta'=>'Explore the offer'],$admin);
    $catalogue=$http('user','/api/store?feature=cover_letters')[1];
    $check(count($catalogue['items'])===1&&$catalogue['sections']['hero']['items'][0]['id']===$offer,'Relevant package filtering includes unlimited and workspace access benefits.');
    $check($catalogue['items'][0]['offer_headline']==='Prepare your next cover letter'&&$catalogue['items'][0]['offer_cta']==='Explore the offer'&&$catalogue['items'][0]['discount_percent']===50,'Offer copy and configured price comparison reach the catalogue.');
    $check($store->packages(true,1,false,null,null,null,true)['total']===1,'The Offers view selects configured promotions.');

    $photo=imagecreatetruecolor(1600,1200);
    ob_start();imagejpeg($photo,null,95);$jpeg=(string)ob_get_clean();
    $exif="Exif\0\0II".pack('vVv',42,8,1).pack('vvVvvV',0x0112,3,1,6,0,0);
    $jpeg=substr($jpeg,0,2)."\xFF\xE1".pack('n',strlen($exif)+2).$exif.substr($jpeg,2);
    $portrait=PortraitImage::upload($jpeg);
    if(function_exists('exif_read_data'))$check($portrait['width']===1200&&$portrait['height']===1600,'A rotated JPEG is normalized before document cropping.');
    $bytes=base64_decode(explode(',',$portrait['photoBase64'],2)[1],true);
    $check(!str_contains($bytes,"Exif\0\0"),'Normalized portrait storage omits EXIF metadata.');
    foreach([true,false] as $square){
        $crop=PortraitImage::crop($portrait['photoBase64'],$square,'center');
        $size=getimagesizefromstring(base64_decode(explode(',',$crop,2)[1],true));
        $check($size[0]===720&&$size[1]===($square?720:960),'Portrait output uses a high-resolution crop with the chosen aspect ratio.');
    }
    echo "Inbox ownership, preferences, offers and portrait processing passed ($count assertions; isolated data).\n";
}finally{$fixture->close();}
