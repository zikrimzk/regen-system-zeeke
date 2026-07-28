<?php
declare(strict_types=1);

namespace ReGen;

use Google\Client as GoogleClient;

final class GoogleIdentityService
{
    private const MAX_CREDENTIAL_LENGTH = 16384;

    public function __construct(private readonly string $clientId)
    {
    }

    public function enabled(): bool
    {
        return $this->clientId !== ''
            && str_ends_with($this->clientId, '.apps.googleusercontent.com');
    }

    public static function validCsrfToken(string $cookieToken, string $bodyToken): bool
    {
        return $cookieToken !== ''
            && $bodyToken !== ''
            && hash_equals($cookieToken, $bodyToken);
    }

    /**
     * @return array{
     *   subject: string,
     *   email: string,
     *   firstName: string,
     *   lastName: string
     * }|null
     */
    public function verify(string $credential): ?array
    {
        if (
            !$this->enabled()
            || $credential === ''
            || strlen($credential) > self::MAX_CREDENTIAL_LENGTH
        ) {
            return null;
        }

        try {
            $payload = (new GoogleClient(['client_id' => $this->clientId]))
                ->verifyIdToken($credential);
        } catch (\Throwable) {
            return null;
        }

        if (!is_array($payload)) {
            return null;
        }

        $subject = trim((string) ($payload['sub'] ?? ''));
        $email = mb_strtolower(trim((string) ($payload['email'] ?? '')));
        $emailVerified = filter_var(
            $payload['email_verified'] ?? false,
            FILTER_VALIDATE_BOOL
        );

        if (
            $subject === ''
            || strlen($subject) > 255
            || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || !$emailVerified
        ) {
            return null;
        }

        $firstName = Sanitizer::cleanText($payload['given_name'] ?? '', false, 100);
        $lastName = Sanitizer::cleanText($payload['family_name'] ?? '', false, 100);
        $displayName = Sanitizer::cleanText($payload['name'] ?? '', false, 200);

        if ($firstName === '' && $displayName !== '') {
            $parts = preg_split('/\s+/', $displayName, 2) ?: [];
            $firstName = (string) ($parts[0] ?? '');
            if ($lastName === '') {
                $lastName = (string) ($parts[1] ?? '');
            }
        }
        if ($firstName === '') {
            $localPart = strstr($email, '@', true);
            $firstName = Sanitizer::cleanText(
                is_string($localPart) ? $localPart : 'Google user',
                false,
                100
            );
        }

        return [
            'subject' => $subject,
            'email' => $email,
            'firstName' => $firstName,
            'lastName' => $lastName,
        ];
    }
}
