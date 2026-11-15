<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
require __DIR__ . '/fixtures/StoreHttpFixture.php';

use ReGen\{AdminAccess, Config, FeaturePricing, ResumeRepository, Routes, SchemaReadiness, UserRepository};

$fixture = new StoreHttpFixture($root);
$assertions = 0;
$check = static function (bool $passed, string $message) use (&$assertions): void {
    if (!$passed) throw new RuntimeException($message);
    $assertions++;
};
try {
    $seed = $fixture->start();
    $connect = static fn(): PDO => new PDO(
        'mysql:host=' . Config::get('db.host') . ';port=' . Config::get('db.port') . ';dbname=' . $seed['database'] . ';charset=utf8mb4',
        Config::get('db.user'), Config::get('db.password'),
        [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]
    );
    $db = $connect();
    $user = $seed['userId'];
    $resume = $seed['resumeId'];
    $other = (int) $db->query("SELECT id FROM users WHERE email='other@qa.regen.local'")->fetchColumn();
    $admin = (int) $db->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
    $delegate = (int) $db->query("SELECT id FROM admins WHERE email='agent@qa.regen.local'")->fetchColumn();
    $db->exec("UPDATE feature_prices SET mode='free',token_cost=0 WHERE feature_key='templates'");
    (new ResumeRepository($db))->getOrCreatePrimary($other, (new UserRepository($db))->findById($other), 'Second synthetic resume');

    $call = static function (string $role, string $path, string $method = 'GET', ?array $payload = null, string $csrf = '') use ($fixture): array {
        $handle = curl_init($fixture->base . $path);
        $jar = $fixture->directory . '/' . $role . '.cookies';
        $headers = ['Accept: application/json'];
        if ($payload !== null) $headers[] = 'Content-Type: application/json';
        if ($csrf !== '') $headers[] = 'X-CSRF-Token: ' . $csrf;
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER=>true, CURLOPT_HEADER=>true, CURLOPT_TIMEOUT=>15, CURLOPT_CUSTOMREQUEST=>$method,
            CURLOPT_COOKIEFILE=>$jar, CURLOPT_COOKIEJAR=>$jar, CURLOPT_HTTPHEADER=>$headers,
        ]);
        if ($payload !== null) curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload, JSON_THROW_ON_ERROR));
        $response = curl_exec($handle);
        if (!is_string($response)) throw new RuntimeException('The isolated HTTP request failed.');
        $headerLength = curl_getinfo($handle, CURLINFO_HEADER_SIZE);
        $body = substr($response, $headerLength);
        curl_setopt($handle, CURLOPT_COOKIELIST, 'FLUSH');
        return ['status'=>curl_getinfo($handle, CURLINFO_RESPONSE_CODE), 'headers'=>substr($response, 0, $headerLength),
            'body'=>$body, 'data'=>json_decode($body, true) ?? []];
    };

    $target = "/builder?id=$resume&section=skills";
    $legacy = $call('candidate', "/builder.html?id=$resume&section=skills");
    $check($legacy['status'] === 302 && str_contains($legacy['headers'], 'Location: ' . $target), 'Alias lost editor ID or selected section.');
    $check($call('candidate', $target)['status'] === 302, 'Anonymous candidates must sign in before entering an editor.');
    $signedIn = $call('candidate', '/api/auth/login', 'POST', ['email'=>'amina@qa.regen.local','password'=>'New-Password-567890']);
    $check($signedIn['status'] === 200 && $signedIn['data']['redirect'] === $target, 'Sign-in did not restore the intended editor.');
    $candidateCsrf = $signedIn['data']['csrfToken'];
    $check($call('candidate', $target)['status'] === 200, 'Owned editor shell did not load.');
    $otherLogin = $call('other', '/api/auth/login', 'POST', ['email'=>'other@qa.regen.local','password'=>'Qa-Other-567890']);
    $check($otherLogin['status'] === 200 && $call('other', "/api/resume/$resume")['status'] === 404, 'Second candidate must not read the private resume.');
    $check($call('other', "/api/pdf/$resume/document")['status'] === 404, 'Second candidate must not render the private resume.');
    $letter = $call('candidate', '/api/cover-letters', 'POST',
        ['company'=>'Fictional Company','role'=>'Tester','body'=>'This is a synthetic cover letter.'], $candidateCsrf);
    $check($letter['status'] === 201, 'Synthetic cover letter was not saved.');
    $letterId = $letter['data']['data']['id'];
    $check($call('other', "/api/cover-letters/$letterId")['status'] === 404, 'Second candidate must not read the private cover letter.');
    $check($call('candidate', '/api/admin/me')['status'] === 401, 'Candidate session must not count as admin authentication.');

    $adminLogin = $call('admin', '/api/admin/auth/login', 'POST', ['email'=>'jamie@qa.regen.local','password'=>'Qa-Admin-567891']);
    $delegateLogin = $call('delegate', '/api/admin/auth/login', 'POST', ['email'=>'agent@qa.regen.local','password'=>'Qa-Agent-567890']);
    $check($adminLogin['status'] === 200 && $delegateLogin['status'] === 200, 'Synthetic administrators could not sign in.');
    $adminCsrf = $adminLogin['data']['csrfToken'];
    $delegateCsrf = $delegateLogin['data']['csrfToken'];
    $export = "/api/admin/users/$user/export";
    $check($call('delegate', $export, 'POST', ['password'=>'Qa-Agent-567890'], $delegateCsrf)['status'] === 403, 'Support grant must not permit full export.');
    $check($call('admin', $export)['status'] === 428, 'Legacy GET must request reauthentication without returning documents.');
    $check($call('admin', $export, 'POST', ['password'=>'wrong'], $adminCsrf)['status'] === 403, 'Incorrect admin password did not block export.');
    $download = $call('admin', $export, 'POST', ['password'=>'Qa-Admin-567891'], $adminCsrf);
    $check($download['status'] === 200 && count($download['data']['resumes']) === 1 && count($download['data']['coverLetters']) === 1, 'Authorized export must keep the legacy payload.');

    $access = new AdminAccess($db);
    $allowed = ['users.view','users.export','templates.view','templates.resumes','recovery.view'];
    $access->assign($delegate, ['capabilities'=>$allowed,'purpose'=>'Synthetic private access verification.','version'=>1], $admin);
    $check($call('delegate', "/api/admin/templates/classic/resumes/$resume/preview")['status'] === 200, 'Explicit template resume grant failed.');
    $check($call('delegate', $export, 'POST', ['password'=>'Qa-Agent-567890'], $delegateCsrf)['status'] === 200, 'Existing explicit export grant must remain effective.');
    $snapshot = $call('admin', '/api/admin/recovery', 'POST', ['userId'=>$user,'label'=>'Synthetic recovery point'], $adminCsrf);
    $check($snapshot['status'] === 201, 'Synthetic recovery point was not created.');
    $point = $snapshot['data']['id'];
    $restore = "/api/admin/recovery/$point/restore";
    $check($call('delegate', "/api/admin/recovery/$point")['status'] === 200, 'Recovery read permission must still allow inspecting metadata.');
    $check($call('delegate', $restore, 'POST', ['confirmation'=>"RESTORE $point",'password'=>'Qa-Agent-567890'], $delegateCsrf)['status'] === 403, 'Read-only recovery grant must not permit restore.');
    $check($call('admin', $restore, 'POST', ['confirmation'=>"RESTORE $point"], $adminCsrf)['status'] === 403, 'Restore must require current credentials.');
    $check($call('admin', $restore, 'POST', ['confirmation'=>"RESTORE $point",'password'=>'Qa-Admin-567891'], $adminCsrf)['status'] === 200, 'Authorized synthetic restore failed.');
    $db->exec("UPDATE admin_access_assignments SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE admin_id=$delegate");
    $check($call('delegate', $export, 'POST', ['password'=>'Qa-Agent-567890'], $delegateCsrf)['status'] === 403
        && $call('delegate', "/api/admin/templates/classic/resumes/$resume/pdf")['status'] === 403, 'Expired grants must take effect during an active session.');

    $db->exec("UPDATE admins SET must_change_password=1 WHERE id=$admin");
    $check($call('admin', '/api/admin/maintenance')['status'] === 428 && $call('admin', '/api/admin/me')['status'] === 200, 'Password setup must gate privileged actions.');
    $db->exec("UPDATE admins SET must_change_password=0 WHERE id=$admin");
    $current = $call('admin', '/api/admin/maintenance')['data']['maintenance'];
    $change = ['mode'=>'immediate','title'=>'Synthetic maintenance','message'=>'Saved documents remain available after this test.','version'=>$current['version']];
    $set = $call('admin', '/api/admin/maintenance', 'PUT', $change, $adminCsrf);
    $check($set['status'] === 200 && $set['data']['maintenance']['active'], 'Admin could not activate maintenance.');
    foreach (Routes::PAGES as $path => [, $group]) {
        if (!in_array($group, ['candidate','auth'], true)) continue;
        $blocked = $call('candidate', $path);
        $check($blocked['status'] === 503 && str_contains($blocked['headers'], 'Cache-Control: no-store'), 'Maintenance must block ' . $path);
        $check($call('candidate', $path . '.html')['status'] === 503, 'Maintenance must block legacy ' . $path);
    }
    $blocked = $call('candidate', '/payments/result.html?order=RG-0123456789abcdef0123456789abcdef');
    $check(str_contains($blocked['body'], 'data-return-to="/payments/result?order=RG-0123456789abcdef0123456789abcdef"'), 'Maintenance must preserve the payment return reference.');
    $check($call('candidate', "/api/cover-letters/$letterId")['status'] === 503 && $call('candidate', '/api/mochi/chat', 'POST', [])['status'] === 503, 'Candidate reads/writes bypassed maintenance.');
    $live = $call('candidate', '/api/realtime/session');
    $check($live['data']['topics'] === ['maintenance'] && $live['data']['managed'] === null, 'Recovery realtime must be limited to maintenance.');
    $check($call('candidate', '/api/realtime/authorize', 'POST', [], $candidateCsrf)['status'] === 503, 'Candidate cannot authorise managed channels during maintenance.');
    $check($call('anonymous', '/api/webhooks/hitpay/sandbox', 'POST', [])['status'] === 401, 'Maintenance exemption must leave callback signature validation in place.');
    $check($call('anonymous', '/api/health')['status'] === 200 && $call('admin', '/admin')['status'] === 200, 'Required operations must stay available.');
    $check($call('admin', '/api/admin/maintenance', 'PUT', [...$change, 'mode'=>'off','version'=>$set['data']['maintenance']['version']], $adminCsrf)['status'] === 200
        && $call('candidate', "/api/resume/$resume")['status'] === 200, 'Ending maintenance must preserve the saved resume.');

    $payment = (new SchemaReadiness($db))->payments();
    $check($payment['schemaReady'] && !$payment['configured'], 'Synthetic schema should be ready without a live gateway.');
    $serverHealth = $call('admin', '/api/admin/operations/health')['data']['health'];
    $check($serverHealth['schema']['ready'] && $serverHealth['payments']['schemaReady']
        && !$serverHealth['payments']['providerVerified'], 'Admin readiness must distinguish schema from provider verification.');

    // Separate connections overlap while the first request's reservation is held across rendering.
    $pricing = new FeaturePricing($db);
    $otherRequest = new FeaturePricing($connect());
    $version = $pricing->all($user)['pdf_download']['version'];
    $pricing->purchase($user, 'pdf_download', $version, 'phase01-export-credit-first');
    $hold = $pricing->reserve($user, ['pdf_download']);
    $check($hold['allowed'] && !$otherRequest->reserve($user, ['pdf_download'])['allowed'], 'Overlapping downloads must not both reserve the final use.');
    $pricing->settle($hold['reservations'], false);
    $retry = $otherRequest->reserve($user, ['pdf_download']);
    $check($retry['allowed'], 'A failed render must release its hold.');
    $otherRequest->settle($retry['reservations'], false);
    $pricing->purchase($user, 'pdf_download', $version, 'phase01-export-credit-second');
    $pdf = "/api/pdf/$resume/generate";
    foreach ([1,2] as $used) {
        $output = $call('candidate', $pdf);
        $check($output['status'] === 200 && str_starts_with($output['body'], '%PDF-'), 'Entitled resume PDF did not render.');
        $check((int) $db->query("SELECT COUNT(*) FROM feature_use_credits WHERE user_id=$user AND feature_key='pdf_download' AND state='used'")->fetchColumn() === $used,
            'The repeated GET must expose the current per-request accounting behavior.');
    }
    $check($call('candidate', $pdf)['status'] === 402, 'A third request must not overspend exhausted credits.');
    $pricing->purchase($user, 'pdf_download', $version, 'phase01-export-credit-letter');
    $output = $call('candidate', "/api/cover-letters/$letterId/pdf");
    $check($output['status'] === 200 && str_starts_with($output['body'], '%PDF-'), 'Entitled cover letter PDF did not render.');

    $db->exec("UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=$user");
    $check($call('candidate', $target)['status'] === 302 && $call('candidate', '/api/auth/me')['status'] === 401, 'Device revocation must protect both HTML and API.');
    $renewed = $call('candidate', '/api/auth/login', 'POST', ['email'=>'amina@qa.regen.local','password'=>'New-Password-567890']);
    $check($renewed['status'] === 200 && $renewed['data']['redirect'] === $target, 'Device revocation must preserve the intended page after reauthentication.');
    $db->exec('UPDATE app_sessions SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE');
    $check($call('other', '/api/auth/me')['status'] === 401 && $call('admin', '/api/admin/me')['status'] === 401, 'Expired candidate and admin sessions must be rejected.');
    echo "Phase 01 HTTP routes, permissions, maintenance, PDF accounting and readiness passed ($assertions assertions; synthetic database and local HTTP).\n";
} finally {
    $fixture->close();
}
