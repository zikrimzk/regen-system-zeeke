<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$candidate = __DIR__ . (is_string($path) ? $path : '/');
if (is_file($candidate)) {
    return false;
}
require __DIR__ . '/index.php';
