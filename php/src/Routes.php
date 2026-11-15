<?php
declare(strict_types=1);

namespace ReGen;

/** Route access metadata shared by the front controller and existing dispatchers. */
final class Routes
{
    public const PAGES = [
        '/login' => ['login.html', 'auth'],
        '/register' => ['register.html', 'auth'],
        '/verify-email' => ['verify-email.html', 'auth'],
        '/reset-password' => ['reset-password.html', 'auth'],
        '/dashboard' => ['dashboard.html', 'candidate'],
        '/resumes' => ['dashboard.html', 'candidate'],
        '/builder' => ['builder.html', 'candidate'],
        '/templates' => ['templates.html', 'candidate'],
        '/cover-letters' => ['cover-letters.html', 'candidate'],
        '/profile' => ['profile.html', 'candidate'],
        '/settings' => ['profile.html', 'candidate'],
        '/tailor' => ['upcoming.html', 'candidate'],
        '/jobs/saved' => ['upcoming.html', 'candidate'],
        '/applications' => ['upcoming.html', 'candidate'],
        '/interview' => ['upcoming.html', 'candidate'],
        '/support' => ['support.html', 'candidate'],
        '/notifications' => ['notifications.html', 'candidate'],
        '/feedback' => ['feedback.html', 'candidate'],
        '/store' => ['store.html', 'candidate'],
        '/token-activity' => ['token-activity.html', 'candidate'],
        '/payments' => ['payments.html', 'candidate'],
        '/payments/result' => ['payments.html', 'candidate'],
        '/mochi' => ['mochi.html', 'candidate'],
        '/admin' => ['admin.html', 'admin'],
        '/admin/login' => ['admin-login.html', 'admin-auth'],
    ];

    private const LEGACY_PAGES = [
        '/index.html' => '/', '/admin-login.html' => '/admin/login', '/admin.html' => '/admin',
        '/login.html' => '/login', '/register.html' => '/register', '/verify-email.html' => '/verify-email',
        '/reset-password.html' => '/reset-password', '/dashboard.html' => '/dashboard',
        '/resumes.html' => '/resumes', '/settings.html' => '/settings',
        '/tailor.html' => '/tailor', '/jobs/saved.html' => '/jobs/saved',
        '/applications.html' => '/applications', '/interview.html' => '/interview',
        '/builder.html' => '/builder', '/templates.html' => '/templates', '/cover-letters.html' => '/cover-letters',
        '/profile.html' => '/profile', '/support.html' => '/support', '/notifications.html' => '/notifications',
        '/feedback.html' => '/feedback', '/store.html' => '/store', '/token-activity.html' => '/token-activity',
        '/payments.html' => '/payments', '/payments/result.html' => '/payments/result', '/mochi.html' => '/mochi',
    ];

    private const PUBLIC_AUTH_POSTS = [
        '/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/auth/email-verification/verify',
        '/api/auth/email-verification/resend', '/api/auth/password-reset', '/api/admin/auth/login',
    ];

    private const REALTIME = [
        '/api/realtime/session' => 'GET', '/api/realtime/changes' => 'GET',
        '/api/realtime/events' => 'GET', '/api/realtime/authorize' => 'POST',
    ];

    public static function legacyPage(string $path, string $method): ?string
    {
        return in_array($method, ['GET', 'HEAD'], true) ? (self::LEGACY_PAGES[$path] ?? null) : null;
    }

    public static function webhookMode(string $path, string $method): ?string
    {
        if ($method !== 'POST') return null;
        return match ($path) {
            '/api/webhooks/hitpay/sandbox' => 'sandbox',
            '/api/webhooks/hitpay/live' => 'live',
            default => null,
        };
    }

    public static function publicAuthMutation(string $path, string $method): bool
    {
        return $method === 'POST' && in_array($path, self::PUBLIC_AUTH_POSTS, true);
    }

    public static function adminApi(string $path): bool
    {
        return str_starts_with($path, '/api/admin/');
    }

    public static function realtime(string $path, string $method): bool
    {
        return (self::REALTIME[$path] ?? null) === $method;
    }

    public static function maintenanceBlocks(string $path, string $method): bool
    {
        $path = self::legacyPage($path, $method) ?? $path;
        if (isset(self::PAGES[$path])) return in_array(self::PAGES[$path][1], ['auth', 'candidate'], true);
        if (!str_starts_with($path, '/api/') || self::adminApi($path)) return false;
        if (self::webhookMode($path, $method) !== null || self::realtime($path, $method)) return false;
        if ($method === 'GET' && in_array($path, ['/api/health', '/api/system/status'], true)) return false;
        return !($path === '/api/auth/logout' && $method === 'POST');
    }

    public static function privateResponse(string $path): bool
    {
        return str_starts_with($path, '/api/') || isset(self::PAGES[$path])
            || isset(self::LEGACY_PAGES[$path]) || $path === '/maintenance';
    }

    public static function pageUrl(string $path, string $requestUri): string
    {
        $query = parse_url($requestUri, PHP_URL_QUERY);
        return is_string($query) && strlen($query) <= 4096 && !preg_match('/[\x00-\x20\x7f]/', $query)
            ? $path . '?' . $query : $path;
    }

    /** Only known local pages may be restored after sign-in or maintenance. */
    public static function returnTarget(string $url, bool $includeAuth = false): ?string
    {
        if (strlen($url) > 4096 || !str_starts_with($url, '/') || str_starts_with($url, '//')
            || str_contains($url, '\\') || preg_match('/[\x00-\x20\x7f<>#]/', $url)) return null;
        $path = parse_url($url, PHP_URL_PATH);
        if (!is_string($path)) return null;
        $path = rtrim($path, '/');
        $path = self::LEGACY_PAGES[$path] ?? $path;
        $group = self::PAGES[$path][1] ?? null;
        if ($group !== 'candidate' && !($includeAuth && $group === 'auth')) return null;
        return self::pageUrl($path, $url);
    }
}
