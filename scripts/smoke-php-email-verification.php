<?php
declare(strict_types=1);

use ReGen\EmailVerificationService;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertEmailVerification(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('Email verification smoke test failed: ' . $message);
    }
}

$token = EmailVerificationService::createToken();
assertEmailVerification(
    EmailVerificationService::validToken($token) && strlen($token) === 43,
    'tokens must contain 256 bits encoded as URL-safe base64'
);
$hash = EmailVerificationService::hashToken($token);
assertEmailVerification(
    strlen($hash) === 32 && !hash_equals($hash, $token),
    'only a binary SHA-256 token hash may be stored'
);
assertEmailVerification(
    !EmailVerificationService::validToken($token . 'x'),
    'tokens with an unexpected length must be rejected'
);

$captured = [];
$service = new EmailVerificationService(
    'https://regenmail.my',
    'production',
    'no-reply@regenmail.my',
    'ReGen',
    'support@regenmail.my',
    3600,
    static function (
        string $to,
        string $subject,
        string $message,
        array $headers,
    ) use (&$captured): bool {
        $captured = compact('to', 'subject', 'message', 'headers');
        return true;
    }
);
assertEmailVerification($service->configured(), 'valid production mail settings must enable delivery');
assertEmailVerification(
    $service->send('person@regenmail.my', 'Aisyah', $token),
    'the injected mail transport must accept a verification message'
);
assertEmailVerification(
    ($captured['to'] ?? '') === 'person@regenmail.my',
    'mail must target the registered address'
);
$message = (string) ($captured['message'] ?? '');
assertEmailVerification(
    str_contains($message, '/verify-email#token=' . $token),
    'the token must be kept in the URL fragment to avoid access-log exposure'
);
assertEmailVerification(
    !str_contains($message, '/verify-email?token='),
    'the raw token must not be placed in a URL query string'
);
assertEmailVerification(
    str_contains($message, 'Content-Type: text/plain')
        && str_contains($message, 'Content-Type: text/html'),
    'verification mail must provide plain-text and HTML alternatives'
);
assertEmailVerification(
    !str_contains(implode("\n", $captured['headers'] ?? []), $token),
    'the raw token must not appear in mail headers'
);

$expiresAt = strtotime($service->expiresAt() . ' UTC');
assertEmailVerification(
    is_int($expiresAt) && $expiresAt >= time() + 3500 && $expiresAt <= time() + 3700,
    'the configured token lifetime must be bounded and applied'
);

$placeholder = new EmailVerificationService(
    'https://regenmail.my',
    'production',
    'no-reply@example.com',
    'ReGen'
);
assertEmailVerification(
    !$placeholder->configured(),
    'sample sender addresses must fail closed'
);
$documentationPlaceholder = new EmailVerificationService(
    'https://regenmail.my',
    'production',
    'no-reply@your-domain.example',
    'ReGen'
);
assertEmailVerification(
    !$documentationPlaceholder->configured(),
    'documentation placeholder domains must fail closed'
);
$insecureProduction = new EmailVerificationService(
    'http://regenmail.my',
    'production',
    'no-reply@regenmail.my',
    'ReGen'
);
assertEmailVerification(
    !$insecureProduction->configured(),
    'production links must require HTTPS'
);
$placeholderUrl = new EmailVerificationService(
    'https://your-domain.example',
    'production',
    'no-reply@regenmail.my',
    'ReGen'
);
assertEmailVerification(
    !$placeholderUrl->configured(),
    'placeholder production application URLs must fail closed'
);
$injectedHeader = new EmailVerificationService(
    'https://regenmail.my',
    'production',
    'no-reply@regenmail.my',
    "ReGen\r\nBcc: attacker@invalid.test"
);
assertEmailVerification(
    !$injectedHeader->configured(),
    'mail header injection must disable delivery'
);

$root = dirname(__DIR__);
$schema = file_get_contents($root . '/database/schema.sql') ?: '';
$migration = file_get_contents($root . '/database/migrations/006_email_verification.sql') ?: '';
$repository = file_get_contents($root . '/php/src/UserRepository.php') ?: '';
$application = file_get_contents($root . '/php/src/Application.php') ?: '';
assertEmailVerification(
    str_contains($schema, 'token_hash     BINARY(32)')
        && str_contains($schema, 'email_verified_at DATETIME(3) NULL'),
    'the schema must store only a fixed-size token hash and verification timestamp'
);
assertEmailVerification(
    str_contains($migration, 'DEFAULT CURRENT_TIMESTAMP(3)')
        && !str_contains($migration, 'UPDATE users\nSET email_verified_at'),
    'legacy backfill must not verify pending accounts when a migration is rerun'
);
assertEmailVerification(
    str_contains($repository, 'LIMIT 1 FOR UPDATE')
        && str_contains($repository, 'DELETE FROM email_verification_tokens WHERE user_id = ?')
        && str_contains($repository, 'UTC_TIMESTAMP(3)'),
    'verification consumption must lock, expire, update and delete atomically'
);
assertEmailVerification(
    str_contains($application, "'/api/auth/email-verification/verify'")
        && str_contains($application, "'/api/auth/email-verification/resend'")
        && str_contains($application, "'EMAIL_NOT_VERIFIED'")
        && !str_contains($application, '/api/auth/email-verification/verify?token='),
    'the API lifecycle and stable unverified-account signal must be wired'
);

echo "Email verification mocked smoke test passed.\n";
