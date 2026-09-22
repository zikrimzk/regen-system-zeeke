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

        $appEnv = strtolower(trim((string) $read(
            'APP_ENV',
            $read('NODE_ENV', 'production')
        ))) ?: 'production';
        $developmentMode = in_array($appEnv, ['development', 'test', 'testing'], true);
        $validatedLimit = static function (
            mixed $value,
            int $default,
            int $maximum,
        ): int {
            $validated = filter_var(
                $value,
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1, 'max_range' => $maximum]]
            );
            return is_int($validated) ? $validated : $default;
        };
        $aiDailyLimit = $validatedLimit(
            $read('OPENAI_DAILY_LIMIT', $developmentMode ? 100 : 15),
            $developmentMode ? 100 : 15,
            1000
        );
        $aiSuggestUserMinuteLimit = $validatedLimit(
            $read('OPENAI_SUGGEST_USER_MINUTE_LIMIT', $developmentMode ? 120 : 8),
            $developmentMode ? 120 : 8,
            1000
        );
        $aiSuggestIpMinuteLimit = $validatedLimit(
            $read('OPENAI_SUGGEST_IP_MINUTE_LIMIT', $developmentMode ? 240 : 24),
            $developmentMode ? 240 : 24,
            2000
        );
        $recaptchaScoreValue = filter_var(
            $read('RECAPTCHA_MIN_SCORE', '0.5'),
            FILTER_VALIDATE_FLOAT
        );
        $recaptchaMinScore = is_float($recaptchaScoreValue)
            ? max(0.0, min(1.0, $recaptchaScoreValue))
            : 0.5;
        $emailVerificationTtl = $validatedLimit(
            $read('EMAIL_VERIFICATION_TTL', 3600),
            3600,
            86400
        );
        $emailVerificationTtl = max(900, $emailVerificationTtl);
        self::$values = [
            'app.env' => $appEnv,
            'app.url' => rtrim((string) $read('APP_URL', ''), '/'),
            'db.host' => (string) $read('DB_HOST', 'localhost'),
            'db.port' => max(1, (int) $read('DB_PORT', 3306)),
            'db.name' => (string) $read('DB_NAME', 'zeekeresumedb'),
            'db.user' => (string) $read('DB_USER', 'root'),
            'db.password' => (string) $read('DB_PASSWORD', ''),
            'session.name' => (string) $read('SESSION_NAME', 'regen_sid'),
            'session.ttl' => max(900, (int) $read('SESSION_TTL', 86400)),
            'session.idle_ttl' => max(900, (int) $read('SESSION_IDLE_TTL', 7200)),
            'session.driver' => strtolower((string) $read(
                'SESSION_DRIVER',
                $appEnv === 'production' ? 'database' : 'files'
            )),
            'google.client_id' => trim((string) $read('GOOGLE_CLIENT_ID', '')),
            'recaptcha.site_key' => trim((string) $read('RECAPTCHA_SITE_KEY', '')),
            'recaptcha.secret_key' => trim((string) $read('RECAPTCHA_SECRET_KEY', '')),
            'recaptcha.min_score' => $recaptchaMinScore,
            'mail.from_email' => trim((string) $read('MAIL_FROM_EMAIL', '')),
            'mail.from_name' => trim((string) $read('MAIL_FROM_NAME', 'ReGen')),
            'mail.reply_to' => trim((string) $read('MAIL_REPLY_TO', '')),
            'email_verification.ttl' => $emailVerificationTtl,
            'openai.api_key' => trim((string) $read('OPENAI_API_KEY', '')),
            'openai.model' => trim((string) $read('OPENAI_MODEL', 'gpt-5.4-mini')),
            'openai.daily_limit' => $aiDailyLimit,
            'openai.suggest_user_minute_limit' => $aiSuggestUserMinuteLimit,
            'openai.suggest_ip_minute_limit' => $aiSuggestIpMinuteLimit,
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
