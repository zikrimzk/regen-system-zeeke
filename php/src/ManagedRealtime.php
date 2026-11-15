<?php
declare(strict_types=1);
namespace ReGen;

use PDO;
use Pusher\Pusher;

/** Managed connections carry wakeups only. Authorized content stays on our own APIs. */
final class ManagedRealtime
{
    private static bool $scheduled=false;

    public function __construct(private readonly PDO $db, private readonly ?\Closure $sender=null) {}

    public static function configured(): bool
    {
        return Config::get('realtime.transport','auto')!=='poll'
            && preg_match('/^\d+$/D',(string)Config::get('realtime.pusher_app_id',''))===1
            && preg_match('/^[a-z0-9-]+$/D',(string)Config::get('realtime.pusher_cluster',''))===1
            && Config::get('realtime.pusher_key','')!=='' && Config::get('realtime.pusher_secret','')!=='';
    }

    private static function client(): Pusher
    {
        return new Pusher((string)Config::get('realtime.pusher_key'),(string)Config::get('realtime.pusher_secret'),
            (string)Config::get('realtime.pusher_app_id'),['cluster'=>Config::get('realtime.pusher_cluster'),
                'useTLS'=>true,'timeout'=>0.8],new \GuzzleHttp\Client(['connect_timeout'=>0.3,'timeout'=>0.8]));
    }

    public static function channels(array $principal): array
    {
        if($principal['role']==='user')return ['private-regen-users','private-regen-user-account-'.$principal['id']];
        return ['private-regen-admin-account-'.$principal['id'],...array_map(static fn(string $topic):string=>'private-regen-admin-'.$topic,$principal['topics'])];
    }

    public static function authorize(array $principal,string $channel,string $socket): array
    {
        if(!self::configured())throw new \DomainException('Managed updates are not configured.');
        if(!preg_match('/^\d+\.\d+$/D',$socket)||!in_array($channel,self::channels($principal),true))throw new \DomainException('This update channel is not available to this account.');
        return json_decode(self::client()->authorizeChannel($channel,$socket),true,512,JSON_THROW_ON_ERROR);
    }

    public static function publicConfiguration(array $principal): ?array
    {
        if(!self::configured())return null;
        return ['key'=>Config::get('realtime.pusher_key'),'cluster'=>Config::get('realtime.pusher_cluster'),
            'channels'=>self::channels($principal),'script'=>'/lib/pusher/pusher-8.6.0.min.js'];
    }

    public static function schedule(PDO $db): void
    {
        if(PHP_SAPI==='cli'||self::$scheduled||!self::configured())return;
        self::$scheduled=true;
        register_shutdown_function(static function()use($db):void{
            // Publish only committed changes; never let provider failure fail a user action.
            if($db->inTransaction())return;
            if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
            if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();
            try{
                $delivery=new self($db);$until=microtime(true)+(function_exists('fastcgi_finish_request')?1.2:0.5);
                do{(new RealtimeEvents($db))->dispatch();$sent=$delivery->flush();}while($sent>0&&microtime(true)<$until);
            }
            catch(\Throwable $error){error_log('[Managed updates] '.$error::class);}
        });
    }

    public function status(): array
    {
        $row=$this->db->query('SELECT failures,retry_at,last_success_at,last_error FROM realtime_delivery_state WHERE id=1')->fetch();
        return ['configured'=>self::configured(),'state'=>!self::configured()?'automatic':((int)($row['failures']??0)>0?'retrying':'ready'),
            'lastSuccessAt'=>$row['last_success_at']??null,'retryAt'=>$row['retry_at']??null,'message'=>$row['last_error']??null];
    }

    public function flush(): int
    {
        if(!$this->sender&&!self::configured())return 0;
        if($this->db->inTransaction())return 0;
        $name='regen-push-'.substr(hash('sha256',(string)$this->db->query('SELECT DATABASE()')->fetchColumn()),0,24);
        $q=$this->db->prepare('SELECT GET_LOCK(?,0)');$q->execute([$name]);if((int)$q->fetchColumn()!==1)return 0;
        try{
            $state=$this->db->query('SELECT * FROM realtime_delivery_state WHERE id=1')->fetch();
            if(!$state||($state['retry_at']&&strtotime($state['retry_at'].' UTC')>time()))return 0;
            $q=$this->db->prepare('SELECT id,topic,audience,recipient_id FROM realtime_events WHERE id>? ORDER BY id LIMIT 1000');$q->execute([(int)$state['delivered_cursor']]);$rows=$q->fetchAll();if(!$rows)return 0;
            $channels=[];$last=0;$count=0;
            foreach($rows as$row){
                $channel=match($row['audience']){'users'=>'private-regen-users','user'=>'private-regen-user-account-'.$row['recipient_id'],default=>(int)$row['recipient_id']?'private-regen-admin-account-'.$row['recipient_id']:'private-regen-admin-'.$row['topic']};
                if(!isset($channels[$channel])&&count($channels)===100)break;
                $channels[$channel]=true;$last=(int)$row['id'];$count++;
            }
            try{
                // Coalescing avoids one provider request for every record or every connected user.
                if($this->sender)($this->sender)(array_keys($channels),'wake',['changed'=>true]);
                else self::client()->trigger(array_keys($channels),'wake',['changed'=>true]);
                $q=$this->db->prepare('UPDATE realtime_delivery_state SET delivered_cursor=?,failures=0,retry_at=NULL,last_success_at=UTC_TIMESTAMP(),last_error=NULL WHERE id=1');$q->execute([$last]);
                return $count;
            }catch(\Throwable $error){
                $delay=min(300,30*(2**min(4,(int)$state['failures'])));
                $q=$this->db->prepare('UPDATE realtime_delivery_state SET failures=failures+1,retry_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),last_error=? WHERE id=1');$q->execute([$delay,'Managed provider unavailable']);
                if((int)$state['failures']===0)try{
                    (new AdminAlertService($this->db))->incident('managed-updates:'.gmdate('Y-m-d'),'warning','Live delivery needs attention',
                        'Managed delivery could not be reached. Automatic checks remain available and pending updates will retry. Review the provider configuration and service status.','operations');
                }catch(\Throwable){/* A secondary alert must not interfere with the durable retry. */}
                return 0;
            }
        }finally{$q=$this->db->prepare('SELECT RELEASE_LOCK(?)');$q->execute([$name]);}
    }
}
