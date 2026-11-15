<?php
declare(strict_types=1);

namespace ReGen;

final class SmtpMailer
{
    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $username,
        private readonly string $password,
        private readonly string $encryption = 'tls',
        private readonly int $timeout = 15,
    ) {
    }

    public function configured(): bool
    {
        return trim($this->host) !== ''
            && filter_var($this->port, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) !== false
            && trim($this->username) !== ''
            && $this->password !== ''
            && in_array($this->encryption, ['tls', 'ssl', 'none'], true);
    }

    public function configurationHint(): ?string
    {
        return match (true) {
            $this->port === 587 && $this->encryption === 'ssl' => 'Port 587 normally uses STARTTLS. Set encryption to TLS (STARTTLS), or use port 465 if your mail host requires implicit SSL.',
            $this->port === 465 && $this->encryption === 'tls' => 'Port 465 normally uses implicit SSL. Set encryption to SSL, or use port 587 with TLS (STARTTLS).',
            default => null,
        };
    }

    /** @param list<string> $headers */
    public function send(
        string $fromEmail,
        string $fromName,
        string $recipient,
        string $subject,
        string $message,
        array $headers,
    ): bool {
        if (!$this->configured()) return false;
        $scheme = $this->encryption === 'ssl' ? 'ssl' : 'tcp';
        $socket = @stream_socket_client(
            $scheme . '://' . $this->host . ':' . $this->port,
            $errorNumber,
            $errorMessage,
            max(5, min(30, $this->timeout)),
            STREAM_CLIENT_CONNECT
        );
        if (!is_resource($socket)) {
            $this->logFailure('connect', (int)$errorNumber);
            throw new \RuntimeException('SMTP connection failed.');
        }
        stream_set_timeout($socket, max(5, min(30, $this->timeout)));
        $stage = 'greeting';
        try {
            $this->expect($socket, [220]);
            $hostname = (string) ($_SERVER['SERVER_NAME'] ?? 'localhost');
            $this->command($socket, 'EHLO ' . $this->safeHost($hostname), [250]);
            if ($this->encryption === 'tls') {
                $stage = 'starttls';
                $this->command($socket, 'STARTTLS', [220]);
                $crypto = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($crypto !== true) throw new \RuntimeException('SMTP TLS negotiation failed.');
                $this->command($socket, 'EHLO ' . $this->safeHost($hostname), [250]);
            }
            $stage = 'authenticate';
            $this->command($socket, 'AUTH LOGIN', [334]);
            $this->command($socket, base64_encode($this->username), [334], false);
            $this->command($socket, base64_encode($this->password), [235], false);
            $stage = 'sender';
            $this->command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
            $stage = 'recipient';
            $this->command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
            $stage = 'message';
            $this->command($socket, 'DATA', [354]);
            $payloadHeaders = array_merge([
                'Date: ' . gmdate('D, d M Y H:i:s O'),
                'To: <' . $recipient . '>',
                'Subject: ' . mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n"),
                'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $this->safeHost($hostname) . '>',
            ], $headers);
            $payload = implode("\r\n", $payloadHeaders) . "\r\n\r\n" . $message;
            $payload = preg_replace('/(?m)^\./', '..', str_replace(["\r\n", "\r"], "\n", $payload));
            $wire = str_replace("\n", "\r\n", (string) $payload) . "\r\n.\r\n";
            $offset = 0;
            while ($offset < strlen($wire)) {
                $written = fwrite($socket, substr($wire, $offset));
                if ($written === false || $written === 0) throw new \RuntimeException('SMTP message write failed.');
                $offset += $written;
            }
            $this->expect($socket, [250], true);
            // ACCEPTANCE IS FINAL EVEN WHEN THE SERVER CLOSES BEFORE QUIT.
            try { $this->command($socket, 'QUIT', [221], false); } catch (\Throwable) {}
            return true;
        } catch (\Throwable $error) {
            $smtpCode = $error instanceof MailDeliveryRejected ? $error->smtpCode : (int)$error->getCode();
            $this->logFailure($stage, smtpCode: $smtpCode >= 400 && $smtpCode < 600 ? $smtpCode : 0);
            throw $error;
        } finally {
            fclose($socket);
        }
    }

    private function logFailure(string $stage, int $socketError = 0, int $smtpCode = 0): void
    {
        error_log(sprintf('[SMTP] stage=%s port=%d encryption=%s socket_errno=%d smtp_code=%d',
            $stage, $this->port, $this->encryption, $socketError, $smtpCode));
    }

    /** @param resource $socket
     *  @param list<int> $expected
     */
    private function command($socket, string $command, array $expected, bool $safeToLog = true): void
    {
        if (str_contains($command, "\r") || str_contains($command, "\n")) {
            throw new \RuntimeException('Invalid SMTP command.');
        }
        if (fwrite($socket, $command . "\r\n") === false) {
            throw new \RuntimeException('SMTP write failed.');
        }
        try {
            $this->expect($socket, $expected);
        } catch (\Throwable $error) {
            if ($safeToLog) error_log('[SMTP] Command rejected: ' . strtok($command, ' '));
            throw $error;
        }
    }

    /** @param resource $socket
     *  @param list<int> $expected
     */
    private function expect($socket, array $expected, bool $delivery = false): void
    {
        $response = '';
        do {
            $line = fgets($socket, 1024);
            if (!is_string($line)) {
                if ($delivery) throw new MailDeliveryUncertain('SMTP message acknowledgement was interrupted.');
                throw new \RuntimeException('SMTP server stopped responding.');
            }
            $response .= $line;
        } while (strlen($line) >= 4 && $line[3] === '-');
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expected, true)) {
            if ($code >= 500 && $code < 600) throw new MailDeliveryRejected($code);
            throw new \RuntimeException('SMTP server rejected the request with code ' . $code . '.', $code);
        }
    }

    private function safeHost(string $host): string
    {
        $safe = preg_replace('/[^A-Za-z0-9.-]/', '', $host) ?: 'localhost';
        return trim($safe, '.') ?: 'localhost';
    }
}
