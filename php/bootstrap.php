<?php
declare(strict_types=1);

use ReGen\Application;
use ReGen\Config;
use ReGen\Database;
use ReGen\ErrorReporter;
use ReGen\Http;
use ReGen\PaymentWebhookController;
use ReGen\PublicSite;
use ReGen\ReadinessController;
use ReGen\Routes;
use ReGen\Session;

$projectRoot = dirname(__DIR__);
ini_set('display_errors', '0');
$autoloadCandidates = [
    $projectRoot . '/vendor/autoload.php',
    __DIR__ . '/vendor/autoload.php',
];

$autoloadLoaded = false;
foreach ($autoloadCandidates as $autoload) {
    if (is_file($autoload)) {
        $loader = require $autoload;
        if (
            is_object($loader)
            && method_exists($loader, 'addPsr4')
        ) {
            $loader->addPsr4('ReGen\\', __DIR__ . '/src', true);
            $releaseMap = __DIR__ . '/autoload-map.php';
            if (is_file($releaseMap)) $loader->addClassMap(require $releaseMap);
        }
        $autoloadLoaded = true;
        break;
    }
}

if (!$autoloadLoaded) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Application dependencies are missing. Run Composer before deployment.',
    ]);
    exit;
}

set_exception_handler(static function (Throwable $error): void {
    if ($error instanceof \ReGen\DocumentRecoveryConflict) Http::json(['success'=>false,'code'=>'DOCUMENT_RECOVERED','message'=>$error->getMessage()],409);
    $requestId = ErrorReporter::report($error);
    if (Config::get('app.env', 'production') === 'production') {
        Http::json(['success' => false, 'message' => 'Internal server error.', 'requestId' => $requestId], 500);
    } else {
        Http::json([
            'success' => false,
            'message' => $error->getMessage(),
            'type' => $error::class,
            'requestId' => $requestId,
        ], 500);
    }
});

Config::load($projectRoot);
ini_set('display_errors', Config::get('app.env') === 'production' ? '0' : '1');
ini_set('log_errors', '1');
Http::applySecurityHeaders();
if (Http::method() === 'GET' && Http::path() === '/api/health') ReadinessController::serve();
if (Routes::legacyPage(Http::path(), Http::method()) === '/') {
    Http::redirect(Routes::pageUrl('/', (string) ($_SERVER['REQUEST_URI'] ?? '/')));
}
if (Http::path() === '/' && Http::method() === 'GET') {
    try { (new \ReGen\OperationsMonitor(Database::connection()))->recordLanding(); }
    catch (\Throwable $error) { error_log('[Landing Analytics] ' . $error::class); }
}
PublicSite::dispatch($projectRoot);

if (Http::contentLength() > 32 * 1024 * 1024) {
    Http::json(['success' => false, 'message' => 'Request is too large.'], 413);
}

$db = Database::connection();
$webhookMode = Routes::webhookMode(Http::path(), Http::method());
if ($webhookMode !== null) PaymentWebhookController::serve($db, $webhookMode);
Session::start((string) Config::get('session.driver', 'files') === 'database' ? $db : null);

\ReGen\RealtimeEndpoint::dispatch($db, $projectRoot);
$application = new Application($db, $projectRoot);
$application->run();
