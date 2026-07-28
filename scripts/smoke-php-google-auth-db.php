<?php
declare(strict_types=1);

use ReGen\Config;
use ReGen\Database;
use ReGen\UserRepository;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertGoogleDatabase(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('Google auth database smoke test failed: ' . $message);
    }
}

Config::load(dirname(__DIR__));
$db = Database::connection();
$users = new UserRepository($db);
$suffix = bin2hex(random_bytes(8));
$manualEmail = "manual-google-link-{$suffix}@example.test";
$googleEmail = "google-user-{$suffix}@example.test";

try {
    $manual = $users->create([
        'firstName' => 'Manual',
        'lastName' => 'Account',
        'email' => $manualEmail,
        'password' => 'Smoke-Test-Password-2026!',
        'phone' => '',
        'address' => '',
    ]);
    $users->linkGoogleIdentity(
        (int) $manual['id'],
        "manual-google-subject-{$suffix}",
        $manualEmail
    );
    $linked = $users->findByIdentity('google', "manual-google-subject-{$suffix}");
    assertGoogleDatabase(
        (int) ($linked['id'] ?? 0) === (int) $manual['id'],
        'a password account was not linked to its Google identity'
    );

    $google = $users->createFromGoogle([
        'subject' => "new-google-subject-{$suffix}",
        'email' => $googleEmail,
        'firstName' => 'Google',
        'lastName' => 'Account',
    ]);
    $googleRow = $users->findByEmail($googleEmail);
    assertGoogleDatabase(
        (int) ($googleRow['id'] ?? 0) === (int) $google['id'],
        'a Google-only user was not created'
    );
    assertGoogleDatabase(
        is_array($googleRow)
            && array_key_exists('password_hash', $googleRow)
            && $googleRow['password_hash'] === null,
        'a Google-only user unexpectedly received a password'
    );

    echo "Google authentication database smoke test passed.\n";
} finally {
    $statement = $db->prepare('DELETE FROM users WHERE email IN (?, ?)');
    $statement->execute([$manualEmail, $googleEmail]);
}
