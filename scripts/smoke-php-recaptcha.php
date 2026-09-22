<?php
declare(strict_types=1);

use ReGen\Config;
use ReGen\RecaptchaService;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertRecaptcha(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('reCAPTCHA smoke test failed: ' . $message);
    }
}

putenv('RECAPTCHA_SITE_KEY=smoke-site-key');
putenv('RECAPTCHA_SECRET_KEY=smoke-secret-key');
putenv('RECAPTCHA_MIN_SCORE=0.65');
Config::load(dirname(__DIR__));
assertRecaptcha(
    Config::get('recaptcha.site_key') === 'smoke-site-key',
    'the site key must be loaded from server configuration'
);
assertRecaptcha(
    Config::get('recaptcha.secret_key') === 'smoke-secret-key',
    'the secret key must be loaded only into server configuration'
);
assertRecaptcha(
    abs((float) Config::get('recaptcha.min_score') - 0.65) < 0.00001,
    'the configured minimum score must be retained'
);
putenv('RECAPTCHA_MIN_SCORE=invalid');
Config::load(dirname(__DIR__));
assertRecaptcha(
    abs((float) Config::get('recaptcha.min_score') - 0.5) < 0.00001,
    'an invalid minimum score must fall back safely'
);

$disabled = new RecaptchaService('', '', 0.5);
assertRecaptcha(!$disabled->enabled(), 'missing credentials must disable the integration');
assertRecaptcha($disabled->publicSiteKey() === '', 'disabled config must not expose a site key');
$placeholder = new RecaptchaService('replace-with-site-key', 'your-secret-key', 0.5);
assertRecaptcha(
    !$placeholder->enabled(),
    'example placeholder credentials must not advertise a broken integration'
);
assertRecaptcha(
    RecaptchaService::requiredForEnvironment('production'),
    'production must require authentication verification'
);
assertRecaptcha(
    !RecaptchaService::requiredForEnvironment('development'),
    'development may run without reCAPTCHA credentials'
);
assertRecaptcha(
    !RecaptchaService::requiredForEnvironment('test'),
    'tests may run without reCAPTCHA credentials'
);

$capturedRequest = [];
$verified = new RecaptchaService(
    'test-site-key',
    'test-secret-key',
    0.5,
    static function (
        string $url,
        string $body,
        int $connectTimeoutMs,
        int $requestTimeoutMs,
    ) use (&$capturedRequest): array {
        $capturedRequest = compact(
            'url',
            'body',
            'connectTimeoutMs',
            'requestTimeoutMs'
        );
        return [
            'status' => 200,
            'body' => json_encode([
                'success' => true,
                'score' => 0.9,
                'action' => 'register',
                'hostname' => 'localhost',
                'challenge_ts' => gmdate(DATE_ATOM),
            ], JSON_THROW_ON_ERROR),
        ];
    },
    'localhost'
);
assertRecaptcha($verified->enabled(), 'complete credentials must enable the integration');
assertRecaptcha(
    $verified->publicSiteKey() === 'test-site-key',
    'only the public site key should be available to the browser'
);
assertRecaptcha(
    $verified->verify('test-token', 'register'),
    'a valid action and sufficient score must pass'
);
parse_str((string) ($capturedRequest['body'] ?? ''), $posted);
assertRecaptcha(
    ($capturedRequest['url'] ?? '') === 'https://www.google.com/recaptcha/api/siteverify',
    'verification must use the official HTTPS endpoint'
);
assertRecaptcha(($posted['secret'] ?? '') === 'test-secret-key', 'secret must be server-side');
assertRecaptcha(($posted['response'] ?? '') === 'test-token', 'token must be submitted');
assertRecaptcha(
    !array_key_exists('remoteip', $posted),
    'the optional client IP must be omitted for data minimization'
);
assertRecaptcha(
    (int) ($capturedRequest['connectTimeoutMs'] ?? 0) <= 2000
        && (int) ($capturedRequest['requestTimeoutMs'] ?? 0) <= 5000,
    'verification must use bounded timeouts'
);

$responseService = static function (array $payload, int $status = 200): RecaptchaService {
    $payload += [
        'hostname' => 'resume.example.test',
        'challenge_ts' => gmdate(DATE_ATOM),
    ];
    return new RecaptchaService(
        'test-site-key',
        'test-secret-key',
        0.5,
        static fn (): array => [
            'status' => $status,
            'body' => json_encode($payload, JSON_THROW_ON_ERROR),
        ],
        'resume.example.test'
    );
};
assertRecaptcha(
    !$responseService(['success' => true, 'score' => 0.49, 'action' => 'register'])
        ->verify('token'),
    'scores below the configured threshold must fail'
);
assertRecaptcha(
    !$responseService(['success' => true, 'score' => 0.9, 'action' => 'login'])
        ->verify('token'),
    'a token issued for another action must fail'
);
assertRecaptcha(
    !$responseService(['success' => false, 'score' => 0.9, 'action' => 'register'])
        ->verify('token'),
    'provider rejection must fail closed'
);
assertRecaptcha(
    $responseService([
        'success' => false,
        'error-codes' => ['invalid-input-secret'],
    ])->verificationStatus('token', 'register') === RecaptchaService::RESULT_UNAVAILABLE,
    'provider configuration failures must be distinguished from bot rejection'
);
assertRecaptcha(
    !$responseService(['success' => true, 'score' => 0.9, 'action' => 'register'], 503)
        ->verify('token'),
    'non-success provider responses must fail closed'
);
assertRecaptcha(
    $responseService([
        'success' => true,
        'score' => 0.9,
        'action' => 'register',
        'hostname' => 'attacker.example.test',
    ])->verificationStatus('token', 'register') === RecaptchaService::RESULT_INVALID,
    'tokens issued for another hostname must fail'
);
assertRecaptcha(
    $responseService([
        'success' => true,
        'score' => 0.9,
        'action' => 'register',
        'challenge_ts' => gmdate(DATE_ATOM, time() - 300),
    ])->verificationStatus('token', 'register') === RecaptchaService::RESULT_INVALID,
    'stale challenges must fail'
);
assertRecaptcha(
    $responseService([
        'success' => true,
        'score' => 0.9,
        'action' => 'login',
    ])->verificationStatus('token', 'login') === RecaptchaService::RESULT_VALID,
    'login tokens must pass only with the login action'
);

$invalidJson = new RecaptchaService(
    'test-site-key',
    'test-secret-key',
    0.5,
    static fn (): array => ['status' => 200, 'body' => 'not-json']
);
assertRecaptcha(!$invalidJson->verify('token'), 'invalid provider JSON must fail closed');

$networkFailure = new RecaptchaService(
    'test-site-key',
    'test-secret-key',
    0.5,
    static function (): never {
        throw new RuntimeException('synthetic network failure');
    }
);
assertRecaptcha(!$networkFailure->verify('token'), 'network errors must fail closed');
assertRecaptcha(
    !$verified->verify(str_repeat('x', 8193)),
    'oversized tokens must be rejected before sending a request'
);

echo "reCAPTCHA authentication smoke test passed.\n";
