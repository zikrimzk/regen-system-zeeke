<?php
declare(strict_types=1);

use ReGen\Application;
use ReGen\Config;
use ReGen\Database;
use ReGen\Http;
use ReGen\Session;

$projectRoot = dirname(__DIR__);
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

Config::load($projectRoot);
Http::applySecurityHeaders();

set_exception_handler(static function (Throwable $error): void {
    error_log('[ReGen PHP Error] ' . $error);
    if (Config::get('app.env', 'production') === 'production') {
        Http::json(['success' => false, 'message' => 'Internal server error.'], 500);
    } else {
        Http::json([
            'success' => false,
            'message' => $error->getMessage(),
            'type' => $error::class,
        ], 500);
    }
});

Session::start(
    (string) Config::get('session.driver', 'files') === 'database'
        ? Database::connection()
        : null
);

if (Http::contentLength() > 8 * 1024 * 1024) {
    Http::json(['success' => false, 'message' => 'Request is too large.'], 413);
}

$application = new Application(Database::connection(), $projectRoot);
$application->run();
