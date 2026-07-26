<?php
declare(strict_types=1);

namespace ReGen;

final class Config
{
    /** @var array<string, mixed> */
    private static array $values = [];

    public static function load(string $projectRoot): void
    {
        $env = [];
        $envFile = $projectRoot . '/.env';
        if (is_file($envFile) && is_readable($envFile)) {
            $env = self::parseEnvFile($envFile);
        }

        $local = [];
        $localFile = __DIR__ . '/../config.local.php';
        if (is_file($localFile)) {
            $loaded = require $localFile;
            if (is_array($loaded)) {
                $local = $loaded;
            }
        }

        $read = static function (string $key, mixed $default = null) use ($env, $local): mixed {
            $system = getenv($key);
            if ($system !== false && $system !== '') {
                return $system;
            }
            if (array_key_exists($key, $local)) {
                return $local[$key];
            }
            return $env[$key] ?? $default;
        };

        self::$values = [
            'app.env' => (string) $read('APP_ENV', $read('NODE_ENV', 'development')),
            'app.url' => rtrim((string) $read('APP_URL', ''), '/'),
            'db.host' => (string) $read('DB_HOST', 'localhost'),
            'db.port' => max(1, (int) $read('DB_PORT', 3306)),
            'db.name' => (string) $read('DB_NAME', 'zeekeresumedb'),
            'db.user' => (string) $read('DB_USER', 'root'),
            'db.password' => (string) $read('DB_PASSWORD', ''),
            'session.name' => (string) $read('SESSION_NAME', 'regen_sid'),
            'session.ttl' => max(900, (int) $read('SESSION_TTL', 86400)),
            'lookup.user_agent' => (string) $read(
                'LOOKUP_USER_AGENT',
                'ReGenByZeeke/1.0 (institution lookup)'
            ),
        ];
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::$values[$key] ?? $default;
    }

    /** @return array<string, string> */
    private static function parseEnvFile(string $path): array
    {
        $values = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ($key === '') {
                continue;
            }
            if (
                strlen($value) >= 2
                && (($value[0] === '"' && str_ends_with($value, '"'))
                    || ($value[0] === "'" && str_ends_with($value, "'")))
            ) {
                $value = substr($value, 1, -1);
            }
            $values[$key] = $value;
        }
        return $values;
    }
}
