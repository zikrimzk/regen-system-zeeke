<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/vendor/autoload.php';
use ReGen\{AdminRepository, AiQuotaService, Config, UserRepository};
Config::load(dirname(__DIR__));
if (!in_array(Config::get('app.env'), ['development','test','testing'], true) || !in_array(Config::get('db.host'), ['localhost','127.0.0.1','::1'], true)) throw new RuntimeException('Integration checks require a local development database.');
$connect = static fn(?string $name = null): PDO => new PDO('mysql:host='.Config::get('db.host').';port='.Config::get('db.port').($name ? ';dbname='.$name : '').';charset=utf8mb4', (string) Config::get('db.user'), (string) Config::get('db.password'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
if (($argv[1] ?? '') === '--worker') {
    if (!preg_match('/^regen_assist_test_[a-f0-9]{12}$/', $argv[2] ?? '')) exit(2);
    $quota = new AiQuotaService($connect($argv[2]));
    echo $quota->consume((int) $argv[3], 'assist')['allowed'] ? '1' : '0'; exit;
}
$server = $connect(); $name = 'regen_assist_test_'.bin2hex(random_bytes(6));
$server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$count = 0;
$check = static function(bool $ok, string $message) use (&$count): void { $count++; if (!$ok) throw new RuntimeException($message); };
try {
    $db = $connect($name); $db->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));$db->exec("UPDATE feature_prices SET mode='free',token_cost=0 WHERE feature_key='templates'");
    $admins = new AdminRepository($db); $starter = $admins->findByEmail('admin@regen.com');
    $check($starter !== null && $admins->verifyPassword('Abcd@1234', $starter), 'Requested temporary login must be seeded with a real password hash.');
    $check((bool) $starter['is_bootstrap'] && !$starter['must_change_password'], 'Temporary login stays usable until disabled.');
    $check($admins->settings()['bootstrapAdminEnabled'], 'Temporary access should initially be enabled.');
    try { $admins->setBootstrapAccess(false, (int) $starter['id']); $check(false, 'Must prevent lockout.'); } catch (DomainException) { $check(true, 'Lockout prevented.'); }
    $personal = $admins->createAdmin(['firstName'=>'Personal','lastName'=>'Admin','email'=>'personal@example.com','password'=>'Personal-Test-1234','role'=>'super_admin']);
    try { $admins->setBootstrapAccess(false, $personal); $check(false, 'Password setup required before disabling starter.'); } catch (DomainException) { $check(true, 'Unfinished replacement rejected.'); }
    $admins->changeOwnPassword($personal, 'Personal-Test-5678');
    $admins->setBootstrapAccess(false, $personal); $check(!$admins->settings()['bootstrapAdminEnabled'], 'Registered admin can disable shared access.');
    $check($admins->activeSuperAdminCount() === 1, 'A disabled shared login cannot count as a replacement super admin.');
    $admins->setBootstrapAccess(true, $personal); $check($admins->settings()['bootstrapAdminEnabled'], 'Personal super admin can restore temporary access.');
    $user = (new UserRepository($db))->create(['firstName'=>'Quota','lastName'=>'Fixture','email'=>'quota@example.com','password'=>'Fixture-123456']);
    $id = (int) $user['id']; $quota = new AiQuotaService($db);
    $photos = new ReGen\ResumeRepository($db);
    $resume = $photos->getOrCreatePrimary($id, $user, 'Photo ownership fixture');
    $check($photos->accountPhoto($id) === '', 'Accounts without a photo must get initials fallback.');
    $photo = ReGen\TemplateCatalog::sample('essential')['personal']['photoBase64'];
    $photos->updatePhoto((int) $resume['id'], $id, $photo);
    $check($photos->accountPhoto($id) === $photo, 'Uploaded portraits must remain available for the account avatar.');
    $check($photos->accountPhoto($id + 100000) === '', 'Another account must not receive this portrait.');
    $check(!$photos->updatePhoto((int) $resume['id'], $id + 100000, $photo), 'Another account cannot change this portrait.');
    $photos->updatePhoto((int) $resume['id'], $id, 'data:image/svg+xml;base64,PHN2Zz4=');
    $check($photos->accountPhoto($id) === '', 'Avatar delivery must reject unsupported image types.');
    $photos->updatePhoto((int) $resume['id'], $id, $photo);

    $settings = ['aiEnabled'=>true,'aiDefaultLimit'=>3,'aiRenewalHours'=>24,'aiCosts'=>['assist'=>1,'refine'=>2,'cover_letter'=>3,'review'=>0]];
    $admins->updateSettings($settings, $personal);
    $pricing=new ReGen\FeaturePricing($db);
    foreach(AiQuotaService::FEATURES as $operation=>$key){$price=$pricing->all()[$key];$cost=$settings['aiCosts'][$operation];$pricing->save($key,['mode'=>$cost?'per_use':'free','cost'=>$cost,'version'=>$price['version']],$personal);}
    $check($quota->costs() === $settings['aiCosts'], 'Every operation price comes from the unified feature catalogue.');
    $hold = $quota->consume($id, 'refine');
    $check($hold['allowed'] && $hold['used'] === 0 && $hold['remaining'] === 1, 'In-flight operations reserve capacity without charging.');
    $check(!$quota->consume($id, 'refine')['allowed'], 'A second worker cannot overspend reserved capacity.');
    $quota->refund($id, $hold['windowStartedAt'], $hold['reservationToken']);
    $quota->refund($id, $hold['windowStartedAt'], $hold['reservationToken']);
    $check($quota->status($id)['used'] === 0 && $quota->status($id)['remaining'] === 3, 'Errors and repeat refunds leave balance unchanged.');
    $hold = $quota->consume($id, 'refine');
    $settings['aiCosts']['refine'] = 3; $admins->updateSettings($settings, $personal); $price=$pricing->all()['ai_refine'];$pricing->save('ai_refine',['mode'=>'per_use','cost'=>3,'version'=>$price['version']],$personal);
    $quota->finalize($id, $hold['windowStartedAt'], $hold['reservationToken']);
    $quota->finalize($id, $hold['windowStartedAt'], $hold['reservationToken']);
    $check($quota->status($id)['used'] === 2, 'Successful requests charge their original price exactly once.');
    $hold = $quota->consume($id, 'assist'); $quota->finalize($id, $hold['windowStartedAt'], $hold['reservationToken']);
    $check($quota->status($id)['used'] === 3 && !$quota->consume($id, 'assist')['allowed'], 'The configured limit must be enforced.');
    $hold = $quota->consume($id, 'review'); $check($hold['allowed'], 'Free operations remain available at zero balance.');
    $quota->finalize($id, $hold['windowStartedAt'], $hold['reservationToken']); $check($quota->status($id)['used'] === 3, 'Free successes charge zero.');
    $admins->resetUserQuota($id); $hold = $quota->consume($id, 'assist');
    $db->exec('UPDATE ai_usage_reservations SET expires_at = 1');
    $check($quota->status($id)['remaining'] === 3, 'A crashed request expires without charging.');
    $quota->finalize($id, $hold['windowStartedAt'], $hold['reservationToken']); $check($quota->status($id)['used'] === 0, 'Expired reservations cannot charge.');
    $legacy = str_repeat('a', 64); $now = time(); $db->exec('UPDATE ai_usage_windows SET request_count = 1');
    $insert = $db->prepare('INSERT INTO ai_usage_reservations (reservation_token,user_id,window_started_at,expires_at) VALUES (?,?,?,?)'); $insert->execute([$legacy,$id,$now,$now+600]);
    $db->exec('UPDATE ai_usage_windows SET window_started_at = '.$now);
    $quota->refund($id, gmdate(DATE_ATOM,$now), $legacy); $check($quota->status($id)['used'] === 0, 'Legacy pending failures are refunded after migration.');
    $admins->resetUserQuota($id);
    $jobs = [];
    for ($i=0; $i<8; $i++) { $pipes=[]; $process=proc_open([PHP_BINARY,__FILE__,'--worker',$name,(string)$id],[1=>['pipe','w'],2=>['pipe','w']],$pipes); if(!is_resource($process)) throw new RuntimeException('Cannot start concurrency fixture.'); $jobs[]=[$process,$pipes]; }
    $allowed=0;
    foreach($jobs as [$process,$pipes]) { $output=stream_get_contents($pipes[1]); $errors=stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $exit=proc_close($process); $check($exit===0 && $errors==='', 'Concurrent worker failed.'); $allowed += $output==='1' ? 1 : 0; }
    $check($allowed===3 && $quota->status($id)['remaining']===0 && $quota->status($id)['used']===0, 'Eight concurrent workers must reserve only three available tokens.');
    $settings['aiEnabled']=false; $admins->updateSettings($settings,$personal); $check(!$quota->consume($id,'review')['allowed'], 'Admin pause also blocks free operations.');
    echo "AI accounting, parallel-worker and temporary admin integration checks passed ($count assertions; isolated database).\n";
} finally {
    $db = null;
    if (!preg_match('/^regen_assist_test_[a-f0-9]{12}$/', $name)) throw new RuntimeException('Unsafe cleanup target.');
    $server->exec('DROP DATABASE `'.$name.'`');
}
