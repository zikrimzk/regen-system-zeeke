<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__).'/vendor/autoload.php';

use ReGen\{AdminRepository, CampaignService, Config, EmailVerificationService, MailDeliveryRejected, MailDeliveryUncertain, MailRetryPolicy, NotificationService, UserRepository};

Config::load(dirname(__DIR__));
if (!in_array(Config::get('app.env'), ['development','test','testing'], true)
    || !in_array(Config::get('db.host'), ['localhost','127.0.0.1','::1'], true)) {
    throw new RuntimeException('This check requires a local development database.');
}
$connect = static fn(?string $name = null): PDO => new PDO(
    'mysql:host='.Config::get('db.host').';port='.Config::get('db.port').($name ? ';dbname='.$name : '').';charset=utf8mb4',
    (string) Config::get('db.user'), (string) Config::get('db.password'),
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]
);
$mailer = static fn(Closure $send): EmailVerificationService => new EmailVerificationService(
    'http://localhost:8089', 'testing', 'support@regen.local', 'ReGen', '', 3600, $send
);
if (($argv[1] ?? '') === '--worker') {
    if (!preg_match('/^regen_launch_test_[a-f0-9]{12}$/D', $argv[2] ?? '')) exit(2);
    $db = $connect($argv[2]);
    $transport = $mailer(static function(string $email) use ($db): bool {
        usleep(15000);
        $db->prepare('INSERT INTO delivery_probe (email) VALUES (?)')->execute([$email]);
        return true;
    });
    echo json_encode((new NotificationService($db))->work($transport, 100), JSON_THROW_ON_ERROR);
    exit;
}

