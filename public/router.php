<?php
declare(strict_types=1);

$path = rawurldecode((string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'));
if (preg_match('#(?:^|/)(?:\.|_app|vendor|database|storage|scripts)|\.(?:env|sql|log|ini|bak|zip)$#i', $path)) {
    http_response_code(404);
    exit;
}
$candidate = realpath(__DIR__ . $path);
if ($candidate !== false && str_starts_with($candidate, __DIR__ . DIRECTORY_SEPARATOR)
    && is_file($candidate) && !preg_match('/\.(?:html|php)$/i', $candidate)) {
    return false;
}
require __DIR__ . '/index.php';
