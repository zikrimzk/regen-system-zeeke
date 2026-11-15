<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$loader=require dirname(__DIR__).'/vendor/autoload.php';
$releaseMap=dirname(__DIR__).'/autoload-map.php';
if(is_file($releaseMap)){$loader->addPsr4('ReGen\\',dirname(__DIR__).'/src',true);$loader->addClassMap(require $releaseMap);}
use ReGen\{Config,Database,EmailVerificationService,ManagedRealtime,NotificationService,RealtimeEvents,SupportAttachments};
$root=is_file(dirname(__DIR__).'/bootstrap.php')?dirname(__DIR__,2):dirname(__DIR__);
$mode = $argv[1] ?? '';
if ($argc > 2 || !in_array($mode, ['', '--status'], true)) {
    fwrite(STDERR, "Usage: php process-notifications.php [--status]\n");
    exit(2);
}
try {
    Config::load($root);
    $db = Database::connection();
    $mailer = EmailVerificationService::fromConfig();
    if ($mode === '--status') {
        // No queue expansion, delivery, or customer details in this diagnostic.
        $summary = [
            'php' => PHP_VERSION,
            'mailConfigured' => $mailer->configured(),
            'lastWorkerRunUtc' => $db->query("SELECT updated_at FROM operations_settings WHERE setting_key='mail_worker'")->fetchColumn() ?: null,
            'broadcasts' => $db->query('SELECT status, COUNT(*) FROM notification_campaigns GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR),
            'emailQueue' => $db->query('SELECT status, COUNT(*) FROM email_outbox GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR),
        ];
        echo json_encode($summary, JSON_THROW_ON_ERROR)."\n";
        exit;
    }
    if (!$mailer->configured()) fwrite(STDERR, "Email delivery is not configured. In-app broadcasts can run; emails remain queued.\n");
    echo json_encode((new NotificationService($db))->work($mailer, 25), JSON_THROW_ON_ERROR)."\n";
}
catch (Throwable $error) {
    fwrite(STDERR, 'Notification worker failed: '.$error::class."\n");
    if (!isset($db) || $mode === '--status') exit(1);
    $failed = true;
}

// Optional delivery and cleanup must not prevent processing the notification queue.
try {
    $events = new RealtimeEvents($db);
    $events->dispatch();
    (new ManagedRealtime($db))->flush();
    $events->prune();
    (new SupportAttachments($db))->prune();
}
catch (Throwable $error) {
    fwrite(STDERR, 'Notification maintenance failed: '.$error::class."\n");
    $failed = true;
}
exit(isset($failed) ? 1 : 0);
