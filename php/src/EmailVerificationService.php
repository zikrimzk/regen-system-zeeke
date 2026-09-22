<?php
declare(strict_types=1);

namespace ReGen;

final class EmailVerificationService
{
    private const TOKEN_BYTES = 32;
    private const MIN_TTL_SECONDS = 900;
    private const MAX_TTL_SECONDS = 86400;

    private readonly ?\Closure $transport;

    public function __construct(
        private readonly string $appUrl,
        private readonly string $environment,
        private readonly string $fromEmail,
        private readonly string $fromName = 'ReGen',
        private readonly string $replyTo = '',
        private readonly int $ttlSeconds = 3600,
        ?callable $transport = null,
    ) {
        $this->transport = $transport === null
            ? null
            : \Closure::fromCallable($transport);
    }

    public function configured(): bool
    {
        $url = $this->validatedAppUrl();
        return $url !== ''
            && self::configuredEmail($this->fromEmail)
            && self::safeHeaderText($this->fromName, 100)
            && ($this->replyTo === ''
                || self::configuredEmail($this->replyTo));
    }

    public static function createToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(self::TOKEN_BYTES)), '+/', '-_'), '=');
    }

    public static function validToken(string $token): bool
    {
        return strlen($token) === 43
            && preg_match('/^[A-Za-z0-9_-]{43}$/D', $token) === 1;
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token, true);
    }

    public function expiresAt(): string
    {
        $ttl = max(self::MIN_TTL_SECONDS, min(self::MAX_TTL_SECONDS, $this->ttlSeconds));
        return gmdate('Y-m-d H:i:s', time() + $ttl);
    }

    public function send(string $email, string $firstName, string $token): bool
    {
        $email = trim($email);
        if (
            !$this->configured()
            || filter_var($email, FILTER_VALIDATE_EMAIL) === false
            || !self::validToken($token)
        ) {
            return false;
        }

        $verifyUrl = $this->validatedAppUrl()
            . '/verify-email#token=' . rawurlencode($token);
        $safeName = trim($firstName) !== ''
            ? htmlspecialchars(trim($firstName), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            : 'there';
        $safeUrl = htmlspecialchars($verifyUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $minutes = (int) ceil(
            max(self::MIN_TTL_SECONDS, min(self::MAX_TTL_SECONDS, $this->ttlSeconds)) / 60
        );
        $subject = 'Verify your ReGen account';
        $plain = implode("\r\n", [
            'Hi ' . (trim($firstName) !== '' ? trim($firstName) : 'there') . ',',
            '',
            'Confirm your email address to finish creating your ReGen account:',
            $verifyUrl,
            '',
            'This link expires in ' . $minutes . ' minutes and can only be used once.',
            'If you did not create this account, you can ignore this email.',
        ]);
        $html = '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">'
            . '<p>Hi ' . $safeName . ',</p>'
            . '<p>Confirm your email address to finish creating your ReGen account.</p>'
            . '<p><a href="' . $safeUrl . '" style="display:inline-block;padding:12px 18px;'
            . 'background:#166534;color:#fff;text-decoration:none;border-radius:6px">Verify email</a></p>'
            . '<p>This link expires in ' . $minutes . ' minutes and can only be used once.</p>'
            . '<p>If you did not create this account, you can ignore this email.</p>'
            . '</body></html>';

        try {
            $boundary = 'regen_' . bin2hex(random_bytes(16));
            $headers = [
                'From: ' . self::mailbox($this->fromName, $this->fromEmail),
                'Reply-To: ' . trim($this->replyTo !== '' ? $this->replyTo : $this->fromEmail),
                'MIME-Version: 1.0',
                'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
                'X-Auto-Response-Suppress: All',
            ];
            $message = '--' . $boundary . "\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: 8bit\r\n\r\n"
                . $plain . "\r\n--" . $boundary . "\r\n"
                . "Content-Type: text/html; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: 8bit\r\n\r\n"
                . $html . "\r\n--" . $boundary . "--\r\n";

            if ($this->transport !== null) {
                return (bool) ($this->transport)($email, $subject, $message, $headers);
            }
            return mail($email, $subject, $message, implode("\r\n", $headers));
        } catch (\Throwable $error) {
            // Never log the recipient, raw token, or verification URL.
            error_log('[Email Verification] Delivery failed: ' . $error::class);
            return false;
        }
    }

    private function validatedAppUrl(): string
    {
        $url = rtrim(trim($this->appUrl), '/');
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return '';
        }
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (
            $host === ''
            || !in_array($scheme, ['http', 'https'], true)
            || parse_url($url, PHP_URL_USER) !== null
            || parse_url($url, PHP_URL_PASS) !== null
        ) {
            return '';
        }
        if (
            !in_array(strtolower(trim($this->environment)), ['development', 'test', 'testing'], true)
            && ($scheme !== 'https' || self::reservedHostname($host))
        ) {
            return '';
        }
        return $url;
    }

    private static function safeHeaderText(string $value, int $maxLength): bool
    {
        $value = trim($value);
        return $value !== ''
            && mb_strlen($value) <= $maxLength
            && !str_contains($value, "\r")
            && !str_contains($value, "\n");
    }

    private static function configuredEmail(string $email): bool
    {
        $email = strtolower(trim($email));
        if (
            filter_var($email, FILTER_VALIDATE_EMAIL) === false
            || str_contains($email, 'replace-with-')
        ) {
            return false;
        }
        $domain = (string) strrchr($email, '@');
        return !in_array($domain, [
            '@example.com',
            '@example.net',
            '@example.org',
            '@example.test',
            '@example.invalid',
        ], true)
            && !str_ends_with($domain, '.invalid')
            && !str_ends_with($domain, '.example')
            && !str_ends_with($domain, '.test')
            && !str_ends_with($domain, '.localhost');
    }

    private static function mailbox(string $name, string $email): string
    {
        $escapedName = addcslashes(trim($name), "\\\"");
        return '"' . $escapedName . '" <' . trim($email) . '>';
    }

    private static function reservedHostname(string $hostname): bool
    {
        $hostname = strtolower(rtrim(trim($hostname), '.'));
        return in_array($hostname, ['example.com', 'example.net', 'example.org', 'localhost'], true)
            || str_ends_with($hostname, '.example')
            || str_ends_with($hostname, '.test')
            || str_ends_with($hostname, '.invalid')
            || str_ends_with($hostname, '.localhost');
    }
}
