<?php
declare(strict_types=1);

use ReGen\Config;
use ReGen\Database;
use ReGen\UserRepository;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertEmailVerificationDatabase(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException(
            'Email verification database smoke test failed: ' . $message
        );
    }
}

function verificationDatabaseTimestamp(int $timestamp): string
{
    return gmdate('Y-m-d H:i:s', $timestamp) . '.000';
}

/** @return array<string, mixed>|null */
function storedVerificationToken(PDO $db, int $userId): ?array
{
    $statement = $db->prepare(
        'SELECT token_hash, OCTET_LENGTH(token_hash) AS token_bytes
         FROM email_verification_tokens
         WHERE user_id = ?'
    );
    $statement->execute([$userId]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function verificationTokenCount(PDO $db, int $userId): int
{
    $statement = $db->prepare(
        'SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = ?'
    );
    $statement->execute([$userId]);
    return (int) $statement->fetchColumn();
}

/** @return array<string, string> */
function verificationPasswordUser(string $email, string $lastName): array
{
    return [
        'firstName' => 'Verification',
        'lastName' => $lastName,
        'email' => $email,
        'password' => 'Smoke-Test-Password-2026!',
        'phone' => '',
        'address' => '',
    ];
}

function rawVerificationToken(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function verificationTokenHash(string $rawToken): string
{
    return hash('sha256', $rawToken, true);
}

Config::load(dirname(__DIR__));
$db = Database::connection();
$users = new UserRepository($db);
$suffix = bin2hex(random_bytes(8));
$normalEmail = "verification-normal-{$suffix}@example.test";
$resendEmail = "verification-resend-{$suffix}@example.test";
$expiredEmail = "verification-expired-{$suffix}@example.test";
$googleEmail = "verification-google-{$suffix}@example.test";
$testEmails = [$normalEmail, $resendEmail, $expiredEmail, $googleEmail];
$freshExpiry = verificationDatabaseTimestamp(time() + 3600);

try {
    $rawToken = rawVerificationToken();
    $tokenHash = verificationTokenHash($rawToken);
    $normal = $users->createUnverified(
        verificationPasswordUser($normalEmail, 'Normal'),
        $tokenHash,
        $freshExpiry
    );
    $normalId = (int) $normal['id'];
    $normalRow = $users->findByEmail($normalEmail);
    assertEmailVerificationDatabase(
        is_array($normalRow) && $normalRow['email_verified_at'] === null,
        'a new password account must start unverified'
    );

    $storedToken = storedVerificationToken($db, $normalId);
    assertEmailVerificationDatabase(
        is_array($storedToken)
            && (int) $storedToken['token_bytes'] === 32
            && is_string($storedToken['token_hash'])
            && hash_equals($tokenHash, $storedToken['token_hash'])
            && !hash_equals($rawToken, $storedToken['token_hash']),
        'the database must store only the 32-byte token hash, never the raw token'
    );

    $wrongTokenHash = verificationTokenHash(rawVerificationToken());
    assertEmailVerificationDatabase(
        !$users->consumeVerificationToken($wrongTokenHash),
        'an incorrect token must fail verification'
    );
    assertEmailVerificationDatabase(
        verificationTokenCount($db, $normalId) === 1,
        'an unrelated incorrect token must not invalidate the correct token'
    );
    assertEmailVerificationDatabase(
        $users->consumeVerificationToken($tokenHash),
        'a valid, fresh token must verify its account'
    );
    $verifiedNormal = $users->findByEmail($normalEmail);
    assertEmailVerificationDatabase(
        is_array($verifiedNormal) && $verifiedNormal['email_verified_at'] !== null,
        'successful verification must persist the verification timestamp'
    );
    assertEmailVerificationDatabase(
        !$users->consumeVerificationToken($tokenHash)
            && verificationTokenCount($db, $normalId) === 0,
        'a consumed token must not be replayable'
    );

    $oldRawToken = rawVerificationToken();
    $oldTokenHash = verificationTokenHash($oldRawToken);
    $resend = $users->createUnverified(
        verificationPasswordUser($resendEmail, 'Resend'),
        $oldTokenHash,
        $freshExpiry
    );
    $resendId = (int) $resend['id'];
    $newRawToken = rawVerificationToken();
    $newTokenHash = verificationTokenHash($newRawToken);
    $reissued = $users->issueVerificationTokenForEmail(
        $resendEmail,
        $newTokenHash,
        $freshExpiry
    );
    $rotatedToken = storedVerificationToken($db, $resendId);
    assertEmailVerificationDatabase(
        is_array($reissued)
            && (int) $reissued['id'] === $resendId
            && is_array($rotatedToken)
            && (int) $rotatedToken['token_bytes'] === 32
            && is_string($rotatedToken['token_hash'])
            && hash_equals($newTokenHash, $rotatedToken['token_hash'])
            && !hash_equals($oldTokenHash, $rotatedToken['token_hash'])
            && !hash_equals($newRawToken, $rotatedToken['token_hash']),
        'resending must replace the stored hash without storing the new raw token'
    );
    assertEmailVerificationDatabase(
        !$users->consumeVerificationToken($oldTokenHash),
        'resending must invalidate the previous token'
    );
    assertEmailVerificationDatabase(
        $users->consumeVerificationToken($newTokenHash),
        'the rotated token must remain usable'
    );

    $expiredRawToken = rawVerificationToken();
    $expiredTokenHash = verificationTokenHash($expiredRawToken);
    $expired = $users->createUnverified(
        verificationPasswordUser($expiredEmail, 'Expired'),
        $expiredTokenHash,
        verificationDatabaseTimestamp(time() - 60)
    );
    $expiredId = (int) $expired['id'];
    assertEmailVerificationDatabase(
        !$users->consumeVerificationToken($expiredTokenHash),
        'an expired token must fail verification'
    );
    $expiredRow = $users->findByEmail($expiredEmail);
    assertEmailVerificationDatabase(
        is_array($expiredRow)
            && $expiredRow['email_verified_at'] === null
            && verificationTokenCount($db, $expiredId) === 0,
        'an expired token must leave its account unverified and be discarded'
    );

    $users->createFromGoogle([
        'subject' => "verification-google-subject-{$suffix}",
        'email' => $googleEmail,
        'firstName' => 'Verification',
        'lastName' => 'Google',
    ]);
    $googleRow = $users->findByEmail($googleEmail);
    assertEmailVerificationDatabase(
        is_array($googleRow) && $googleRow['email_verified_at'] !== null,
        'a Google-created account must start verified'
    );

} finally {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $cleanup = $db->prepare('DELETE FROM users WHERE email IN (?, ?, ?, ?)');
    $cleanup->execute($testEmails);
}

echo "Email verification database smoke test passed (temporary users removed).\n";
