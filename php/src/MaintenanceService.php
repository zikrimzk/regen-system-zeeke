<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Application-wide access policy. UTC storage; schedules are evaluated on every request. */
final class MaintenanceService
{
    public function __construct(private readonly PDO $db) {}

    public function status(?int $now = null): array
    {
        $row = $this->db->query('SELECT * FROM maintenance_controls WHERE id=1')->fetch();
        if (!$row) throw new \RuntimeException('Maintenance configuration is missing. Apply migration 017.');
        $now ??= time();
        $start = $row['starts_at'] ? strtotime($row['starts_at'].' UTC') : null;
        $end = $row['ends_at'] ? strtotime($row['ends_at'].' UTC') : null;
        $state = match (true) {
            $row['mode']==='off' => 'off',
            $end!==null && $end<=$now => 'completed',
            $row['mode']==='scheduled' && $start!==null && $start>$now => 'scheduled',
            default => 'active',
        };
        return ['mode'=>$row['mode'],'state'=>$state,'active'=>$state==='active','title'=>$row['title'],
            'message'=>$row['message'],'startsAt'=>$row['starts_at'],'endsAt'=>$row['ends_at'],
            'estimatedAt'=>$row['estimated_at'],'version'=>(int)$row['version'],'serverNow'=>gmdate(DATE_ATOM,$now)];
    }

    public function save(array $body, int $adminId): array
    {
        $mode = $body['mode'] ?? '';
        $title = Sanitizer::cleanText($body['title'] ?? '',false,120);
        $message = Sanitizer::cleanText($body['message'] ?? '',true,2000);
        if (!in_array($mode,['off','immediate','scheduled'],true) || mb_strlen($title)<3 || mb_strlen($message)<10) {
            throw new \DomainException('Choose an activation option, a title and a message of at least 10 characters.');
        }
        $dates=[];
        foreach (['startsAt','endsAt','estimatedAt'] as $key) {
            $value=$body[$key]??null;
            if (!$value) { $dates[$key]=null; continue; }
            $date=\DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z',(string)$value,new \DateTimeZone('UTC'));
            if (!$date || $date->format('Y-m-d\TH:i:s\Z')!==$value) throw new \DomainException('Use valid UTC maintenance dates.');
            $dates[$key]=$date->format('Y-m-d H:i:s');
        }
        if ($mode==='scheduled' && !$dates['startsAt']) throw new \DomainException('Scheduled maintenance needs a start time.');
        if ($mode==='immediate') $dates['startsAt']=null;
        $start=$dates['startsAt']?strtotime($dates['startsAt'].' UTC'):time();
        foreach (['endsAt','estimatedAt'] as $key) if ($mode!=='off' && $dates[$key] && strtotime($dates[$key].' UTC')<=$start) throw new \DomainException('Restoration and end times must follow the maintenance start.');
        $this->db->beginTransaction();
        try {
            $current=$this->db->query('SELECT version FROM maintenance_controls WHERE id=1 FOR UPDATE')->fetchColumn();
            if ((int)$current!==(int)($body['version']??-1)) throw new ConcurrentUpdate('Maintenance was changed in another session. Reload its configuration before saving.');
            $q=$this->db->prepare('UPDATE maintenance_controls SET mode=?,title=?,message=?,starts_at=?,ends_at=?,estimated_at=?,version=version+1,updated_by=? WHERE id=1');
            $q->execute([$mode,$title,$message,$dates['startsAt'],$dates['endsAt'],$dates['estimatedAt'],$adminId]);
            (new AuditLogger($this->db))->log('admin.maintenance_updated','settings','maintenance',['mode'=>$mode,...$dates],'admin',$adminId);
            $this->db->commit();
        } catch (\Throwable $error) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $error; }
        return $this->status();
    }
}
