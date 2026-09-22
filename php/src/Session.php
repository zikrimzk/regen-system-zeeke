<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class Session
{
    private const GOOGLE_LINK_TTL = 600;
    private const ROTATE_INTERVAL = 900;

    public static function start(?PDO $db = null): void
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
        ini_set('session.sid_length', '48');
        ini_set('session.sid_bits_per_character', '6');
        ini_set('session.lazy_write', '1');
        if ((string) Config::get('session.driver', 'files') === 'database' && $db instanceof PDO) {
            session_set_save_handler(new DatabaseSessionHandler($db, $ttl), true);
        } else {
            self::ensureWritableSavePath();
        }
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
        self::refreshLifecycle($db);
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
        $now = time();
        $_SESSION['userId'] = (int) ($user['id'] ?? 0);
        $_SESSION['userEmail'] = (string) ($user['email'] ?? '');
        $_SESSION['userName'] = trim(
            (string) ($user['first_name'] ?? $user['firstName'] ?? '')
            . ' '
            . (string) ($user['last_name'] ?? $user['lastName'] ?? '')
        );
        $_SESSION['loginAt'] = $now;
        $_SESSION['lastActivityAt'] = $now;
        $_SESSION['lastRotationAt'] = $now;
        $_SESSION['csrfToken'] = bin2hex(random_bytes(32));
    }

    /**
     * @param array{
     *   subject: string,
     *   email: string,
     *   firstName: string,
     *   lastName: string
     * } $identity
     */
    public static function rememberPendingGoogleIdentity(array $identity): void
    {
        session_regenerate_id(true);
        $_SESSION['pendingGoogleIdentity'] = [
            'subject' => (string) $identity['subject'],
            'email' => (string) $identity['email'],
            'firstName' => (string) $identity['firstName'],
            'lastName' => (string) $identity['lastName'],
            'expiresAt' => time() + self::GOOGLE_LINK_TTL,
        ];
    }

    /**
     * @return array{
     *   subject: string,
     *   email: string,
     *   firstName: string,
     *   lastName: string
     * }|null
     */
    public static function pendingGoogleIdentity(): ?array
    {
        $pending = $_SESSION['pendingGoogleIdentity'] ?? null;
        if (
            !is_array($pending)
            || (int) ($pending['expiresAt'] ?? 0) < time()
            || trim((string) ($pending['subject'] ?? '')) === ''
            || !filter_var((string) ($pending['email'] ?? ''), FILTER_VALIDATE_EMAIL)
        ) {
            self::clearPendingGoogleIdentity();
            return null;
        }

        return [
            'subject' => (string) $pending['subject'],
            'email' => (string) $pending['email'],
            'firstName' => (string) ($pending['firstName'] ?? ''),
            'lastName' => (string) ($pending['lastName'] ?? ''),
        ];
    }

    public static function clearPendingGoogleIdentity(): void
    {
        unset($_SESSION['pendingGoogleIdentity']);
    }

    public static function csrfToken(): string
    {
        $token = (string) ($_SESSION['csrfToken'] ?? '');
        if (strlen($token) !== 64 || !ctype_xdigit($token)) {
            $token = bin2hex(random_bytes(32));
            $_SESSION['csrfToken'] = $token;
        }
        return $token;
    }

    public static function validCsrfToken(string $token): bool
    {
        $expected = self::csrfToken();
        return $token !== '' && hash_equals($expected, $token);
    }

    public static function cachedAtsComment(string $key): ?string
    {
        $cache = $_SESSION['atsCommentCache'][$key] ?? null;
        if (
            !is_array($cache)
            || (int) ($cache['expiresAt'] ?? 0) < time()
            || trim((string) ($cache['comment'] ?? '')) === ''
        ) {
            unset($_SESSION['atsCommentCache'][$key]);
            return null;
        }
        return (string) $cache['comment'];
    }

    public static function cacheAtsComment(string $key, string $comment): void
    {
        $existing = is_array($_SESSION['atsCommentCache'] ?? null)
            ? $_SESSION['atsCommentCache']
            : [];
        if (count($existing) >= 5) {
            uasort(
                $existing,
                static fn (mixed $a, mixed $b): int =>
                    (int) ($a['expiresAt'] ?? 0) <=> (int) ($b['expiresAt'] ?? 0)
            );
            array_shift($existing);
        }
        $existing[$key] = [
            'comment' => Sanitizer::cleanText($comment, true, 420),
            'expiresAt' => time() + 3600,
        ];
        $_SESSION['atsCommentCache'] = $existing;
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

    private static function refreshLifecycle(?PDO $db): void
    {
        $now = time();
        if (!self::authenticated()) {
            self::csrfToken();
            return;
        }
        $absoluteTtl = (int) Config::get('session.ttl', 86400);
        $idleTtl = min($absoluteTtl, (int) Config::get('session.idle_ttl', 7200));
        $loginAt = (int) ($_SESSION['loginAt'] ?? $now);
        $lastActivityAt = (int) ($_SESSION['lastActivityAt'] ?? $now);

        if ($loginAt + $absoluteTtl < $now || $lastActivityAt + $idleTtl < $now) {
            self::destroy();
            self::start($db);
            return;
        }

        $lastRotationAt = (int) ($_SESSION['lastRotationAt'] ?? 0);
        if ($lastRotationAt + self::ROTATE_INTERVAL < $now) {
            session_regenerate_id(true);
            $_SESSION['lastRotationAt'] = $now;
        }
        $_SESSION['lastActivityAt'] = $now;
        self::csrfToken();
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
