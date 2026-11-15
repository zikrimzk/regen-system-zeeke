<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$root = dirname(__DIR__);
$includeEnv = in_array('--with-env', $argv, true);
require $root . '/vendor/autoload.php';
ReGen\Config::load($root);
if (!class_exists(ZipArchive::class)) {
    fwrite(STDERR, "Enable the local PHP ZIP extension to build a release.\n");
    exit(1);
}
if ($includeEnv && (ReGen\Config::get('app.env') !== 'production'
    || ReGen\Config::get('session.driver') !== 'database'
    || !str_starts_with((string) ReGen\Config::get('app.url'), 'https://'))) {
    fwrite(STDERR, "Private releases require APP_ENV=production, HTTPS APP_URL and SESSION_DRIVER=database.\n");
    exit(1);
}
$destination = $root . '/release';
if (!is_dir($destination) && !mkdir($destination, 0700, true)) throw new RuntimeException('Cannot create release directory.');
$path = $destination . '/regen-php' . ($includeEnv ? '-private' : '') . '.zip';
$temporary = $path . '.tmp';
$zip = new ZipArchive();
if ($zip->open($temporary, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new RuntimeException('Cannot open release ZIP.');

// PACKAGE AN ALLOWLIST; NEVER COPY WORKSPACE DATA OR TEST FIXTURES.
$map = ['public' => '', 'php' => '_app/', 'vendor' => '_app/vendor/', 'database' => '_app/database/'];
$names = [];
$publicFingerprint = hash_init('sha256');
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/public', FilesystemIterator::SKIP_DOTS)) as $asset) {
    if ($asset->isFile() && !str_contains(str_replace('\\', '/', $asset->getPathname()), '/uploads/')) {
        hash_update($publicFingerprint, hash_file('sha256', $asset->getPathname()));
    }
}
foreach (glob($root . '/php/views/*.html') ?: [] as $view) hash_update($publicFingerprint, hash_file('sha256', $view));
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/php/src', FilesystemIterator::SKIP_DOTS)) as $source) {
    if ($source->isFile() && $source->getExtension() === 'php') hash_update($publicFingerprint, hash_file('sha256', $source->getPathname()));
}
$workerVersion = 'regen-public-' . substr(hash_final($publicFingerprint), 0, 16);
foreach ($map as $directory => $prefix) {
    $base = $root . '/' . $directory;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if (!$file->isFile() || $file->isLink()) continue;
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($base) + 1));
        if ($directory === 'public' && ($relative === 'router.php' || str_starts_with($relative, '__design-qa') || str_starts_with($relative, 'uploads/'))) continue;
        if (preg_match('#(?:^|/)(?:\.env[^/]*|config\.local[^/]*|\.git)(?:/|$)#', $relative)) continue;
        $name = $prefix . $relative;
        if ($directory === 'php' && str_starts_with($relative, 'views/') && $file->getExtension() === 'html') {
            $html = preg_replace_callback(
                '~((?:src|href)=")(/(?:css|js|img)/[^"?]+)(?:\?v=[^"]*)?(")~',
                static function (array $match) use ($root): string {
                    $asset = $root . '/public' . $match[2];
                    $version = is_file($asset) ? substr(hash_file('sha256', $asset), 0, 12) : 'missing';
                    return $match[1] . $match[2] . '?v=' . $version . $match[3];
                },
                (string) file_get_contents($file->getPathname())
            );
            $html = preg_replace_callback('~srcset="([^"]+)"~', static function (array $set) use ($root): string {
                return 'srcset="' . preg_replace_callback('~/img/[^\s,?]+~', static function (array $image) use ($root): string {
                    $file = $root . '/public' . $image[0];
                    return is_file($file) ? $image[0] . '?v=' . substr(hash_file('sha256', $file), 0, 12) : $image[0];
                }, $set[1]) . '"';
            }, $html);
            $added = $zip->addFromString($name, $html);
        } elseif ($directory === 'public' && $relative === 'sw.js') {
            $worker = preg_replace("/const CACHE_VERSION = '[^']+';/", "const CACHE_VERSION = '" . $workerVersion . "';", (string) file_get_contents($file->getPathname()));
            // Warm the same versioned URLs that the HTML requests, avoiding duplicate downloads.
            $worker = preg_replace_callback("~'(/(?:css|js|img)/[^'?]+)'~", static function (array $match) use ($root): string {
                $asset = $root . '/public' . $match[1];
                return is_file($asset) ? "'" . $match[1] . '?v=' . substr(hash_file('sha256', $asset), 0, 12) . "'" : $match[0];
            }, $worker);
            $added = $zip->addFromString($name, $worker);
        } else {
            $added = $zip->addFile($file->getPathname(), $name);
        }
        if (!$added) throw new RuntimeException('Cannot package ' . $name);
        $names[] = $name;
    }
}
if (!$zip->addFile($root . '/public/uploads/.htaccess', 'uploads/.htaccess')) throw new RuntimeException('Missing upload protection.');
if (!$zip->addFile($root . '/scripts/process-notifications.php', '_app/jobs/process-notifications.php')) throw new RuntimeException('Missing notification worker.');
$names[] = '_app/jobs/process-notifications.php';
$zip->addFromString('storage/.htaccess', "Require all denied\n");
// OVERRIDE COMPOSER'S SOURCE PATHS AFTER FLATTENING THE RELEASE.
$autoloadMap = "<?php\ndeclare(strict_types=1);\nreturn [\n";
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/php/src', FilesystemIterator::SKIP_DOTS)) as $file) {
    if (!$file->isFile() || $file->getExtension() !== 'php') continue;
    $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($root . '/php/src/') ));
    $class = 'ReGen\\' . str_replace('/', '\\', substr($relative, 0, -4));
    $autoloadMap .= '    ' . var_export($class, true) . ' => __DIR__ . ' . var_export('/src/' . $relative, true) . ",\n";
}
$zip->addFromString('_app/autoload-map.php', $autoloadMap . "];\n");
$names[] = '_app/autoload-map.php';
$zip->addFile($root . '/.env.example', '.env.example');
$zip->addFile($root . '/docs/ASSIST_ME_UPDATE.md', '_app/ASSIST_ME_UPDATE.md');
$zip->addFile($root . '/docs/ADMIN_CONTROL_CENTRE.md', '_app/ADMIN_CONTROL_CENTRE.md');
$zip->addFile($root . '/docs/ADMIN_REFINEMENT.md', '_app/ADMIN_REFINEMENT.md');
$zip->addFile($root . '/docs/ADMIN_UAT_NOVEMBER.md', '_app/ADMIN_UAT_NOVEMBER.md');
$zip->addFile($root . '/docs/UAT_STATUS_2026-11-06.md', '_app/UAT_STATUS_2026-11-06.md');
$zip->addFile($root . '/docs/LIVE_OPERATIONS.md', '_app/LIVE_OPERATIONS.md');
$zip->addFile($root . '/docs/MANAGED_REALTIME_DIRECTADMIN.md', '_app/MANAGED_REALTIME_DIRECTADMIN.md');
foreach (['TOKEN_STORE_PHASE_ONE.md','UAT_STATUS_2026-11-07.md','HITPAY_CHECKOUT.md'] as $guide) {
    if (!$zip->addFile($root . '/docs/' . $guide, '_app/' . $guide)) throw new RuntimeException('Missing current deployment guide: ' . $guide);
}
$zip->addFile($root . '/docs/EMAIL_DIRECTADMIN.md', '_app/EMAIL_SETUP.md');
$zip->addFile($root . '/docs/MOCHI_COACH.md', '_app/MOCHI_COACH.md');
$zip->addFile($root . '/docs/UAT_UPDATE.md', '_app/UAT_UPDATE.md');
$zip->addFile($root . '/docs/PWA_READINESS.md', '_app/PWA_READINESS.md');
$zip->addFile($root . '/docs/PWA_AUDIT_2026-10-30.md', '_app/PWA_AUDIT_2026-10-30.md');
$zip->addFile($root . '/docs/PWA_SCORE_REVIEW.md', '_app/PWA_SCORE_REVIEW.md');
$zip->addFile($root . '/docs/TEMPLATE_DESIGN_STANDARD.md', '_app/TEMPLATE_DESIGN_STANDARD.md');
$zip->addFile($root . '/docs/RESUME_ENGINE_UPDATE.md', '_app/RESUME_ENGINE_UPDATE.md');
$zip->addFile($root . '/docs/WRITING_STANDARDS.md', '_app/WRITING_STANDARDS.md');
$zip->addFile($root . '/docs/AI_WRITING_PROMPTS.md', '_app/AI_WRITING_PROMPTS.md');
$zip->addFile($root . '/docs/LANDING_MOBILE_UPDATE.md', '_app/LANDING_MOBILE_UPDATE.md');
if ($includeEnv) {
    if (!is_file($root . '/.env') || !$zip->addFile($root . '/.env', '.env')) throw new RuntimeException('Missing production .env.');
}
$zip->addFromString('release.json', json_encode([
    'builtAt' => gmdate(DATE_ATOM),
    'runtime' => 'PHP',
    'latestMigration' => '027_mochi_personal_coach.sql',
    'privateConfiguration' => $includeEnv,
    'sourceRevision' => trim((string) shell_exec('git rev-parse --short HEAD')),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
foreach (['_app/database/migrations/017_realtime_and_maintenance.sql','_app/src/RealtimeEvents.php','_app/src/RealtimeConnection.php','_app/src/MaintenanceService.php','_app/src/Actions/LiveActions.php','_app/views/maintenance.html','js/realtime.js','js/maintenance.js','js/admin-maintenance.js','css/maintenance.css','css/pdf-pages.css','index.php', '.htaccess', '_app/.htaccess', '_app/bootstrap.php', '_app/views/admin.html', '_app/views/support.html', '_app/vendor/autoload.php', '_app/database/schema.sql', '_app/database/migrations/015_feedback_limits_and_support_context.sql', '_app/jobs/process-notifications.php', 'css/workspace-shell.css', '_app/src/WorkspaceShell.php', 'js/admin-templates.js', 'img/brand-wordmark-232.webp', '_app/src/CampaignService.php', '_app/src/Actions/AdminWorkspaceActions.php', '_app/database/migrations/016_campaigns_and_uat_controls.sql', 'js/admin-campaigns.js', 'js/admin-charts.js', 'js/campaigns.js', 'css/campaigns.css', 'js/admin-insights.js', 'js/feedback.js', 'css/feedback.css', '_app/views/feedback.html', 'js/admin-control-centre.js', 'css/admin-control-centre.css', 'js/service-centre.js', 'js/ui.js'] as $required) {
    if (!in_array($required, $names, true)) throw new RuntimeException('Release is incomplete: ' . $required);
}
foreach (['_app/database/migrations/019_support_and_token_store.sql','_app/src/TokenStore.php','_app/src/FeaturePricing.php','_app/src/SupportAttachments.php','_app/src/Actions/CommerceActions.php','_app/views/store.html','_app/views/feature-access.html','js/store.js','js/feature-access.js','js/support-attachments.js','js/live-notifications.js','js/admin-store.js','css/token-store.css','css/support-attachments.css','css/admin-commerce.css','img/regen-token.svg'] as $required) {
    if (!in_array($required, $names, true)) throw new RuntimeException('Store and support release is incomplete: ' . $required);
}
foreach (['_app/database/migrations/026_hitpay_orders.sql', '_app/src/HitPay.php', '_app/src/HitPayCheckoutException.php', '_app/src/PaymentOrders.php',
    '_app/src/Actions/PaymentActions.php', '_app/views/payments.html', 'js/payments.js', 'css/payments.css'] as $required) {
    if (!in_array($required, $names, true)) throw new RuntimeException('HitPay release is incomplete: ' . $required);
}
foreach (['_app/database/migrations/027_mochi_personal_coach.sql', '_app/src/MochiCoach.php', '_app/src/MochiProfile.php', '_app/views/mochi.html',
    'js/mochi.js', 'js/mochi-avatar.js', 'js/mochi-activities.js', 'js/mochi-play.js', 'js/mochi-assist.js', 'css/mochi.css', 'img/mochi-coach.webp'] as $required) {
    if (!in_array($required, $names, true)) throw new RuntimeException('Mochi release is incomplete: ' . $required);
}
if (!$zip->close()) throw new RuntimeException('Cannot finish release ZIP.');
if (is_file($path) && !unlink($path)) throw new RuntimeException('Cannot replace previous release.');
if (!rename($temporary, $path)) throw new RuntimeException('Cannot publish release ZIP.');
echo basename($path) . ': ' . number_format(filesize($path) / 1048576, 2) . " MB\n";
echo 'SHA256: ' . hash_file('sha256', $path) . "\n";
