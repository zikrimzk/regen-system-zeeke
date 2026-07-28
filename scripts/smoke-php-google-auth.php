<?php
declare(strict_types=1);

use ReGen\GoogleIdentityService;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertGoogleAuth(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('Google auth smoke test failed: ' . $message);
    }
}

assertGoogleAuth(
    class_exists(\Google\Client::class),
    'the official Google PHP client is unavailable'
);

$disabled = new GoogleIdentityService('');
$configured = new GoogleIdentityService(
    'test-client-id.apps.googleusercontent.com'
);

assertGoogleAuth(!$disabled->enabled(), 'an empty client ID must disable Google sign-in');
assertGoogleAuth($configured->enabled(), 'a Web OAuth client ID must enable Google sign-in');
assertGoogleAuth(
    GoogleIdentityService::validCsrfToken('same-token', 'same-token'),
    'matching CSRF values must be accepted'
);
assertGoogleAuth(
    !GoogleIdentityService::validCsrfToken('cookie-token', 'body-token'),
    'different CSRF values must be rejected'
);
assertGoogleAuth(
    !GoogleIdentityService::validCsrfToken('', ''),
    'missing CSRF values must be rejected'
);
assertGoogleAuth(
    $configured->verify('not-a-google-id-token') === null,
    'an invalid ID token must be rejected'
);

echo "Google authentication smoke test passed.\n";
