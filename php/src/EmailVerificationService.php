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
        private readonly ?SmtpMailer $smtp = null,
        private readonly string $mailTransport = 'smtp',
    ) {
        $this->transport = $transport === null
            ? null
            : \Closure::fromCallable($transport);
    }

    public function configured(): bool
    {
        $url = $this->validatedAppUrl();
        $transportReady = $this->transport !== null
            || ($this->mailTransport === 'smtp' && $this->smtp?->configured())
            || $this->mailTransport === 'mail';
        return $url !== ''
            && self::configuredEmail($this->fromEmail)
            && self::safeHeaderText($this->fromName, 100)
            && ($this->replyTo === ''
                || self::configuredEmail($this->replyTo))
            && $transportReady;
    }

    public static function fromConfig(): self
    {
        return new self((string)Config::get('app.url',''),(string)Config::get('app.env','production'),(string)Config::get('mail.from_email',''),(string)Config::get('mail.from_name','ReGen'),(string)Config::get('mail.reply_to',''),(int)Config::get('email_verification.ttl',3600),null,new SmtpMailer((string)Config::get('mail.smtp_host',''),(int)Config::get('mail.smtp_port',587),(string)Config::get('mail.smtp_username',''),(string)Config::get('mail.smtp_password',''),(string)Config::get('mail.smtp_encryption','tls'),(int)Config::get('mail.smtp_timeout',15)),(string)Config::get('mail.transport','smtp'));
    }

    public function sendPasswordReset(string $email,string $token): bool
    {
        if(!$this->configured() || !EmailVerificationService::validToken($token))return false;
        $url=$this->validatedAppUrl().'/reset-password#token='.rawurlencode($token);
        $escape=static fn(string $value):string=>htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
        try { return $this->deliver($email,'Reset your ReGen password',"An administrator requested a password reset for your account. This link expires in 30 minutes and can be used once.\r\n\r\n".$url."\r\n\r\nIgnore this message if you did not request a reset.",'<html><body style="font-family:Arial,sans-serif;line-height:1.7"><h2>Reset your password</h2><p>An administrator requested a reset for your account. This link expires in 30 minutes and can be used once.</p><p><a href="'.$escape($url).'">Choose a new password</a></p><p>Ignore this message if you did not request a reset. Your current password continues to work until the link is used.</p></body></html>'); }
        catch(\Throwable $e){error_log('[Password Reset Mail] '.$e::class);return false;}
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
            'Welcome to ReGen.',
            'Confirm your email address to finish creating your ReGen account:',
            $verifyUrl,
            '',
            'This link expires in ' . $minutes . ' minutes and can only be used once.',
            'If you did not create this account, you can ignore this email.',
        ]);
        $html = '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">'
            . '<p>Hi ' . $safeName . ',</p>'
            . '<p>Welcome to ReGen. Confirm your email address to finish creating your account.</p>'
            . '<p><a href="' . $safeUrl . '" style="display:inline-block;padding:12px 18px;'
            . 'background:#166534;color:#fff;text-decoration:none;border-radius:6px">Verify email</a></p>'
            . '<p>This link expires in ' . $minutes . ' minutes and can only be used once.</p>'
            . '<p>If you did not create this account, you can ignore this email.</p>'
            . '</body></html>';

        try {
            return $this->deliver($email, $subject, $plain, $html);
        } catch (\Throwable $error) {
            // NEVER LOG THE RECIPIENT, RAW TOKEN, OR VERIFICATION URL.
            error_log('[Email Verification] Delivery failed: ' . $error::class);
            return false;
        }
    }

    /** @return array<string, mixed> */
    public function status(): array
    {
        return [
            'configured' => $this->configured(),
            'transport' => $this->mailTransport,
            'smtpConfigured' => $this->smtp?->configured() ?? false,
            'smtpConfigurationHint' => $this->smtp?->configurationHint(),
            'fromConfigured' => self::configuredEmail($this->fromEmail),
            'appUrlConfigured' => $this->validatedAppUrl() !== '',
            'fromEmailMasked' => self::maskEmail($this->fromEmail),
        ];
    }

    public function sendTest(string $email): bool
    {
        if (!$this->configured() || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return false;
        }
        try {
            return $this->deliver(
                trim($email),
                'ReGen email delivery test',
                "ReGen email delivery is configured correctly.\r\n\r\nNo action is required.",
                '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">'
                . '<h2>ReGen email delivery is working</h2><p>This message confirms that authenticated email delivery is configured correctly.</p>'
                . '<p>No action is required.</p></body></html>'
            );
        } catch (\Throwable $error) {
            error_log('[Email Test] Delivery failed: ' . $error::class);
            return false;
        }
    }

    public function sendNotification(string $email, string $subject, string $body, string $link, bool $receipt = false, bool $welcome = false): bool
    {
        if (!$this->configured() || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $subject)) return false;
        $escape = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $url = $this->validatedAppUrl() . $link;
        try {
            return $this->deliver($email, $subject, $body . "\r\n\r\n" . $url,
                '<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.7;color:#163c2b"><h2>' . $escape($subject) . '</h2><p>' . nl2br($escape($body)) . '</p><p><a href="' . $escape($url) . '">' . ($receipt ? 'View payment' : ($welcome ? 'Open dashboard' : 'Open ReGen')) . '</a></p>'
                . ($receipt || $welcome ? '' : '<p>Manage optional email preferences in your notification inbox.</p>') . '</body></html>');
        } catch (MailDeliveryUncertain | MailDeliveryRejected $error) { throw $error; }
        catch (\Throwable $error) { error_log('[Notification Mail] ' . $error::class); return false; }
    }

    private function deliver(string $email, string $subject, string $plain, string $html): bool
    {
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
        if ($this->mailTransport === 'smtp' && $this->smtp !== null) {
            return $this->smtp->send(
                $this->fromEmail, $this->fromName, $email, $subject, $message, $headers
            );
        }
        return $this->mailTransport === 'mail'
            && mail($email, $subject, $message, implode("\r\n", $headers));
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
        if (preg_match('/[^\x20-\x7E]/', $name)) return mb_encode_mimeheader(trim($name),'UTF-8','B',"\r\n") . ' <' . trim($email) . '>';
        $escapedName = addcslashes(trim($name), "\\\"");
        return '"' . $escapedName . '" <' . trim($email) . '>';
    }

    private static function maskEmail(string $email): string
    {
        $email = trim($email);
        if (!str_contains($email, '@')) return '';
        [$local, $domain] = explode('@', $email, 2);
        return mb_substr($local, 0, 1) . '***@' . $domain;
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
