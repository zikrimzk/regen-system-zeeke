<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
$root = dirname(__DIR__);
require $root.'/vendor/autoload.php';
require __DIR__.'/fixtures/StoreHttpFixture.php';

use ReGen\{BonusCreditService, Config, MochiCoach, MochiPolicy, PackageAccess, TokenStore};

$fixture = new StoreHttpFixture($root, true);
$checks = 0;
$check = static function (bool $ok, string $message) use (&$checks): void {
    $checks++;
    if (!$ok) throw new RuntimeException($message);
};
try {
    $f = $fixture->start();
    $call = static function (string $path, string $method = 'GET', ?array $body = null, string $csrf = '', bool $signedIn = true, bool $other = false, bool $adminSession = false) use ($fixture): array {
        $curl = curl_init($fixture->base.$path);
        $headers = ['Accept: application/json'];
        if ($csrf !== '') $headers[] = 'X-CSRF-Token: '.$csrf;
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>12,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers]);
        if ($signedIn) {
            $jar = $fixture->directory.($adminSession?'/mochi-admin.cookies':($other?'/mochi-other.cookies':'/mochi-user.cookies'));
            curl_setopt_array($curl,[CURLOPT_COOKIEFILE=>$jar,CURLOPT_COOKIEJAR=>$jar]);
        }
        if ($body !== null) curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body, JSON_THROW_ON_ERROR));
        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
        if ($signedIn) curl_setopt($curl,CURLOPT_COOKIELIST,'FLUSH');
        curl_close($curl);
        return [$status,json_decode((string)$response,true) ?? []];
    };
    $payload = ['live'=>true,'field'=>'project','text'=>'Built an inventory tool and trained colleagues. Contact: person@example.com.'];
    $check($call('/api/mochi/status', signedIn:false)[0] === 401, 'Mochi status requires an authenticated user.');
    $check($call('/api/auth/login','POST',['email'=>'amina@qa.regen.local','password'=>'New-Password-567890'])[0] === 200, 'Fixture login failed.');
    [, $locked] = $call('/api/mochi/status');
    $csrf = $locked['csrfToken'] ?? '';
    $check($locked['access'] === false && $locked['liveAvailable'] === false && $csrf !== '', 'Locked accounts see a teaser and receive the normal CSRF token.');
    $check($call('/api/mochi/comment','POST',$payload,$csrf)[0] === 403, 'A direct model request cannot bypass package access.');
    $check($call('/api/store/access','POST',['feature'=>'mochi_coach','version'=>0,'reference'=>'mochi-not-a-token-purchase'],$csrf)[0] === 422, 'Token purchase cannot bypass Mochi’s package requirement.');

    $db = new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').';dbname='.$f['database'].';charset=utf8mb4',
        Config::get('db.user'), Config::get('db.password'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $admin = (int)$db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
    $check($call('/api/admin/settings/mochi')[0]===401,'Account sessions cannot read Mochi administration.');
    [$adminStatus,$adminLogin] = $call('/api/admin/auth/login','POST',['email'=>'jamie@qa.regen.local','password'=>'Qa-Admin-567891'],adminSession:true);
    $check($adminStatus===200 && isset($adminLogin['csrfToken']), 'Mochi settings require a separate administrator session.');
    $adminCsrf = $adminLogin['csrfToken'];
    $globalPath = '/api/admin/settings/mochi';
    $defaults = $call($globalPath,adminSession:true)[1]['mochi'];
    $check($defaults['autoplay'] && $defaults['sound'] && $defaults['editorReactions'],'Default global features appear in Mochi administration.');
    $muted = array_replace($defaults,['preview'=>false,'autoplay'=>false,'sound'=>false,'editorReactions'=>false]);
    $check($call($globalPath,'PUT',$muted,$adminCsrf,adminSession:true)[0]===200
        && $call('/site/mochi.json',signedIn:false)[1]['available']===false
        && !$call('/api/mochi/status')[1]['autoplay'],'Global settings independently control landing, motion and sound.');
    $call($globalPath,'PUT',$defaults,$adminCsrf,adminSession:true);
    $package = (new TokenStore($db))->savePackage(null, ['name'=>'Mochi fixture','description'=>'Fictional package', 'tokens'=>0,'bonusTokens'=>0,'priceMinor'=>500,
        'currency'=>'MYR','sortOrder'=>0,'active'=>true,'highlighted'=>false,'features'=>[MochiCoach::FEATURE=>null],
        'hideUnavailableTools'=>['ai_assist','ai_refine']],$admin);
    $version = (int)$db->query('SELECT version FROM token_packages WHERE id='.$package)->fetchColumn();
    $grant = (new PackageAccess($db))->grant($package,['userId'=>$f['userId'],'version'=>$version,'reference'=>'mochi-http-test-grant-0001','reason'=>'Fixture','includeTokens'=>false],$admin);
    $db->exec("UPDATE feature_prices SET mode='package_only' WHERE feature_key='ai_assist'");
    $check(($call('/api/store/prices')[1]['prices']['ai_assist']['hiddenByPackage']??false)===true,
        'An active package can hide an unavailable optional tool in the workspace.');
    $db->exec("UPDATE feature_prices SET mode='free' WHERE feature_key='ai_assist'");
    $check(($call('/api/store/prices')[1]['prices']['ai_assist']['hiddenByPackage']??true)===false,
        'A public tool remains visible even when an active package hides it when unavailable.');
    $before = (new BonusCreditService($db))->balance($f['userId']);
    [, $ready] = $call('/api/mochi/status');
    $check($ready['access'] === true && $ready['liveAvailable'] === true, 'An active Mochi package enables model access.');
    $check($ready['profile']['intro']==='new' && !$ready['profile']['asleep'] && !$ready['profile']['live'], 'Start with no saved context or live field consent.');
    $check($call('/api/mochi/comment','POST',$payload,$csrf)[0]===409,'Live comments are gated by saved opt-in.');
    $db->prepare('INSERT INTO mochi_profiles (user_id, preferences) VALUES (?, ?)')->execute([
        $f['userId'], json_encode(['nickname'=>'Old nickname', 'live'=>true], JSON_THROW_ON_ERROR),
    ]);
    $oldProfile = $call('/api/mochi/status')[1]['profile'];
    $check($oldProfile['nickname'] === 'Old nickname' && $oldProfile['live'] === false
        && $call('/api/mochi/comment','POST',$payload,$csrf)[0] === 409,
        'Keep saved preferences but require a fresh opt-in before sharing with OpenAI.');
    $details=['nickname'=>'Ari','goal'=>'Design internship','stage'=>'student','tone'=>'gentle','language'=>'en'];
    [$saveStatus,$memory]=$call('/api/mochi/preferences','PUT',['action'=>'introduce','details'=>$details],$csrf);
    $check($saveStatus===200 && $memory['profile']['nickname']==='Ari','Save the signed-in account’s chosen context.');
    $check($call('/api/mochi/preferences','PUT',['action'=>'live','enabled'=>true],$csrf)[0]===200,'The user can opt in to live field feedback.');
    $check(($call('/api/mochi/chat','POST',['message'=>'I got rejected.'],$csrf)[1]['reason']??null)==='local'
        && (new MochiPolicy($db))->usedToday()===0,'Local chat cannot spend any of the AI budget even through the endpoint.');
    [$chatStatus,$chatReply]=$call('/api/mochi/chat','POST',['message'=>'Polish my resume summary after I got rejected. Use my saved resume.',
        'screen'=>'builder','section'=>'projects','useSavedResume'=>true],$csrf);
    $check($chatStatus===200 && ($chatReply['mood']??null)==='sad','Chat sends saved context and the current screen to OpenAI.');
    [$busyStatus, $busyReply] = $call('/api/mochi/chat','POST',['message'=>'Polish my resume: check rate limit'],$csrf);
    $check($busyStatus === 200 && ($busyReply['reason'] ?? null) === 'busy' && $busyReply['reply'] === null,
        'Provider rate limits show a retryable busy state.');
    $check($call('/api/mochi/comment','POST',$payload)[0] === 403, 'Feedback requires a valid CSRF token.');
    $check($call('/api/mochi/comment','POST',array_replace($payload,['field'=>'password']),$csrf)[0] === 422, 'The server rejects sensitive field types.');
    $check($call('/api/mochi/comment','POST',array_replace($payload,['live'=>false]),$csrf)[0] === 422, 'The server requires opt-in for the excerpt.');
    [$status, $reply] = $call('/api/mochi/comment','POST',$payload,$csrf);
    $check($status === 200 && ($reply['comment'] ?? null) === 'What changed after the team started using it?', 'A redacted excerpt reaches the mocked OpenAI transport and returns a comment.');
    $check($call('/api/mochi/comment','POST',$payload,$csrf)[0]===429,'Live comments must honor the configured cooldown.');
    $check((new BonusCreditService($db))->balance($f['userId']) === $before
        && (int)$db->query('SELECT COUNT(*) FROM package_use_reservations')->fetchColumn() === 0, 'Mochi consumes neither tokens nor package uses.');
    $check($call('/api/mochi/preferences','PUT',['action'=>'sleep','enabled'=>true],$csrf)[0]===200,'Sleep persists through the account API.');
    $check($call('/api/mochi/status')[1]['profile']['asleep']===true && $call('/api/mochi/comment','POST',$payload,$csrf)[0]===409
        && $call('/api/mochi/chat','POST',['message'=>'Hello Mochi'],$csrf)[0]===409,'Sleeping blocks both types of model request.');
    $other = (int)$db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();
    $store = new TokenStore($db);
    $newPackage = static function (string $name, array $features) use ($store, $db, $admin, $other): void {
        $id = $store->savePackage(null, ['name'=>$name,'description'=>'Fictional package','tokens'=>0,'bonusTokens'=>0,
            'priceMinor'=>500,'currency'=>'MYR','sortOrder'=>0,'active'=>true,'highlighted'=>false,'features'=>$features], $admin);
        $version = (int)$db->query('SELECT version FROM token_packages WHERE id='.$id)->fetchColumn();
        (new PackageAccess($db))->grant($id,['userId'=>$other,'version'=>$version,'reference'=>'mochi-http-package-'.$id,'reason'=>'Fixture','includeTokens'=>false],$admin);
    };
    $newPackage('Mochi play fixture', [MochiPolicy::PLAY=>null]);
    $check($call('/api/auth/login','POST',['email'=>'other@qa.regen.local','password'=>'Qa-Other-567890','rememberMe'=>true],other:true)[0]===200,'Second fixture login failed.');
    $otherStatus=$call('/api/mochi/status',other:true)[1];
    $otherProfile=$otherStatus['profile'];
    $otherCsrf = $otherStatus['csrfToken'];
    $check($otherProfile['nickname']==='' && $otherProfile['intro']==='new' && !$otherProfile['asleep'],'Another entitled account cannot see these preferences.');
    $check($otherStatus['access'] && !$otherStatus['chatAllowed'] && $call('/api/mochi/chat','POST',['message'=>'Hello'],$otherCsrf,other:true)[0]===403,
        'A pet-only package never enables AI chat.');
    $newPackage('Mochi chat fixture', [MochiPolicy::CHAT=>1]);
    $accountPath = $globalPath.'/user/'.$other;
    $check($call($accountPath,'PUT',['mode'=>'play-only','dailyTokens'=>2],$adminCsrf,adminSession:true)[0]===200
        && $call('/api/mochi/status',other:true)[1]['playOnly']
        && $call('/api/mochi/chat','POST',['message'=>'Hello'],$otherCsrf,other:true)[0]===403,
        'An account override can pause chat even when the package includes it.');
    $check($call($accountPath,'PUT',['mode'=>'off','dailyTokens'=>null],$adminCsrf,adminSession:true)[0]===200
        && !$call('/api/mochi/status',other:true)[1]['available'],'An account override can hide Mochi entirely.');
    $call($accountPath,'PUT',['mode'=>'inherit','dailyTokens'=>2],$adminCsrf,adminSession:true);
    $playOffers = array_column($store->packages(false, feature:MochiPolicy::PLAY)['items'], 'name');
    $chatOffers = array_column($store->packages(false, feature:MochiPolicy::CHAT)['items'], 'name');
    $check(in_array('Mochi chat fixture',$playOffers,true) && in_array('Mochi fixture',$chatOffers,true)
        && !in_array('Mochi play fixture',$chatOffers,true), 'Store filters match the effective play and chat benefits.');
    $call('/api/mochi/preferences','PUT',['action'=>'introduce','details'=>$details],$otherCsrf,other:true);
    $clarify = $call('/api/mochi/chat','POST',['message'=>'Can you help me with this part?','screen'=>'builder','section'=>'projects'],$otherCsrf,other:true)[1];
    $check(($clarify['kind']??null)==='question' && $call('/api/mochi/status',other:true)[1]['chatAllowed'],
        'A clarification can be answered while the only paid package turn remains available.');
    $otherChat = ['message'=>'Polish my resume summary after I got rejected.','screen'=>'builder','section'=>'projects'];
    $check(($call('/api/mochi/chat','POST',$otherChat,$otherCsrf,other:true)[1]['mood']??null)==='sad'
        && !$call('/api/mochi/status',other:true)[1]['chatAllowed'], 'A successful reply uses exactly one limited package turn.');
    $usage = $call($accountPath,adminSession:true)[1];
    $check($usage['usedToday']===2 && $usage['limit']===2, 'Clarification and advice both count toward the administrator’s daily API budget.');
    $forgot=$call('/api/mochi/preferences','PUT',['action'=>'forget'],$csrf)[1]['profile'];
    $check($forgot['goal']==='' && !$forgot['live'] && $forgot['asleep'],'Forget clears personal context and consent without waking Mochi.');
    $call('/api/mochi/preferences','PUT',['action'=>'sleep','enabled'=>false],$csrf);
    $call('/api/mochi/preferences','PUT',['action'=>'live','enabled'=>true],$csrf);
    $nap = $call('/api/mochi/preferences','PUT',['action'=>'nap'],$csrf)[1]['profile']['napUntil'];
    $check($nap>time() && $call('/api/mochi/status')[1]['profile']['napUntil']===$nap, 'A nap persists across workspace pages.');
    $check($call('/api/mochi/preferences','PUT',['action'=>'sleep','enabled'=>false],$csrf)[1]['profile']['napUntil']===$nap
        && ($call('/api/mochi/chat','POST',['message'=>'Polish my resume summary'],$csrf)[1]['reason']??null)==='nap'
        && ($call('/api/mochi/comment','POST',$payload,$csrf)[1]['reason']??null)==='nap',
        'An active nap cannot be skipped and blocks both kinds of AI requests.');
    $db->exec('UPDATE package_grants SET revoked_at=UTC_TIMESTAMP() WHERE id='.$grant);
    $check($call('/api/mochi/comment','POST',$payload,$csrf)[0] === 403, 'A revoked grant is denied on the next request.');
    $policy = new MochiPolicy($db);
    $policy->save(array_replace(MochiPolicy::DEFAULTS,['enabled'=>false]),$admin);
    $check($call('/api/mochi/status',other:true)[1]['available'] === false
        && $call('/api/mochi/chat','POST',$otherChat,$otherCsrf,other:true)[0]===503,
        'The administrator can turn off the mascot and stop model requests.');
    $appUsed=$policy->usedToday();
    $check($policy->takeToken(123456,1) && !$policy->takeToken(123456,1) && $policy->usedToday()===$appUsed+1,
        'An exhausted account cannot consume more of the global budget.');
    $check(!$policy->takeToken(123457,10,$appUsed+1) && $policy->usedToday(123457)===0,
        'An exhausted app budget blocks other accounts without charging their allowance.');

    $ageSession = static function(int $userId,int $age) use ($db): void {
        foreach ($db->query('SELECT sid,session_data FROM app_sessions')->fetchAll() as $row) {
            $serialized = base64_decode(json_decode($row['session_data'],true)['payload']??'',true);
            if (!is_string($serialized) || !str_contains($serialized,'userId|i:'.$userId.';')) continue;
            $updated = preg_replace('/lastActivityAt\|i:\d+;/', 'lastActivityAt|i:'.(time()-$age).';', $serialized);
            $db->prepare('UPDATE app_sessions SET session_data=? WHERE sid=?')
                ->execute([json_encode(['payload'=>base64_encode($updated)]),$row['sid']]);
        }
    };
    $ageSession((int)$f['userId'],301);
    $ageSession($other,301);
    $check($call('/api/auth/me')[0]===401 && $call('/api/auth/me',other:true)[0]===200,
        'Five idle minutes expire an ordinary session while Remember Me survives.');
    echo "Mochi authenticated HTTP, memory isolation, sleep, package access and OpenAI transport passed ($checks assertions; fictional accounts and model).\n";
} finally {
    $fixture->close();
}
