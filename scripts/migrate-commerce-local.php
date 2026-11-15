<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';
ReGen\Config::load($root);
if(!in_array(ReGen\Config::get('app.env'),['development','test','testing'],true)||!in_array(ReGen\Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('This helper is restricted to local development databases. Use migration 020 through the normal production deployment process.');
$name=ReGen\Config::get('db.name');
if(($argv[1]??'')==='--fixture'){
    $files=glob($root.'/tmp/store-http-*/router.php');
    if(count($files)!==1||!preg_match('/\$fixtureDatabase=\'(regen_store_http_[a-f0-9]{12})\'/D',file_get_contents($files[0]),$m))throw new RuntimeException('Choose a single running disposable preview.');
    $name=$m[1];
}
$db=new PDO('mysql:host='.ReGen\Config::get('db.host').';port='.ReGen\Config::get('db.port').';dbname='.$name.';charset=utf8mb4',ReGen\Config::get('db.user'),ReGen\Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$migration=file_get_contents($root.'/database/migrations/020_commercial_packages.sql');
$column=$db->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
$column->execute([$name,'token_packages','features_json']);
if(!(int)$column->fetchColumn())$db->exec(substr($migration,0,strpos($migration,'ALTER TABLE ai_usage_reservations')));
$column->execute([$name,'ai_usage_reservations','operation']);
if(!(int)$column->fetchColumn())$db->exec("ALTER TABLE ai_usage_reservations ADD COLUMN operation VARCHAR(20) NOT NULL DEFAULT 'refine'");
$db->exec(substr($migration,strpos($migration,'CREATE TABLE IF NOT EXISTS ai_token_activity')));
echo "Commercial schema 020 is ready in the local ".(($argv[1]??'')==='--fixture'?'disposable preview':'development database').".\n";
