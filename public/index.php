<?php
declare(strict_types=1);

$bootstrapCandidates = [
    dirname(__DIR__) . '/php/bootstrap.php',
    __DIR__ . '/_app/bootstrap.php',
];

foreach ($bootstrapCandidates as $bootstrap) {
    if (is_file($bootstrap)) {
        require $bootstrap;
        exit;
    }
}

http_response_code(500);
header('Content-Type: text/plain; charset=utf-8');
echo 'ReGen application files are incomplete.';
