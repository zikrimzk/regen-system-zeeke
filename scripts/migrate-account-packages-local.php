<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';ReGen\Config::load($root);
if(!in_array(ReGen\Config::get('app.env'),['development','test','testing'],true)||!in_array(ReGen\Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('Local development only. Apply migration 023 through the normal hosting process.');
$name=ReGen\Config::get('db.name');$db=new PDO('mysql:host='.ReGen\Config::get('db.host').';port='.ReGen\Config::get('db.port').';dbname='.$name.';charset=utf8mb4',ReGen\Config::get('db.user'),ReGen\Config::get('db.password'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$q=$db->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');$newLayout=false;$newCredit=false;
foreach(['token_packages'=>['card_layout'=>"VARCHAR(12) NOT NULL DEFAULT 'hero'",'coin_color'=>"VARCHAR(12) NOT NULL DEFAULT 'emerald'"],'package_grants'=>['revoked_at'=>'DATETIME NULL','revoked_by'=>'INT NULL','revocation_reason'=>'VARCHAR(300) NULL','credited_tokens'=>'INT UNSIGNED NOT NULL DEFAULT 0','reversed_tokens'=>'INT UNSIGNED NOT NULL DEFAULT 0','version'=>'INT NOT NULL DEFAULT 1'],'package_entitlements'=>['enabled'=>'TINYINT(1) NOT NULL DEFAULT 1']] as $table=>$columns)foreach($columns as $column=>$definition){$q->execute([$name,$table,$column]);if(!(int)$q->fetchColumn()){$db->exec('ALTER TABLE '.$table.' ADD COLUMN '.$column.' '.$definition);if($column==='card_layout')$newLayout=true;if($column==='credited_tokens')$newCredit=true;}}
if($newLayout)$db->exec("UPDATE token_packages SET card_layout=CASE WHEN (SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.displayMode')) FROM operations_settings WHERE setting_key='token_store')='simple' THEN 'row' ELSE 'hero' END");
if($newCredit)$db->exec("UPDATE package_grants g SET credited_tokens=COALESCE((SELECT SUM(l.amount) FROM ai_bonus_ledger l WHERE l.request_key=CONCAT('package-grant:',g.id) AND l.source='package_grant'),0)");
$sql=file_get_contents($root.'/database/migrations/023_package_layouts_and_account_management.sql');$db->exec(substr($sql,strpos($sql,'CREATE TABLE')));
echo "Account package schema 023 is installed in the local development database.\n";
