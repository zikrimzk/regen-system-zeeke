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
    $folder = getenv('KERJAYAKU_02K_EVIDENCE') ?: $root . '/docs/kerjayaku/phase-02k/screenshots';
    if (!is_dir($folder) && !mkdir($folder, 0777, true)) throw new RuntimeException('Could not create the evidence folder.');
    $mode = ($argv[1] ?? '') === '--baseline' ? 'baseline' : 'final';
    $output = [1 => STDOUT, 2 => STDERR];
    $process = proc_open(['node', __DIR__.'/capture-phase02k.mjs', $fixture->base, $folder, $mode, (string)$seed['resumeId']], $output, $pipes, $root);
    if (!is_resource($process)) throw new RuntimeException('Could not start the browser test.');
    $status = proc_close($process);
} finally {
    $fixture->close();
    proc_terminate($sink);
    fclose($smtpPipes[1]);
    proc_close($sink);
}
exit($status ?? 1);
