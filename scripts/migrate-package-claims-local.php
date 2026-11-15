<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';ReGen\Config::load($root);
if(!in_array(ReGen\Config::get('app.env'),['development','test','testing'],true)||!in_array(ReGen\Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('Local development only. Apply migration 022 through the normal hosting process.');
$name=ReGen\Config::get('db.name');$db=new PDO('mysql:host='.ReGen\Config::get('db.host').';port='.ReGen\Config::get('db.port').';dbname='.$name.';charset=utf8mb4',ReGen\Config::get('db.user'),ReGen\Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$q=$db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='token_packages' AND COLUMN_NAME=?");
foreach(['landing_visible'=>'TINYINT(1) NOT NULL DEFAULT 1','claim_enabled'=>'TINYINT(1) NOT NULL DEFAULT 0','claim_starts_at'=>'DATETIME NULL','claim_ends_at'=>'DATETIME NULL','claim_limit'=>'INT UNSIGNED NULL'] as $column=>$definition){$q->execute([$name,$column]);if(!(int)$q->fetchColumn())$db->exec('ALTER TABLE token_packages ADD COLUMN '.$column.' '.$definition);}
$sql=file_get_contents($root.'/database/migrations/022_package_claims_and_presentation.sql');$db->exec(substr($sql,strpos($sql,'CREATE TABLE')));
echo "Package claim schema 022 is installed in the local development database.\n";
