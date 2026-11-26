<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
require __DIR__ . '/fixtures/StoreHttpFixture.php';

$fixture = new StoreHttpFixture($root, true);
try {
    $seed = $fixture->start();
    $dsn = 'mysql:host=' . ReGen\Config::get('db.host') . ';port=' . ReGen\Config::get('db.port') . ';dbname=' . $seed['database'];
    $database = new PDO($dsn, ReGen\Config::get('db.user'), ReGen\Config::get('db.password'));
    $database->exec("UPDATE feature_prices SET mode='free', token_cost=0 WHERE feature_key IN ('templates', 'document_settings')");
    $database->exec("UPDATE feature_prices SET mode='per_use', token_cost=1 WHERE feature_key='resume_rename'");
    $database->exec("UPDATE token_packages SET compare_price_minor=price_minor+500 WHERE highlighted=1");
    $admin = (int)$database->query("SELECT id FROM admins WHERE email='jamie@qa.regen.local'")->fetchColumn();
    $mochiPackage = (new ReGen\TokenStore($database))->savePackage(null, [
        'name'=>'Mochi Studio', 'priceMinor'=>1900, 'currency'=>'MYR', 'active'=>true, 'highlighted'=>false,
        'tokens'=>0, 'bonusTokens'=>0, 'sortOrder'=>4,
        'features'=>['mochi_coach'=>null, 'ai_assist'=>2, 'ai_refine'=>2, 'document_preview'=>null],
    ], $admin);
    $version = (int)$database->query('SELECT version FROM token_packages WHERE id=' . $mochiPackage)->fetchColumn();
    (new ReGen\PackageAccess($database))->grant($mochiPackage, [
        'userId'=>$seed['userId'], 'version'=>$version, 'reference'=>'qa-launch-mochi-package', 'reason'=>'Fixture', 'includeTokens'=>false,
    ], $admin);
    (new ReGen\MochiProfile($database))->save($seed['userId'], ['action'=>'skip']);
    (new ReGen\NotificationService($database))->notify($seed['userId'],'account','QA notification','Synthetic inbox item for browser checks.','/notifications','qa-notice',false);
    $evidence = getenv('KERJAYAKU_02N_EVIDENCE') ?: $root . '/docs/kerjayaku/phase-02n/screenshots';
    $process = proc_open(
        ['node', __DIR__ . '/capture-phase02n.cjs', $fixture->base, $evidence, (string) $seed['resumeId']],
        [1 => STDOUT, 2 => STDERR],
        $pipes,
        $root,
    );
    if (!is_resource($process)) throw new RuntimeException('Could not start the isolated Chrome test.');
    $status = proc_close($process);
    echo file_get_contents($evidence . '/browser-results.txt');
} finally {
    $fixture->close();
}
exit($status ?? 1);
