<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';ReGen\Config::load($root);
if(!in_array(ReGen\Config::get('app.env'),['development','test','testing'],true)||!in_array(ReGen\Config::get('db.host'),['localhost','127.0.0.1','::1'],true))throw new RuntimeException('Local development only. Apply migration 024 through the hosting process.');
$db=ReGen\Database::connection();
$q=$db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='cover_letters' AND COLUMN_NAME=?");
$newDate=false;
foreach(['recipient_address'=>"VARCHAR(1000) NOT NULL DEFAULT ''",'letter_date'=>'DATE NULL'] as $column=>$definition){$q->execute([ReGen\Config::get('db.name'),$column]);if(!(int)$q->fetchColumn()){$db->exec('ALTER TABLE cover_letters ADD COLUMN '.$column.' '.$definition);if($column==='letter_date')$newDate=true;}}
if($newDate)$db->exec('UPDATE cover_letters SET letter_date=DATE(created_at) WHERE letter_date IS NULL');
if($db->query("SELECT setting_key FROM operations_settings WHERE setting_key='strict_package_upgrade_024'")->fetchColumn()){echo "Migration 024 already applied; current administrator rules preserved.\n";exit;}
$sql=explode('ALTER TABLE cover_letters',file_get_contents($root.'/database/migrations/024_strict_package_access.sql'))[0];
foreach(explode(';',$sql) as $statement)if(trim($statement)!=='')$db->exec($statement);
echo "Strict package access installed locally. Token fallback requires an explicit feature-rule change.\n";
