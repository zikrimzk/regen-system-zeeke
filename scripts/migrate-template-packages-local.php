<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';ReGen\Config::load($root);
if(!in_array(ReGen\Config::get('app.env'),['development','test','testing'],true)||!in_array(ReGen\Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('This helper is restricted to local development. Apply migration 021 through the normal hosting deployment process.');
$name=ReGen\Config::get('db.name');$db=new PDO('mysql:host='.ReGen\Config::get('db.host').';port='.ReGen\Config::get('db.port').';dbname='.$name.';charset=utf8mb4',ReGen\Config::get('db.user'),ReGen\Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$q=$db->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');$missing=[];
foreach(['token_packages','package_entitlements'] as $table){$q->execute([$name,$table,'template_tiers']);if(!(int)$q->fetchColumn())$missing[]=$table;}
$tables=$db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('package_template_unlocks','user_template_library')");$tables->execute([$name]);
if(!$missing&&(int)$tables->fetchColumn()===2){echo "Template package schema 021 is already installed.\n";exit;}
foreach($missing as $table)$db->exec('ALTER TABLE '.$table.' ADD COLUMN template_tiers JSON NULL');
$sql=file_get_contents($root.'/database/migrations/021_template_package_access.sql');$db->exec(substr($sql,strpos($sql,'CREATE TABLE IF NOT EXISTS package_template_unlocks')));
echo "Template package schema 021 applied to the local development database.\n";
