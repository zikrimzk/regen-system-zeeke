<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);$fixture=json_decode((string)file_get_contents($root.'/tmp/admin-qa-fixture.json'),true);
if(!preg_match('/^regen_admin_test_[a-f0-9]{12}$/D',$fixture['database']??''))throw new RuntimeException('Only the isolated fixture is allowed.');
$base='http://127.0.0.1:8098';$cursors=[];
foreach(['admin','user']as$role){$handle=curl_init($base.'/api/realtime/session');curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5,CURLOPT_COOKIEFILE=>$root.'/tmp/live-http/'.$role.'.cookies']);$identity=json_decode((string)curl_exec($handle),true);unset($handle);if(!isset($identity['cursor']))throw new RuntimeException('Sign in to the fixture first.');$cursors[$role]=(int)$identity['cursor'];}
$total=100;$concurrency=10;$next=0;$active=[];$latencies=[];$failures=[];$started=microtime(true);$multi=curl_multi_init();
$add=static function()use(&$next,$total,$base,$root,$multi,&$active,$cursors):bool{
    if($next>=$total)return false;$index=$next++;
    [$role,$path]=match($index%4){0=>['admin','/api/realtime/changes?since='.$cursors['admin']],1=>['user','/api/realtime/changes?since='.$cursors['user']],2=>['admin','/api/admin/work-queues'],default=>['user','/api/dashboard']};
    $handle=curl_init($base.$path);curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5,CURLOPT_COOKIEFILE=>$root.'/tmp/live-http/'.$role.'.cookies']);
    $active[spl_object_id($handle)]=[$handle,$path];curl_multi_add_handle($multi,$handle);return true;
};
try{
    for($index=0;$index<$concurrency;$index++)$add();
    do{
        do{$status=curl_multi_exec($multi,$running);}while($status===CURLM_CALL_MULTI_PERFORM);
        while($info=curl_multi_info_read($multi)){
            $handle=$info['handle'];$id=spl_object_id($handle);$path=$active[$id][1];$code=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);
            $latencies[]=curl_getinfo($handle,CURLINFO_TOTAL_TIME)*1000;
            if($code!==200||$info['result']!==CURLE_OK)$failures[]=['path'=>$path,'status'=>$code,'transport'=>$info['result']];
            curl_multi_remove_handle($multi,$handle);unset($active[$id]);$add();
        }
        if($active)curl_multi_select($multi,0.05);
    }while($active);
}finally{foreach($active as[$handle])curl_multi_remove_handle($multi,$handle);curl_multi_close($multi);}
sort($latencies);$report=['server'=>'PHP single worker, isolated localhost fixture','requests'=>$total,'concurrency'=>$concurrency,'failed'=>count($failures),
    'elapsedMs'=>round((microtime(true)-$started)*1000),'p50Ms'=>round($latencies[(int)floor(count($latencies)*0.50)]??0),
    'p95Ms'=>round($latencies[(int)floor(count($latencies)*0.95)]??0),'maxMs'=>round(max($latencies?:[0])),
    'scope'=>'Authenticated delta checks mixed with dashboard/work-queue reads. This is not a production capacity guarantee.'];
file_put_contents($root.'/output/live-uat/php-concurrency.json',json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n");
echo json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n";
if($failures)throw new RuntimeException('Concurrent requests failed: '.json_encode($failures));
if($report['p95Ms']>2000)throw new RuntimeException('Unexpected request blocking: local p95 exceeded two seconds.');