$count = 0;
$check = static function(bool $condition, string $message) use (&$count): void {
    if (!$condition) throw new RuntimeException($message);
    $count++;
};
$server = $connect();
$name = 'regen_launch_test_'.bin2hex(random_bytes(6));
$server->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
try {
    $db = $connect($name);
    $db->exec("SET time_zone='+00:00'");
    $db->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));
    $db->exec('CREATE TABLE delivery_probe (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(200) NOT NULL)');
    // Seed fixture identities efficiently; this measures delivery, not registration hashing.
    $hash = password_hash('Launch-Fixture-567890', PASSWORD_DEFAULT);
    $insert = $db->prepare('INSERT INTO users (first_name,last_name,email,password_hash,email_verified_at) VALUES (?,?,?,?,UTC_TIMESTAMP())');
    $notices = new NotificationService($db);
    $preferences = ['account_email'=>false,'support_email'=>false,'announcement_email'=>true,'security_email'=>false,'in_app_enabled'=>false,'browser_enabled'=>false];
    $ids = [];
    for ($i=1; $i<=100; $i++) {
        $insert->execute(['Launch','Fixture '.$i,'launch'.$i.'@qa.regen.local',$hash]);
        $id = (int) $db->lastInsertId();
        $ids[] = $id;
        if ($i<=70) $notices->savePreferences($id, $preferences);
        $notices->notify($id, 'announcement', 'A launch delivery fixture', 'An opt-in notification for the local launch check.', '/notifications', 'launch:'.$id);
    }
    $check((int)$db->query('SELECT COUNT(*) FROM email_outbox')->fetchColumn()===70, 'Only opted-in accounts may enter the email queue.');
    $check((int)$db->query('SELECT COUNT(*) FROM user_notifications')->fetchColumn()===100, 'All 100 accounts must have their in-app record.');

    $admin = (int)(new AdminRepository($db))->findByEmail('admin@regen.com')['id'];
    $campaigns = new CampaignService($db);
    $body = ['title'=>'Launch message for everyone','body'=>'A message-only campaign for the first launch cohort.','color'=>'blue','status'=>'draft','audience'=>'all','rewardEnabled'=>false,'rewardAmount'=>5,'rewardLimit'=>1,'totalClaimLimit'=>0];
    $campaign = $campaigns->save(null, $body, $admin);
    $campaigns->save($campaign, array_replace($body, ['status'=>'active','version'=>1]), $admin);
    $workers = [];
    for ($i=0; $i<2; $i++) {
        $process = proc_open([PHP_BINARY,__FILE__,'--worker',$name], [1=>['pipe','w'],2=>['pipe','w']], $pipes);
        if (!is_resource($process)) throw new RuntimeException('Unable to start delivery worker.');
        $workers[] = [$process,$pipes];
    }
    foreach ($workers as [$process,$pipes]) {
        $out = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        $check(proc_close($process)===0 && $errors==='', 'Delivery worker failed: '.$errors);
        $check(is_array(json_decode($out, true)), 'Worker must return a structured result.');
    }
    $check((int)$db->query('SELECT COUNT(*) FROM delivery_probe')->fetchColumn()===70, 'Overlapping workers must deliver each eligible email once.');
    $check((int)$db->query('SELECT COUNT(*) FROM (SELECT email FROM delivery_probe GROUP BY email HAVING COUNT(*)>1) duplicate_mail')->fetchColumn()===0, 'No duplicate email deliveries are allowed.');
    $check((int)$db->query("SELECT COUNT(*) FROM email_outbox WHERE status='accepted'")->fetchColumn()===70, 'Successful handoffs must be recorded as accepted.');
    $campaigns->deliverBatch(); $campaigns->deliverBatch();
    foreach ($ids as $id) $campaigns->syncUser($id);
    $row = $campaigns->listing()['items'][0];
    $check((int)$row['delivered_count']===100 && (int)$row['eligible_count']===100, 'Campaign delivery diagnostics must cover all 100 accounts without duplicates.');
    $check($row['visibility']['state']==='live', 'A currently published campaign must report Live.');

    $notices->notify($ids[0], 'announcement', 'Permanent rejection', 'A fixture for a definitive server rejection.');
    $notices->work($mailer(static function(): bool { throw new MailDeliveryRejected(550); }), 100);
    $check((int)$db->query("SELECT COUNT(*) FROM email_outbox WHERE status='failed' AND attempts=1")->fetchColumn()===1, 'A permanent rejection must stop after one attempt.');
    $notices->notify($ids[1], 'announcement', 'Temporary failure', 'A fixture for a temporary transport problem.');
    $notices->work($mailer(static fn(): bool => false), 100);
    $delay = (int)$db->query("SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),available_at) FROM email_outbox WHERE status='pending'")->fetchColumn();
    $check($delay>=1790 && $delay<=1930, 'Transient retries must be spaced out with bounded jitter.');
    $notices->notify($ids[2], 'announcement', 'Uncertain acknowledgement', 'This delivery requires investigation.');
    $notices->work($mailer(static function(): bool { throw new MailDeliveryUncertain('Fixture acknowledgement interrupted.'); }), 100);
    $check((int)$db->query("SELECT COUNT(*) FROM email_outbox WHERE status='uncertain'")->fetchColumn()===1, 'Uncertain handoffs must remain outside automatic retry.');
    $notices->work($mailer(static fn(): bool => true), 100);
    $check((int)$db->query("SELECT COUNT(*) FROM email_outbox WHERE status='uncertain'")->fetchColumn()===1, 'A later worker must not resend an uncertain handoff.');
    $notices->notify($ids[3], 'announcement', 'Withdrawn consent', 'This message must not be sent.');
    $notices->savePreferences($ids[3], array_replace($preferences, ['announcement_email'=>false]));
    $notices->work($mailer(static fn(): bool => true), 100);
    $check((int)$db->query("SELECT COUNT(*) FROM email_outbox WHERE status='skipped'")->fetchColumn()===1, 'Delivery must recheck consent immediately before sending.');
    $check(MailRetryPolicy::delaySeconds(2,1)>MailRetryPolicy::delaySeconds(1,1), 'Retry delays should increase after repeated failures.');

    $users = new UserRepository($db);
    $token = EmailVerificationService::hashToken(EmailVerificationService::createToken());
    $newUser = $users->createUnverified(
        ['firstName'=>'New','lastName'=>'Password','email'=>'welcome-password@qa.regen.local','password'=>'Fixture-Password-12345'],
        $token, gmdate('Y-m-d H:i:s', time()+3600)
    );
    $check(!(bool)$db->query("SELECT 1 FROM user_notifications WHERE dedupe_key LIKE 'welcome:%'")->fetchColumn(), 'Do not queue a separate welcome message to an unverified registration.');
    $check($users->consumeVerificationToken($token) && !$users->consumeVerificationToken($token), 'Only the first verification succeeds.');
    $googleUser = $users->createFromGoogle(['subject'=>'welcome-fixture','email'=>'welcome-google@qa.regen.local','firstName'=>'New','lastName'=>'Google']);
    $notices->welcome((int)$newUser['id']);
    $users->markEmailVerified((int)$googleUser['id']);
    $delivered = [];
    $welcomeMailer = $mailer(static function(string $email, string $subject, string $body) use (&$delivered): bool {
        $delivered[$email][] = [$subject, str_contains(quoted_printable_decode($body), '/dashboard')];
        return true;
    });
    $notices->work($welcomeMailer, 100);
    $notices->work($welcomeMailer, 100);
    $check($delivered === [
        'welcome-password@qa.regen.local'=>[['Welcome to ReGen', true]],
        'welcome-google@qa.regen.local'=>[['Welcome to ReGen', true]],
    ], 'New password and Google accounts receive one welcome email each without optional alert consent.');
    $check((int)$db->query("SELECT COUNT(*) FROM email_delivery_logs WHERE purpose='welcome' AND status='accepted'")->fetchColumn()===2, 'Welcome acceptance must be visible in delivery diagnostics.');
    echo "Launch delivery passed ($count assertions; isolated accounts, overlapping workers, no external email).\n";
} finally {
    $db = null;
    $server->exec('DROP DATABASE IF EXISTS `'.$name.'`');
}
