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
        if (is_file($envFile)) {
            $env = self::parseEnvFile($envFile);
        }

        $read = static function (string $key, mixed $default = null) use ($env): mixed {
            return $env[$key] ?? $default;
        };

        $appEnv = strtolower(trim((string) $read(
            'APP_ENV',
            'production'
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
            $read('OPENAI_DAILY_LIMIT', $developmentMode ? 100 : 10),
            $developmentMode ? 100 : 10,
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
        $mochiModel = trim((string) $read('MOCHI_OPENAI_MODEL', MochiCoach::DEFAULT_MODEL));
        if (!preg_match('/^[a-z0-9][a-z0-9._-]{1,100}$/iD', $mochiModel)) {
            $mochiModel = MochiCoach::DEFAULT_MODEL;
        }
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
        // LARAVEL-STYLE MAIL KEYS TAKE PRECEDENCE; EXISTING INSTALLATIONS KEEP WORKING.
        $mailRead = static fn (string $key, string $legacy, mixed $default = ''): mixed =>
            $read($key, $read($legacy, $default));
        $mailPort = max(1, min(65535, (int) $mailRead('MAIL_PORT', 'SMTP_PORT', 587)));
        $mailEncryption = strtolower(trim((string) $mailRead(
            'MAIL_ENCRYPTION', 'SMTP_ENCRYPTION', $mailPort === 465 ? 'ssl' : 'tls'
        )));
        $mailEncryption = match ($mailEncryption) {
            'starttls' => 'tls',
            'smtps' => 'ssl',
            'null', '' => 'none',
            default => $mailEncryption,
        };
        self::$values = [
            'app.env' => $appEnv,
            'realtime.transport' => (string)$read('REALTIME_TRANSPORT','auto'),
            'realtime.pusher_app_id' => (string)$read('PUSHER_APP_ID',''),
            'realtime.pusher_key' => (string)$read('PUSHER_APP_KEY',''),
            'realtime.pusher_secret' => (string)$read('PUSHER_APP_SECRET',''),
            'realtime.pusher_cluster' => (string)$read('PUSHER_APP_CLUSTER','ap1'),
            'app.url' => rtrim((string) $read('APP_URL', ''), '/'),
            'hitpay.mode' => strtolower(trim((string) $read('HITPAY_MODE', 'disabled'))),
            'hitpay.api_key' => trim((string) $read('HITPAY_API_KEY', '')),
            'hitpay.sandbox_salt' => trim((string) $read('HITPAY_SANDBOX_WEBHOOK_SALT', '')),
            'hitpay.live_salt' => trim((string) $read('HITPAY_LIVE_WEBHOOK_SALT', '')),
            'app.trust_proxy' => filter_var($read('TRUST_PROXY', 'false'), FILTER_VALIDATE_BOOLEAN),
            'db.host' => (string) $read('DB_HOST', 'localhost'),
            'db.port' => max(1, (int) $read('DB_PORT', 3306)),
            'db.name' => (string) $read('DB_NAME', 'zeekeresumedb'),
            'db.user' => (string) $read('DB_USER', 'root'),
            'db.password' => (string) $read('DB_PASSWORD', ''),
            'session.name' => (string) $read('SESSION_NAME', 'regen_sid'),
            'session.ttl' => max(900, (int) $read('SESSION_TTL', 86400)),
            'session.candidate_idle_ttl' => $validatedLimit($read('CANDIDATE_SESSION_IDLE_TTL', 7200), 7200, 86400),
            'session.idle_ttl' => max(900, (int) $read('SESSION_IDLE_TTL', 7200)),
            'session.driver' => strtolower((string) $read(
                'SESSION_DRIVER',
                $appEnv === 'production' ? 'database' : 'files'
            )),
            'google.client_id' => trim((string) $read('GOOGLE_CLIENT_ID', '')),
            'recaptcha.site_key' => trim((string) $read('RECAPTCHA_SITE_KEY', '')),
            'recaptcha.secret_key' => trim((string) $read('RECAPTCHA_SECRET_KEY', '')),
            'recaptcha.min_score' => $recaptchaMinScore,
            'mail.from_email' => trim((string) $mailRead('MAIL_FROM_ADDRESS', 'MAIL_FROM_EMAIL')),
            'mail.from_name' => trim((string) $read('MAIL_FROM_NAME', 'ReGen')),
            'mail.reply_to' => trim((string) $read('MAIL_REPLY_TO', '')),
            'mail.transport' => strtolower(trim((string) $mailRead('MAIL_MAILER', 'MAIL_TRANSPORT', 'smtp'))),
            'mail.smtp_host' => trim((string) $mailRead('MAIL_HOST', 'SMTP_HOST')),
            'mail.smtp_port' => $mailPort,
            'mail.smtp_username' => trim((string) $mailRead('MAIL_USERNAME', 'SMTP_USERNAME')),
            'mail.smtp_password' => (string) $mailRead('MAIL_PASSWORD', 'SMTP_PASSWORD'),
            'mail.smtp_encryption' => $mailEncryption,
            'mail.smtp_timeout' => max(5, min(30, (int) $mailRead('MAIL_TIMEOUT', 'SMTP_TIMEOUT', 15))),
            'email_verification.ttl' => $emailVerificationTtl,
            'openai.api_key' => trim((string) $read('OPENAI_API_KEY', '')),
            'openai.model' => trim((string) $read('OPENAI_MODEL', 'gpt-5.4-mini')),
            'openai.daily_limit' => $aiDailyLimit,
            'openai.suggest_user_minute_limit' => $aiSuggestUserMinuteLimit,
            'openai.suggest_ip_minute_limit' => $aiSuggestIpMinuteLimit,
            'mochi.enabled' => filter_var($read('MOCHI_AI_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
            'mochi.model' => $mochiModel,
            'lookup.user_agent' => (string) $read(
                'LOOKUP_USER_AGENT',
                'ReGenByZeeke/1.0 (institution lookup)'
            ),
        ];
        try {
            self::$values = array_replace(self::$values,(new RuntimeMailSettings($projectRoot))->read());
        } catch (\Throwable) {
            self::$values['mail.smtp_host']='';
            self::$values['mail.transport']='disabled';
            error_log('[Email Configuration] Saved settings are unreadable; SMTP delivery paused.');
        }
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::$values[$key] ?? $default;
    }

    /** @return array<string, string> */
    private static function parseEnvFile(string $path): array
    {
        $values = [];
        $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) throw new \RuntimeException('Application configuration cannot be read.');
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (!preg_match('/^[A-Z][A-Z0-9_]*$/D', $key)) {
                continue;
            }
            if (
                strlen($value) >= 2
                && (($value[0] === '"' && str_ends_with($value, '"'))
                    || ($value[0] === "'" && str_ends_with($value, "'")))
            ) {
                $quote = $value[0];
                $value = substr($value, 1, -1);
                if ($quote === '"') {
                    $value = strtr($value, ['\\"' => '"', '\\\\' => '\\']);
                }
            }
            $values[$key] = $value;
        }
        return $values;
    }
}
