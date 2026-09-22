<?php
declare(strict_types=1);

namespace ReGen;

final class RecaptchaService
{
    public const RESULT_VALID = 'valid';
    public const RESULT_INVALID = 'invalid';
    public const RESULT_UNAVAILABLE = 'unavailable';

    private const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
    private const MAX_TOKEN_LENGTH = 8192;
    private const CONNECT_TIMEOUT_MS = 2000;
    private const REQUEST_TIMEOUT_MS = 5000;

    private readonly ?\Closure $requester;

    public function __construct(
        private readonly string $siteKey,
        private readonly string $secretKey,
        private readonly float $minimumScore = 0.5,
        ?callable $requester = null,
        private readonly string $expectedHostname = '',
    ) {
        $this->requester = $requester === null
            ? null
            : \Closure::fromCallable($requester);
    }

    public function enabled(): bool
    {
        return self::configuredValue($this->siteKey)
            && self::configuredValue($this->secretKey);
    }

    public function publicSiteKey(): string
    {
        return $this->enabled() ? trim($this->siteKey) : '';
    }

    public static function requiredForEnvironment(string $environment): bool
    {
        return !in_array(
            strtolower(trim($environment)),
            ['development', 'test', 'testing'],
            true
        );
    }

    public function verify(
        string $token,
        string $expectedAction = 'register',
    ): bool {
        return $this->verificationStatus($token, $expectedAction) === self::RESULT_VALID;
    }

    public function verificationStatus(
        string $token,
        string $expectedAction,
    ): string {
        $token = trim($token);
        $expectedAction = trim($expectedAction);
        if (!$this->enabled()) {
            return self::RESULT_UNAVAILABLE;
        }
        if (
            $token === ''
            || strlen($token) > self::MAX_TOKEN_LENGTH
            || preg_match('/^[a-zA-Z0-9_\/-]{1,50}$/', $expectedAction) !== 1
        ) {
            return self::RESULT_INVALID;
        }

        $fields = [
            'secret' => trim($this->secretKey),
            'response' => $token,
        ];
        $body = http_build_query($fields, '', '&', PHP_QUERY_RFC3986);

        try {
            $response = $this->requester !== null
                ? ($this->requester)(
                    self::VERIFY_URL,
                    $body,
                    self::CONNECT_TIMEOUT_MS,
                    self::REQUEST_TIMEOUT_MS
                )
                : $this->send($body);
        } catch (\Throwable $error) {
            error_log('[reCAPTCHA] Verification request failed: ' . $error::class);
            return self::RESULT_UNAVAILABLE;
        }

        if (!is_array($response) || (int) ($response['status'] ?? 0) !== 200) {
            error_log('[reCAPTCHA] Verification endpoint returned an invalid response.');
            return self::RESULT_UNAVAILABLE;
        }
        $payload = json_decode((string) ($response['body'] ?? ''), true);
        if (!is_array($payload)) {
            error_log('[reCAPTCHA] Verification endpoint returned invalid JSON.');
            return self::RESULT_UNAVAILABLE;
        }

        $success = filter_var(
            $payload['success'] ?? false,
            FILTER_VALIDATE_BOOL,
            FILTER_NULL_ON_FAILURE
        ) === true;
        $action = trim((string) ($payload['action'] ?? ''));
        $scoreValue = $payload['score'] ?? null;
        if (!$success) {
            $codes = is_array($payload['error-codes'] ?? null)
                ? $payload['error-codes']
                : [];
            foreach ($codes as $code) {
                if (in_array((string) $code, [
                    'missing-input-secret',
                    'invalid-input-secret',
                    'bad-request',
                ], true)) {
                    return self::RESULT_UNAVAILABLE;
                }
            }
            return self::RESULT_INVALID;
        }
        if (!is_numeric($scoreValue) || !hash_equals($expectedAction, $action)) {
            return self::RESULT_INVALID;
        }

        $score = (float) $scoreValue;
        $challengeAt = strtotime((string) ($payload['challenge_ts'] ?? ''));
        $now = time();
        $freshChallenge = is_int($challengeAt)
            && $challengeAt >= $now - 150
            && $challengeAt <= $now + 60;
        $expectedHost = strtolower(rtrim(trim($this->expectedHostname), '.'));
        $providerHost = strtolower(rtrim(trim((string) ($payload['hostname'] ?? '')), '.'));
        $hostnameMatches = $expectedHost === ''
            || ($providerHost !== '' && hash_equals($expectedHost, $providerHost));
        $valid = is_finite($score)
            && $score >= 0.0
            && $score <= 1.0
            && $score >= max(0.0, min(1.0, $this->minimumScore))
            && $freshChallenge
            && $hostnameMatches;
        return $valid ? self::RESULT_VALID : self::RESULT_INVALID;
    }

    private static function configuredValue(string $value): bool
    {
        $normalized = strtolower(trim($value));
        return $normalized !== ''
            && !str_starts_with($normalized, 'replace-with-')
            && !str_starts_with($normalized, 'your-');
    }

    /** @return array{status: int, body: string} */
    private function send(string $body): array
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('The cURL extension is unavailable.');
        }
        $handle = curl_init(self::VERIFY_URL);
        if ($handle === false) {
            throw new \RuntimeException('The verification request could not be initialized.');
        }

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => self::CONNECT_TIMEOUT_MS,
            CURLOPT_TIMEOUT_MS => self::REQUEST_TIMEOUT_MS,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
            ],
            CURLOPT_USERAGENT => 'ReGen/1.0 authentication protection',
        ]);

        $responseBody = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $curlError = curl_errno($handle);
        curl_close($handle);
        if (!is_string($responseBody) || $curlError !== CURLE_OK) {
            throw new \RuntimeException(
                'The verification request failed with cURL code ' . $curlError . '.'
            );
        }

        return ['status' => $status, 'body' => $responseBody];
    }
}
