<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Small invalidation events only. Application content stays behind its normal authorized API. */
final class RealtimeEvents
{
    public const TOPICS=['maintenance','features','campaigns','support','feedback','notifications','alerts','users',
        'overview','reports','analytics','templates','documents','profile','ai','system','email','security','operations','recovery','audit','admins','store','pricing','wallet'];

    public function __construct(private readonly PDO $db) {}

    public function publish(string $topic, string $audience, int $recipient=0, ?int $resource=null): void
    {
        if (!in_array($topic,self::TOPICS,true) || !in_array($audience,['user','admin','users'],true)
            || ($audience==='user' && $recipient<1)) throw new \InvalidArgumentException('Invalid event scope.');
        $q=$this->db->prepare('INSERT INTO realtime_outbox (topic,audience,recipient_id,resource_id) VALUES (?,?,?,?)');
        $q->execute([$topic,$audience,$recipient,$resource]);
        ManagedRealtime::schedule($this->db);
    }

    /** Committed outbox rows are serialized here, so replay cannot skip an out-of-order domain commit. */
    public function dispatch(): void
    {
        if ($this->db->inTransaction() || !$this->db->query('SELECT id FROM realtime_outbox LIMIT 1')->fetchColumn()) return;
        $name='regen-live-'.substr(hash('sha256',(string)$this->db->query('SELECT DATABASE()')->fetchColumn()),0,24);
        $lock=$this->db->prepare('SELECT GET_LOCK(?,0)'); $lock->execute([$name]);
        if ((int)$lock->fetchColumn()!==1) return;
        try {
            $this->db->beginTransaction();
            // A nonlocking snapshot skips uncommitted inserts. The named lock already serializes dispatchers.
            $rows=$this->db->query('SELECT * FROM realtime_outbox ORDER BY id LIMIT 1000')->fetchAll();
            if($rows){
                $values=[];foreach($rows as$row)array_push($values,$row['topic'],$row['audience'],$row['recipient_id'],$row['resource_id']);
                $insert=$this->db->prepare('INSERT INTO realtime_events (topic,audience,recipient_id,resource_id) VALUES '.implode(',',array_fill(0,count($rows),'(?,?,?,?)')));$insert->execute($values);
                $delete=$this->db->prepare('DELETE FROM realtime_outbox WHERE id IN ('.implode(',',array_fill(0,count($rows),'?')).')');$delete->execute(array_column($rows,'id'));
            }
            $this->db->commit();
            if($rows)ManagedRealtime::schedule($this->db);
        } catch (\Throwable $error) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $error; }
        finally { $q=$this->db->prepare('SELECT RELEASE_LOCK(?)'); $q->execute([$name]); }
    }

    public function cursor(): int { return (int)$this->db->query('SELECT COALESCE(MAX(id),0) FROM realtime_events')->fetchColumn(); }

    public function read(array $principal, int $since): array
    {
        $range=$this->db->query('SELECT COALESCE(MIN(id),0) AS first_id,COALESCE(MAX(id),0) AS last_id FROM realtime_events')->fetch();
        $top=(int)$range['last_id'];$oldest=(int)$range['first_id'];
        $reset=$since>$top || ($since>0 && $oldest>0 && $since<$oldest-1);
        if ($reset) $since=$top;
        $topics=$principal['topics'];
        if (!$topics || $since===$top) return ['events'=>[],'cursor'=>$top,'reset'=>$reset];
        $where=$principal['role']==='admin' ? "audience='admin' AND recipient_id IN (0,?)" : "(audience='user' AND recipient_id=? OR audience='users')";
        $marks=implode(',',array_fill(0,count($topics),'?'));
        $q=$this->db->prepare("SELECT id,topic,resource_id FROM realtime_events WHERE id>? AND id<=? AND ($where) AND topic IN ($marks) ORDER BY id LIMIT 100");
        $q->execute([$since,$top,$principal['id'],...$topics]); $rows=$q->fetchAll();
        $events=array_map(static fn(array $row):array=>['id'=>(int)$row['id'],'topic'=>$row['topic'],'resourceId'=>$row['resource_id']!==null?(int)$row['resource_id']:null],$rows);
        return ['events'=>$events,'cursor'=>count($rows)===100?(int)end($rows)['id']:$top,'reset'=>$reset];
    }

    public function fromAudit(string $event, ?string $targetType, int|string|null $targetId, string $actorType, ?int $actorId): void
    {
        $id=is_numeric($targetId)?(int)$targetId:null;
        if (str_contains($event,'.action_') || str_starts_with($event,'admin.resume_viewed') || $event==='support.attachment_viewed') return;
        $this->publish('audit','admin');
        $user=$targetType==='user'?$id:($actorType==='user'?$actorId:null);
        if (str_starts_with($event,'support.') || str_contains($event,'feedback') || str_starts_with($event,'auth.')) {
            $this->publish('overview','admin');$this->publish('reports','admin');
        }
        if (str_starts_with($event,'support.')) {
            $this->publish('support','admin',0,$id);
            if ($id) { $q=$this->db->prepare('SELECT user_id FROM support_tickets WHERE id=?');$q->execute([$id]);$user=(int)$q->fetchColumn(); }
            if ($user) $this->publish('support','user',$user,$id);
        } elseif (in_array($event,['admin.support_configuration_updated','admin.support_upload_limits_updated'],true)) {
            $this->publish('system','admin');$this->publish('support','users');
        } elseif (str_contains($event,'campaign')) {
            $this->publish('campaigns','admin',0,$id); $this->publish('campaigns','users');
        } elseif ($event==='admin.maintenance_updated') {
            $this->publish('maintenance','users'); $this->publish('system','admin');
        } elseif (str_starts_with($event,'store.')) {
            // Individual spending updates the account, not every user's product configuration.
            if($user)$this->publish('users','admin',0,$user);
        } elseif (str_contains($event,'feature') || str_contains($event,'settings_updated')) {
            $this->publish('features','users');$this->publish('system','admin');$this->publish('ai','admin');
        } elseif (str_contains($event,'feedback')) {
            $this->publish('feedback','admin',0,$id);if($user)$this->publish('feedback','user',$user);
        } elseif (str_contains($event,'template')) {
            if($actorType==='admin'){$this->publish('templates','admin');$this->publish('features','users');}
        } elseif (str_starts_with($event,'admin.') && $targetType==='admin') {
            $this->publish('admins','admin');$this->publish('profile','admin',(int)$id);
        } elseif (str_starts_with($event,'profile.') || str_starts_with($event,'auth.') || $targetType==='user') {
            $this->publish('users','admin',0,$user);if($user)$this->publish('profile','user',$user);
        }
        if ($actorType==='user' && (str_contains($event,'resume') || str_contains($event,'letter'))) {
            $this->publish('documents','user',(int)$actorId,$id);$this->publish('templates','admin');
        }
        if ($actorType==='admin' && preg_match('/(?:security|network|recovery|mail|email)/',$event,$m)) {
            $this->publish(match($m[0]){'network'=>'security','mail'=>'email',default=>$m[0]},'admin');
        }
    }

    public function prune(): void
    {
        $this->db->exec('DELETE FROM realtime_events WHERE created_at<UTC_TIMESTAMP()-INTERVAL 1 DAY LIMIT 10000');
        $this->db->exec('DELETE FROM realtime_connections WHERE expires_at<=UTC_TIMESTAMP()');
    }
}
