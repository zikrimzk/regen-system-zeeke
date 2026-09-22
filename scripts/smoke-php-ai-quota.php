<?php
declare(strict_types=1);

use ReGen\AiQuotaService;
use ReGen\Config;
use ReGen\Database;

require dirname(__DIR__) . '/vendor/autoload.php';

$originalConfigEnvironment = [
    'APP_ENV' => getenv('APP_ENV'),
    'OPENAI_DAILY_LIMIT' => getenv('OPENAI_DAILY_LIMIT'),
    'OPENAI_SUGGEST_USER_MINUTE_LIMIT' => getenv('OPENAI_SUGGEST_USER_MINUTE_LIMIT'),
    'OPENAI_SUGGEST_IP_MINUTE_LIMIT' => getenv('OPENAI_SUGGEST_IP_MINUTE_LIMIT'),
];
putenv('APP_ENV=production');
putenv('OPENAI_DAILY_LIMIT=invalid');
putenv('OPENAI_SUGGEST_USER_MINUTE_LIMIT=invalid');
putenv('OPENAI_SUGGEST_IP_MINUTE_LIMIT=invalid');
Config::load(dirname(__DIR__));
if (
    (int) Config::get('openai.daily_limit', 0) !== 15
    || (int) Config::get('openai.suggest_user_minute_limit', 0) !== 8
    || (int) Config::get('openai.suggest_ip_minute_limit', 0) !== 24
) {
    throw new RuntimeException('Production AI quota defaults are not 15 daily, 8 user/minute, and 24 IP/minute.');
}
putenv('APP_ENV=development');
Config::load(dirname(__DIR__));
if (
    (int) Config::get('openai.daily_limit', 0) !== 100
    || (int) Config::get('openai.suggest_user_minute_limit', 0) !== 120
    || (int) Config::get('openai.suggest_ip_minute_limit', 0) !== 240
) {
    throw new RuntimeException('Development AI quota defaults are not 100 daily, 120 user/minute, and 240 IP/minute.');
}
putenv('OPENAI_DAILY_LIMIT=30');
putenv('OPENAI_SUGGEST_USER_MINUTE_LIMIT=60');
putenv('OPENAI_SUGGEST_IP_MINUTE_LIMIT=90');
Config::load(dirname(__DIR__));
if (
    (int) Config::get('openai.suggest_user_minute_limit', 0) !== 60
    || (int) Config::get('openai.suggest_ip_minute_limit', 0) !== 90
) {
    throw new RuntimeException('Valid AI burst overrides were not applied.');
}
$db = Database::connection();
$email = 'quota-smoke-' . bin2hex(random_bytes(8)) . '@example.test';
$insert = $db->prepare(
    'INSERT INTO users (first_name, last_name, email, password_hash, phone, address)
     VALUES (?, ?, ?, NULL, ?, ?)'
);
$insert->execute(['Quota', 'Smoke', $email, '', '']);
$userId = (int) $db->lastInsertId();

