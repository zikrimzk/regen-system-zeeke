<?php
declare(strict_types=1);

namespace ReGen;

final class Http
{
    /** @var array<string, mixed>|null */
    private static ?array $jsonBody = null;
    private static array $successCallbacks=[];

    public static function onSuccess(callable $callback): void { self::$successCallbacks[]=$callback; }

    /** Complete priced access before any successful response body leaves the server. */
    public static function completeSuccess(): void
    {
        $callbacks=self::$successCallbacks;self::$successCallbacks=[];
        foreach($callbacks as $callback)$callback();
    }

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
        $managedConnect=ManagedRealtime::configured()?' wss://ws-'.Config::get('realtime.pusher_cluster').'.pusher.com':'';
        header(
            "Content-Security-Policy: default-src 'self'; "
            . "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; "
            . "script-src 'self' https://accounts.google.com/gsi/client "
            . "https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; "
            . "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; "
            . "img-src 'self' data: blob:; font-src 'self' blob:; worker-src 'self'; "
            . "connect-src 'self' https://accounts.google.com/gsi/ https://www.google.com/recaptcha/".$managedConnect."; "
            . "frame-src 'self' https://accounts.google.com/ https://www.google.com/recaptcha/ "
            . "https://recaptcha.google.com/recaptcha/;"
        );
        if (self::isHttps() && Config::get('app.env', 'production') === 'production') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        $path = self::path();
        if ($path !== '/' && !in_array($path, ['/pricing', '/robots.txt', '/sitemap.xml'], true)) {
            header('X-Robots-Tag: noindex, nofollow');
        }
        if (Routes::privateResponse($path)) {
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
        // LIMIT BODY ALLOCATION BEFORE DECODING.
        $maximum = 3 * 1024 * 1024;
        if (self::contentLength() > $maximum) self::json(['success'=>false, 'message'=>'Request is too large.'], 413);
        $raw = file_get_contents('php://input', false, null, 0, $maximum + 1);
        if (is_string($raw) && strlen($raw) > $maximum) self::json(['success'=>false, 'message'=>'Request is too large.'], 413);
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
        if($status>=200&&$status<300&&($payload['success']??true)!==false)self::completeSuccess();
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
        if($status>=200&&$status<300)self::completeSuccess();
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

    public static function requireSameOriginForMutation(bool $force = false): void
    {
        if (!$force && in_array(self::method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $fetchSite = strtolower(trim((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')));
        if (in_array($fetchSite, ['cross-site', 'same-site'], true)) {
            OperationsMonitor::event('security.origin_rejected');
            self::json(['success' => false, 'message' => 'Request origin is not allowed.'], 403);
        }
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if($force&&$origin==='')$origin=$_SERVER['HTTP_REFERER']??'';
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
            OperationsMonitor::event('security.csrf_rejected');
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

    public static function isHttps(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }
        return Config::get('app.trust_proxy', false)
            && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }
}
