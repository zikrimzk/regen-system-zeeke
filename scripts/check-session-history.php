<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/vendor/autoload.php';
ReGen\Config::load(dirname(__DIR__));
if (!in_array(ReGen\Config::get('app.env'), ['development','test','testing'], true)
    || !in_array(ReGen\Config::get('db.host'), ['localhost','127.0.0.1'], true)) {
    fwrite(STDERR, "Session integration checks require a local development database.\n"); exit(1);
}
$db = ReGen\Database::connection();
$repo = new ReGen\AccountRepository($db);
$db->beginTransaction();
$assertions = 0;
$assert = static function (bool $condition, string $message) use (&$assertions): void {
    if (!$condition) throw new RuntimeException($message);
    $assertions++;
};
$initialSession = session_id();
$rawCurrent = bin2hex(random_bytes(24));
session_id($rawCurrent);
try {
    $sessionStorage = new ReGen\DatabaseSessionHandler($db, 900);
    $expiredSessionId = bin2hex(random_bytes(24));
    $assert($sessionStorage->updateTimestamp($expiredSessionId, '') && !$sessionStorage->validateId($expiredSessionId),
        'A request closing after its session was removed should not report a refresh failure or recreate it.');
    $db->prepare("INSERT INTO app_sessions (sid,session_data,expires_at) VALUES (?,'{}',UTC_TIMESTAMP(3)-INTERVAL 1 MINUTE)")
        ->execute([$expiredSessionId]);
    $assert($sessionStorage->updateTimestamp($expiredSessionId, '') && !$sessionStorage->validateId($expiredSessionId),
        'A timestamp refresh must not revive an expired session.');
    $users = new ReGen\UserRepository($db);
    $makeUser = static fn (): array => $users->create(['firstName'=>'Session','lastName'=>'Check','email'=>'session-check-'.bin2hex(random_bytes(8)).'@example.com','password'=>bin2hex(random_bytes(24))]);
    $first = $makeUser(); $second = $makeUser();
    $insert = static function (int $user, string $raw, ?string $revoked = null, ?string $seen = null) use ($db): int {
        $query = $db->prepare('INSERT INTO account_sessions (user_id,session_hash,device_label,browser_label,ip_hash,last_seen_at,created_at,revoked_at) VALUES (?,?,?,?,?,?,?,?)');
        $timestamp = $seen ?? gmdate('Y-m-d H:i:s');
        $query->execute([$user,hash('sha256',$raw),'Test device','Test browser',hash('sha256','local-check'),$timestamp,$timestamp,$revoked]);
        return (int) $db->lastInsertId();
    };
    $currentId = $insert($first['id'], $rawCurrent);
    $otherActive = bin2hex(random_bytes(24)); $otherId = $insert($first['id'], $otherActive);
    $revokedRaw = bin2hex(random_bytes(24)); $revokedId = $insert($first['id'], $revokedRaw, gmdate('Y-m-d H:i:s'));
    $expiredId = $insert($first['id'], bin2hex(random_bytes(24)), null, gmdate('Y-m-d H:i:s', time()-90000));
    for ($i=0; $i<8; $i++) $insert($first['id'], bin2hex(random_bytes(24)), gmdate('Y-m-d H:i:s'));
    $foreignId = $insert($second['id'], bin2hex(random_bytes(24)), gmdate('Y-m-d H:i:s'));
    $page = $repo->sessionPage($first['id']);
    $assert(count($page['sessions']) === 5, 'Page size must be bounded.');
    $assert($page['pagination']['total'] === 12 && $page['pagination']['pages'] === 3, 'History totals must include all visible entries.');
    $assert($page['sessions'][0]['id'] === $currentId && $page['sessions'][0]['current'], 'Current device must be first.');
    $assert($page['activeSessionCount'] === 2 && $page['historyCount'] === 10, 'Only live sessions count as active.');
    $assert(!isset($page['sessions'][0]['session_hash']) && !isset($page['sessions'][0]['ip_hash']), 'Session secrets must not enter the response.');
    $assert($repo->sessionPage($first['id'], -8)['pagination']['page'] === 1, 'Negative pages must clamp.');
    $assert($repo->sessionPage($first['id'], PHP_INT_MAX)['pagination']['page'] === 3, 'Large pages must clamp.');
    $assert(!$repo->revokeSession($second['id'], $currentId), 'A different owner cannot revoke a session.');
    $assert(!$repo->isCurrentSession($second['id'], $currentId), 'Current-device checks must include ownership.');
    $assert($repo->clearSessionHistory($first['id']) === 10, 'Only inactive history is cleared.');
    $remaining = $repo->sessionPage($first['id']);
    $assert($remaining['pagination']['total'] === 2 && $remaining['activeSessionCount'] === 2, 'Active sessions must remain visible.');
    $assert($repo->sessionPage($second['id'])['pagination']['total'] === 1, 'Another account history must remain untouched.');
    $assert($repo->clearSessionHistory($first['id']) === 0, 'Repeated clearing must be safe.');
    $query = $db->prepare('SELECT COUNT(*) FROM account_sessions WHERE user_id=?'); $query->execute([$first['id']]);
    $assert((int)$query->fetchColumn() === 12, 'Revocation tombstones must be retained.');
    session_id($revokedRaw);
    $assert(!$repo->currentSessionActive($first['id']), 'Clearing history must not reactivate a revoked cookie.');
    $nextRevoked = bin2hex(random_bytes(24));
    $repo->rotateSession($first['id'],hash('sha256',$revokedRaw),hash('sha256',$nextRevoked));
    session_id($nextRevoked);
    $assert(!$repo->currentSessionActive($first['id']), 'ID rotation must preserve revocation.');
    $query = $db->prepare('SELECT created_at FROM account_sessions WHERE id=?');$query->execute([$otherId]);$created=$query->fetchColumn();
    $nextActive = bin2hex(random_bytes(24));
    $repo->rotateSession($first['id'],hash('sha256',$otherActive),hash('sha256',$nextActive));
    session_id($nextActive);
    $assert($repo->isCurrentSession($first['id'],$otherId), 'Rotation must retain the same device ID.');
    $query->execute([$otherId]);$assert($query->fetchColumn()===$created,'Rotation must retain the original creation time.');
    $assert($repo->currentSessionActive($first['id']), 'A valid rotated session must remain valid.');
} finally {
    $db->rollBack();
    session_id($initialSession);
}
echo "Session pagination, ownership, history clearing and rotation passed ($assertions assertions; rolled back).\n";
