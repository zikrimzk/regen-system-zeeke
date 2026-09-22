<?php
declare(strict_types=1);

namespace ReGen;

final class Http
{
    /** @var array<string, mixed>|null */
    private static ?array $jsonBody = null;

    public static function applySecurityHeaders(): void
    {
        $requestId = bin2hex(random_bytes(8));
        $_SERVER['REGEN_REQUEST_ID'] = $requestId;
        header('X-Request-ID: ' . $requestId);
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()');
        header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
        header('Cross-Origin-Resource-Policy: same-origin');
        header(
            "Content-Security-Policy: default-src 'self'; "
            . "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; "
            . "script-src 'self' https://accounts.google.com/gsi/client "
            . "https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; "
            . "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; "
            . "img-src 'self' data: blob:; font-src 'self'; "
            . "connect-src 'self' https://accounts.google.com/gsi/ https://www.google.com/recaptcha/; "
            . "frame-src 'self' https://accounts.google.com/ https://www.google.com/recaptcha/ "
            . "https://recaptcha.google.com/recaptcha/;"
        );
        if (self::isHttps() && Config::get('app.env', 'production') === 'production') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        $path = self::path();
        if (
            str_starts_with($path, '/api/')
            || in_array($path, ['/', '/login', '/register', '/verify-email', '/dashboard', '/builder'], true)
        ) {
            header('Cache-Control: no-store');
            header('Pragma: no-cache');
        }
    }

    public static function path(): string
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $path = rawurldecode(is_string($path) ? $path : '/');
        if ($path !== '/') {
            $path = rtrim($path, '/');
        }
        return $path ?: '/';
    }

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function contentLength(): int
    {
        return max(0, (int) ($_SERVER['CONTENT_LENGTH'] ?? 0));
    }

    /** @return array<string, mixed> */
    public static function jsonBody(): array
    {
        if (self::$jsonBody !== null) {
            return self::$jsonBody;
        }
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return self::$jsonBody = [];
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
            self::json(['success' => false, 'message' => 'Request body must be valid JSON.'], 400);
        }
        return self::$jsonBody = $decoded;
    }

    /** @param array<string, mixed> $payload */
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            $payload,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );
        exit;
    }

    public static function html(string $html, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        exit;
    }

    public static function redirect(string $location, int $status = 302): never
    {
        http_response_code($status);
        header('Location: ' . $location);
        exit;
    }

    public static function requireSameOriginForMutation(): void
    {
        if (in_array(self::method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $fetchSite = strtolower(trim((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')));
        if (in_array($fetchSite, ['cross-site', 'same-site'], true)) {
            self::json(['success' => false, 'message' => 'Request origin is not allowed.'], 403);
        }
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin === '') {
            return;
        }
        $originParts = parse_url($origin);
        $originScheme = is_array($originParts) ? strtolower((string) ($originParts['scheme'] ?? '')) : '';
        $originHost = is_array($originParts) ? strtolower((string) ($originParts['host'] ?? '')) : '';
        $originPort = is_array($originParts) ? (int) ($originParts['port'] ?? 0) : 0;
        $requestHostHeader = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $requestParts = parse_url((self::isHttps() ? 'https://' : 'http://') . $requestHostHeader);
        $requestScheme = self::isHttps() ? 'https' : 'http';
        $requestHost = is_array($requestParts) ? strtolower((string) ($requestParts['host'] ?? '')) : '';
        $requestPort = is_array($requestParts) ? (int) ($requestParts['port'] ?? 0) : 0;
        $defaultOriginPort = $originScheme === 'https' ? 443 : 80;
        $defaultRequestPort = $requestScheme === 'https' ? 443 : 80;

        if (
            $originScheme !== $requestScheme
            || $originHost === ''
            || !hash_equals($requestHost, $originHost)
            || ($originPort ?: $defaultOriginPort) !== ($requestPort ?: $defaultRequestPort)
        ) {
            self::json(['success' => false, 'message' => 'Request origin is not allowed.'], 403);
        }
    }

    public static function requireCsrfToken(string $expectedToken): void
    {
        $provided = trim((string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        if (
            $expectedToken === ''
            || $provided === ''
            || !hash_equals($expectedToken, $provided)
            || !Session::validCsrfToken($provided)
        ) {
            self::json([
                'success' => false,
                'message' => 'Your secure session changed. Refresh the page and try again.',
            ], 403);
        }
    }

    public static function clientAcceptsJson(): bool
    {
        return str_contains(strtolower($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json')
            || str_starts_with(self::path(), '/api/');
    }

    private static function isHttps(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }
        return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }
}
