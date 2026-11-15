<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
$failures = [];
$count = 0;
$syntaxFiles = [];
foreach (['php', 'public', 'scripts'] as $folder) {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/' . $folder, FilesystemIterator::SKIP_DOTS)) as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'php') continue;
        $syntaxFiles[] = $file->getPathname();
    }
}
// PHP 8.3 lints multiple files. Small batches retain the native compiler check
// while avoiding a separate Windows process startup for every source file.
foreach (array_chunk($syntaxFiles, 10) as $files) {
    $output = [];
    exec(escapeshellarg(PHP_BINARY) . ' -l ' . implode(' ', array_map('escapeshellarg', $files)) . ' 2>&1', $output, $status);
    if ($status !== 0) $failures[] = implode("\n", $output);
    $count += count($files);
}
foreach (glob($root . '/php/views/*.html') ?: [] as $page) {
    $html = (string) file_get_contents($page);
    if (preg_match('/\son(?:click|change|input|submit|load|error)\s*=/i', $html)) $failures[] = basename($page) . ': inline script handler';
    preg_match_all('~(?:src|href)="(/(?:css|js|img|fonts|lib)/[^"?#]+)~', $html, $matches);
    foreach ($matches[1] as $asset) {
        if (!is_file($root . '/public' . $asset)) $failures[] = basename($page) . ': missing ' . $asset;
    }
    preg_match_all('~srcset="([^"]+)"~', $html, $sets);
    foreach ($sets[1] as $set) {
        foreach (explode(',', $set) as $candidate) {
            $asset = preg_split('/\s+/', trim($candidate))[0];
            if (str_starts_with($asset, '/img/') && !is_file($root . '/public' . strtok($asset, '?'))) $failures[] = basename($page) . ': missing responsive image ' . $asset;
        }
    }
}
require $root . '/vendor/autoload.php';
if (!class_exists(ReGen\Application::class)) $failures[] = 'Application cannot autoload.';
if (!class_exists(ReGen\PublicSite::class)) $failures[] = 'Public website cannot autoload.';
if (!class_exists(phpseclib3\Crypt\RSA::class)) $failures[] = 'Google ID-token verification requires phpseclib/phpseclib v3.';
try {
    $manifest = json_decode((string) file_get_contents($root . '/public/manifest.webmanifest'), true, 32, JSON_THROW_ON_ERROR);
    foreach ($manifest['icons'] ?? [] as $icon) {
        $file = $root . '/public' . $icon['src'];
        $size = is_file($file) ? getimagesize($file) : false;
        if ($size === false || $size[0] . 'x' . $size[1] !== $icon['sizes']) $failures[] = 'Invalid install icon: ' . $icon['src'];
    }
    foreach ($manifest['screenshots'] ?? [] as $screenshot) {
        $file = $root . '/public' . $screenshot['src'];
        $size = is_file($file) ? getimagesize($file) : false;
        if ($size === false || $size[0] . 'x' . $size[1] !== $screenshot['sizes']
            || ($size['mime'] ?? '') !== ($screenshot['type'] ?? '')) $failures[] = 'Invalid install screenshot: ' . $screenshot['src'];
    }
} catch (Throwable $error) {
    $failures[] = 'Invalid web app manifest: ' . $error->getMessage();
}
if ($failures !== []) { fwrite(STDERR, implode("\n", $failures) . "\n"); exit(1); }
echo "PHP syntax, action autoloading and page assets passed ($count PHP files).\n";