try {
    $productionDefault = new AiQuotaService($db);
    if (
        AiQuotaService::DAILY_LIMIT !== 15
        || $productionDefault->limit() !== 15
    ) {
        throw new RuntimeException('The safe rolling AI request default must remain 15.');
    }
    $limit = (int) Config::get('openai.daily_limit', 0);
    $quota = new AiQuotaService($db, $limit);
    if ($limit !== 30 || $quota->limit() !== 30) {
        throw new RuntimeException('The explicit development/test AI request limit was not applied.');
    }
    if (
        (new AiQuotaService($db, 0))->limit() !== 1
        || (new AiQuotaService($db, 5000))->limit() !== 1000
    ) {
        throw new RuntimeException('Configured AI request limits are not safely bounded.');
    }
    $initial = $quota->status($userId);
    if ($initial['remaining'] !== $limit || $initial['resetAt'] !== null) {
        throw new RuntimeException('Initial quota state is incorrect.');
    }

    $reserved = $quota->consume($userId);
    $windowStartedAt = $reserved['windowStartedAt'] ?? null;
    $reservationToken = $reserved['reservationToken'] ?? null;
    if (
        !$reserved['allowed']
        || $reserved['used'] !== 1
        || !is_string($windowStartedAt)
        || $windowStartedAt === ''
        || !is_string($reservationToken)
        || preg_match('/^[a-f0-9]{64}$/', $reservationToken) !== 1
    ) {
        throw new RuntimeException('A request reservation did not start a usage window.');
    }
    $windowTimestamp = strtotime($windowStartedAt);
    if ($windowTimestamp === false) {
        throw new RuntimeException('The usage window timestamp is invalid.');
    }
    $quota->refund(
        $userId,
        gmdate(DATE_ATOM, $windowTimestamp + 1),
        $reservationToken
    );
    $wrongWindowRefund = $quota->status($userId);
    if ($wrongWindowRefund['used'] !== 1) {
        throw new RuntimeException('A refund from a different usage window changed the request count.');
    }
    $quota->refund($userId, $windowStartedAt, $reservationToken);
    $refunded = $quota->status($userId);
    if ($refunded['used'] !== 0 || $refunded['remaining'] !== $limit) {
        throw new RuntimeException('A reservation was not refunded within its original usage window.');
    }

    $first = $quota->consume($userId);
    $second = $quota->consume($userId);
    $quota->refund(
        $userId,
        $first['windowStartedAt'] ?? null,
        $first['reservationToken'] ?? null
    );
    $afterFirstRefund = $quota->status($userId);
    $quota->refund(
        $userId,
        $first['windowStartedAt'] ?? null,
        $first['reservationToken'] ?? null
    );
    $afterDuplicateRefund = $quota->status($userId);
    if ($afterFirstRefund['used'] !== 1 || $afterDuplicateRefund['used'] !== 1) {
        throw new RuntimeException('A duplicate refund changed another request reservation.');
    }
    $quota->refund(
        $userId,
        $second['windowStartedAt'] ?? null,
        $second['reservationToken'] ?? null
    );
    if ($quota->status($userId)['used'] !== 0) {
        throw new RuntimeException('Independent request reservations were not refunded correctly.');
    }

    for ($request = 1; $request <= AiQuotaService::DAILY_LIMIT; $request++) {
        $state = $productionDefault->consume($userId);
        if (
            !$state['allowed']
            || $state['remaining'] !== AiQuotaService::DAILY_LIMIT - $request
        ) {
            throw new RuntimeException('Quota consumption was not atomic and sequential.');
        }
        $productionDefault->finalize(
            $userId,
            $state['windowStartedAt'] ?? null,
            $state['reservationToken'] ?? null
        );
    }
    $productionBlocked = $productionDefault->consume($userId);
    if (!$productionBlocked['exhausted'] || $productionBlocked['allowed']) {
        throw new RuntimeException('The production default did not block request 16.');
    }
    $raisedStatus = $quota->status($userId);
    if (
        $raisedStatus['used'] !== AiQuotaService::DAILY_LIMIT
        || $raisedStatus['remaining'] !== $limit - AiQuotaService::DAILY_LIMIT
    ) {
        throw new RuntimeException('Raising the local limit did not preserve the existing window count.');
    }
    for ($request = AiQuotaService::DAILY_LIMIT + 1; $request <= $limit; $request++) {
        $state = $quota->consume($userId);
        if (!$state['allowed'] || $state['remaining'] !== $limit - $request) {
            throw new RuntimeException('The raised local quota could not continue without a database reset.');
        }
        $quota->finalize(
            $userId,
            $state['windowStartedAt'] ?? null,
            $state['reservationToken'] ?? null
        );
    }
    $blocked = $quota->consume($userId);
    if ($blocked['allowed'] || !$blocked['exhausted'] || $blocked['resetAt'] === null) {
        throw new RuntimeException('The request after the configured limit was not blocked.');
    }
    $storedCount = $db->prepare(
        'SELECT request_count FROM ai_usage_windows WHERE user_id = ?'
    );
    $storedCount->execute([$userId]);
    if ((int) $storedCount->fetchColumn() !== $limit) {
        throw new RuntimeException('Blocked requests must not increase the stored count.');
    }
} finally {
    $cleanup = $db->prepare('DELETE FROM users WHERE id = ? AND email = ?');
    $cleanup->execute([$userId, $email]);
    foreach ($originalConfigEnvironment as $key => $originalValue) {
        if ($originalValue === false) {
            putenv($key);
        } else {
            putenv($key . '=' . $originalValue);
        }
    }
}

echo "PHP AI quota smoke test passed (configurable limit; temporary test user removed).\n";
