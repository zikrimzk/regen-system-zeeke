<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (($argv[1] ?? '') === '--smtp-sink') {
    $server = stream_socket_server('tcp://127.0.0.1:0');
    if (!$server) throw new RuntimeException('Could not open the localhost mail sink.');
    $address = stream_socket_get_name($server, false);
    echo substr($address, strrpos($address, ':') + 1).PHP_EOL;
    fflush(STDOUT);
    while ($peer = stream_socket_accept($server, 180)) {
        stream_set_timeout($peer, 5);
        fwrite($peer, "220 localhost ESMTP fixture\r\n");
        $commands = ['EHLO ' => "250 AUTH LOGIN\r\n", 'AUTH LOGIN' => "334 VXNlcm5hbWU6\r\n",
            base64_encode('fixture') => "334 UGFzc3dvcmQ6\r\n", base64_encode('local-test-only') => "235 Accepted\r\n",
            'MAIL FROM:' => "250 Accepted\r\n", 'RCPT TO:<product-signup@qa.regen.local>' => "250 Accepted\r\n", 'DATA' => "354 Send message\r\n"];
        foreach ($commands as $prefix => $reply) {
            $line = fgets($peer);
            if ($line === false || !str_starts_with($line, $prefix)) { fclose($peer); continue 2; }
            fwrite($peer, $reply);
        }
        while (($line = fgets($peer)) !== false && rtrim($line, "\r\n") !== '.') { /* Discard the synthetic message. */ }
        fwrite($peer, "250 Accepted\r\n");
        if (fgets($peer) !== false) fwrite($peer, "221 Goodbye\r\n");
        fclose($peer);
    }
    exit;
}
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
require __DIR__ . '/fixtures/StoreHttpFixture.php';

$sink = proc_open([PHP_BINARY,__FILE__,'--smtp-sink'], [1=>['pipe','w'],2=>STDERR], $smtpPipes, $root);
if (!is_resource($sink)) throw new RuntimeException('Could not start the local mail sink.');
$port = (int) fgets($smtpPipes[1]);
$fixture = new StoreHttpFixture($root, mailSinkPort:$port);
try {
    $seed = $fixture->start();
    $db = new PDO('mysql:host='.ReGen\Config::get('db.host').';port='.ReGen\Config::get('db.port').';dbname='.$seed['database'],
        ReGen\Config::get('db.user'), ReGen\Config::get('db.password'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $db->exec("UPDATE token_packages SET landing_visible=1, card_layout='hero' WHERE sort_order BETWEEN 0 AND 2");
    $db->exec("UPDATE token_packages SET features_json=JSON_OBJECT('pdf_download',3), validity_days=30 WHERE sort_order=0");
    $db->exec("UPDATE token_packages SET features_json=JSON_OBJECT('ai_assist',5,'mochi_coach',2,'templates',1), template_tiers=JSON_ARRAY('basic'),
        validity_days=60, compare_price_minor=3900, promotion_starts_at=UTC_TIMESTAMP()-INTERVAL 1 DAY, promotion_ends_at=UTC_TIMESTAMP()+INTERVAL 1 DAY WHERE sort_order=1");
    $db->exec("UPDATE token_packages SET price_minor=0, claim_enabled=1, claim_limit=25, claim_starts_at=UTC_TIMESTAMP()-INTERVAL 1 DAY,
        claim_ends_at=UTC_TIMESTAMP()+INTERVAL 1 DAY WHERE sort_order=2");
    $admin = (int)$db->query("SELECT id FROM admins WHERE role='super_admin' LIMIT 1")->fetchColumn();
    $store = new ReGen\TokenStore($db);
    $offer = ['name'=>'Expired practice offer','tokens'=>10,'bonusTokens'=>0,'priceMinor'=>0,'currency'=>'MYR','highlighted'=>false,
        'active'=>true,'sortOrder'=>3,'cardLayout'=>'row','claimEnabled'=>true,'claimLimit'=>8,
        'claimStartsAt'=>gmdate('Y-m-d\TH:i:s\Z',time()-172800),'claimEndsAt'=>gmdate('Y-m-d\TH:i:s\Z',time()-86400)];
    $store->savePackage(null,$offer,$admin);
    $store->savePackage(null,['name'=>'Hidden QA plan','active'=>false]+$offer,$admin);
    $folder = getenv('KERJAYAKU_02L_EVIDENCE') ?: $root . '/docs/kerjayaku/phase-02l/screenshots';
    if (!is_dir($folder) && !mkdir($folder, 0777, true)) throw new RuntimeException('Could not create the evidence folder.');
    $mode = str_contains((string)file_get_contents($root.'/php/views/landing.html'),'data-signature-hero') ? 'final' : 'baseline';
    $output = [1 => STDOUT, 2 => ['file', $folder . '/browser-diagnostics.log', 'a']];
    $process = proc_open(['node', __DIR__.'/capture-phase02l.mjs', $fixture->base, $folder, $mode, (string)$seed['resumeId']], $output, $pipes, $root);
    if (!is_resource($process)) throw new RuntimeException('Could not start the browser test.');
    $status = proc_close($process);
} finally {
    $fixture->close();
    proc_terminate($sink);
    fclose($smtpPipes[1]);
    proc_close($sink);
}
exit($status ?? 1);
