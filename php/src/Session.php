<?php
declare(strict_types=1);

namespace ReGen;

final class Session
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $secure = self::isHttps();
        $ttl = (int) Config::get('session.ttl', 86400);

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.gc_maxlifetime', (string) $ttl);
        self::ensureWritableSavePath();
        $configuredName = (string) Config::get('session.name', 'regen_sid');
        $cookieName = preg_replace('/[^A-Za-z0-9_-]/', '_', $configuredName) ?: 'regen_sid';
        session_name($cookieName);
        session_set_cookie_params([
            'lifetime' => $ttl,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    public static function authenticated(): bool
    {
        return isset($_SESSION['userId']) && (int) $_SESSION['userId'] > 0;
    }

    public static function userId(): int
    {
        return (int) ($_SESSION['userId'] ?? 0);
    }

    /** @param array<string, mixed> $user */
    public static function establish(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['userId'] = (int) ($user['id'] ?? 0);
        $_SESSION['userEmail'] = (string) ($user['email'] ?? '');
        $_SESSION['userName'] = trim(
            (string) ($user['first_name'] ?? $user['firstName'] ?? '')
            . ' '
            . (string) ($user['last_name'] ?? $user['lastName'] ?? '')
        );
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] ?: '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) ($params['secure'] ?? false),
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
    }

    private static function isHttps(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }
        return strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    }

    private static function ensureWritableSavePath(): void
    {
        $configured = trim((string) session_save_path());
        $path = $configured;
        if (str_contains($path, ';')) {
            $parts = explode(';', $path);
            $path = (string) end($parts);
        }
        if ($path !== '' && is_dir($path) && is_writable($path)) {
            return;
        }

        $fallback = rtrim(sys_get_temp_dir(), '/\\') . '/regen-sessions';
        if (!is_dir($fallback)) {
            @mkdir($fallback, 0700, true);
        }
        if (is_dir($fallback) && is_writable($fallback)) {
            session_save_path($fallback);
        }
    }
}
