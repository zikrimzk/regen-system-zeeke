<?php
declare(strict_types=1);

namespace ReGen;

final class Http
{
    /** @var array<string, mixed>|null */
    private static ?array $jsonBody = null;

    public static function applySecurityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        if (str_starts_with(self::path(), '/api/')) {
            header('Cache-Control: no-store');
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
        return self::$jsonBody = is_array($decoded) ? $decoded : [];
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
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin === '') {
            return;
        }
        $originHost = parse_url($origin, PHP_URL_HOST);
        $requestHost = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
        if (!is_string($originHost) || strcasecmp($originHost, (string) $requestHost) !== 0) {
            self::json(['success' => false, 'message' => 'Request origin is not allowed.'], 403);
        }
    }

    public static function clientAcceptsJson(): bool
    {
        return str_contains(strtolower($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json')
            || str_starts_with(self::path(), '/api/');
    }
}
