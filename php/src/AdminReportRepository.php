<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class AdminReportRepository
{
    public function __construct(private readonly PDO $db) {}

    public static function period(array $input): array
    {
        $start = (string)($input['from'] ?? gmdate('Y-m-d',strtotime('-29 days')));
        $end = (string)($input['to'] ?? gmdate('Y-m-d'));
        foreach ([$start,$end] as $value) {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d',$value,new \DateTimeZone('UTC'));
            if (!$date || $date->format('Y-m-d') !== $value) throw new \DomainException('Choose valid report dates.');
        }
        if ($start > $end || strtotime($end)-strtotime($start)>366*86400) throw new \DomainException('Choose a report period of up to 367 days, with the end after the start.');
        return ['from'=>$start,'to'=>$end,'start'=>$start.' 00:00:00','end'=>gmdate('Y-m-d H:i:s',strtotime($end.' UTC')+86400)];
    }

    public function summary(array $period): array
    {
        $params = [$period['start'],$period['end']];
        $query = $this->db->prepare('SELECT COUNT(*) AS responses,ROUND(AVG(rating),2) AS averageRating,ROUND(AVG(functionality_rating),2) AS functionalityRating,ROUND(AVG(ease_rating),2) AS easeRating,SUM(rating>=4) AS positive,SUM(rating<=2) AS negative FROM user_feedback WHERE created_at>=? AND created_at<?');
        $query->execute($params); $satisfaction=$query->fetch();
        $query = $this->db->prepare('SELECT rating,COUNT(*) AS count FROM user_feedback WHERE created_at>=? AND created_at<? GROUP BY rating ORDER BY rating');
        $query->execute($params);$ratings=$query->fetchAll();
        $query = $this->db->prepare('SELECT area,COUNT(*) AS count,ROUND(AVG(rating),2) AS rating FROM user_feedback WHERE created_at>=? AND created_at<? GROUP BY area ORDER BY count DESC');
        $query->execute($params);$areas=$query->fetchAll();
        $query = $this->db->prepare('SELECT DATE(created_at) AS day,COUNT(*) AS count,ROUND(AVG(rating),2) AS rating FROM user_feedback WHERE created_at>=? AND created_at<? GROUP BY DATE(created_at) ORDER BY day');
        $query->execute($params);$trend=$query->fetchAll();
        $query=$this->db->prepare("SELECT COUNT(*) AS opened,SUM(status NOT IN ('resolved','closed')) AS unresolved,SUM(priority IN ('high','urgent') AND status NOT IN ('resolved','closed')) AS highPriority FROM support_tickets WHERE created_at>=? AND created_at<?");
        $query->execute($params);$support=$query->fetch();
        $query=$this->db->prepare("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE,t.created_at,r.first_reply)),1) FROM support_tickets t JOIN (SELECT ticket_id,MIN(created_at) AS first_reply FROM support_messages WHERE author_type='admin' AND internal_note=0 GROUP BY ticket_id) r ON r.ticket_id=t.id WHERE t.created_at>=? AND t.created_at<?");
        $query->execute($params);$support['averageFirstReplyMinutes']=$query->fetchColumn();
        $query=$this->db->query("SELECT COUNT(*) AS waiting,MAX(TIMESTAMPDIFF(HOUR,created_at,UTC_TIMESTAMP())) AS oldestHours FROM support_tickets WHERE status NOT IN ('resolved','closed')");$backlog=$query->fetch();
        $target=(int)(new SupportConfiguration($this->db))->get()['responseHours'];
        $backlog['responseTargetHours']=$target;
        $backlog['awaitingFirstReply']=(int)$this->db->query("SELECT COUNT(*) FROM support_tickets t WHERE t.status IN ('open','in_progress') AND t.created_at<UTC_TIMESTAMP()-INTERVAL ".$target." HOUR AND NOT EXISTS(SELECT 1 FROM support_messages m WHERE m.ticket_id=t.id AND m.author_type='admin' AND m.internal_note=0)")->fetchColumn();
        $query=$this->db->prepare('SELECT DATE(created_at) AS day,COUNT(*) AS count FROM users WHERE created_at>=? AND created_at<? GROUP BY DATE(created_at) ORDER BY day');$query->execute($params);$registrations=$query->fetchAll();
        $query=$this->db->prepare('SELECT day,page_views,visitors FROM landing_daily WHERE day>=? AND day<=? ORDER BY day');$query->execute([$period['from'],$period['to']]);$traffic=$query->fetchAll();
        return ['period'=>$period,'satisfaction'=>$satisfaction,'ratings'=>$ratings,'areas'=>$areas,'trend'=>$trend,'support'=>$support,'backlog'=>$backlog,'registrations'=>$registrations,'traffic'=>$traffic];
    }

    public function audit(array $filters): array
    {
        $period=self::period($filters);$params=[$period['start'],$period['end']];$where='created_at>=? AND created_at<?';
        if (in_array($filters['actor']??'',['admin','user','guest'],true)) { $where.=' AND actor_type=?';$params[]=$filters['actor']; }
        if(ctype_digit((string)($filters['actorId']??'')) && (int)$filters['actorId']>0){$where.=' AND actor_id=?';$params[]=(int)$filters['actorId'];}
        $event=Sanitizer::cleanText($filters['event']??'',false,100);
        if ($event!=='') { $where.=' AND event_type LIKE ?';$params[]='%'.$event.'%'; }
        $page=max(1,min(10000,(int)($filters['page']??1)));
        $query=$this->db->prepare('SELECT COUNT(*) FROM audit_logs WHERE '.$where);$query->execute($params);$total=(int)$query->fetchColumn();
        $query=$this->db->prepare("SELECT id,actor_type,actor_id,event_type,target_type,target_id,user_agent,metadata,created_at,
            CASE actor_type WHEN 'user' THEN (SELECT CONCAT(first_name,' ',last_name) FROM users WHERE id=audit_logs.actor_id) WHEN 'admin' THEN (SELECT CONCAT(first_name,' ',last_name) FROM admins WHERE id=audit_logs.actor_id) ELSE NULL END AS actor_name
            FROM audit_logs WHERE ".$where.' ORDER BY id DESC LIMIT 50 OFFSET '.(($page-1)*50));$query->execute($params);
        $items=array_map(static function(array $row):array{$metadata=json_decode((string)$row['metadata'],true)?:[];$row['client']=$metadata['client']??DeviceContext::fromUserAgent($row['user_agent']);return $row;},$query->fetchAll());
        return ['items'=>$items,'total'=>$total,'page'=>$page,'period'=>$period];
    }

    public function export(string $kind, array $period): array
    {
        if ($kind==='feedback') {
            $query=$this->db->prepare('SELECT id,user_id,rating,functionality_rating,ease_rating,area,source,comment,status,created_at FROM user_feedback WHERE created_at>=? AND created_at<? ORDER BY id LIMIT 10000');
        } elseif ($kind==='audit') {
            $query=$this->db->prepare('SELECT id,actor_type,actor_id,event_type,target_type,target_id,user_agent,metadata,created_at FROM audit_logs WHERE created_at>=? AND created_at<? ORDER BY id LIMIT 10000');
        } else {
            $data=$this->summary($period);
            return [['metric','value','from_utc','to_utc'],[
                ['Feedback responses',$data['satisfaction']['responses'],$period['from'],$period['to']],
                ['Average rating',$data['satisfaction']['averageRating'],$period['from'],$period['to']],
                ['Positive ratings (4–5)',$data['satisfaction']['positive'],$period['from'],$period['to']],
                ['Support requests opened',$data['support']['opened'],$period['from'],$period['to']],
                ['Average first public reply (minutes)',$data['support']['averageFirstReplyMinutes'],$period['from'],$period['to']],
                ['Current unresolved requests',$data['backlog']['waiting'],$period['from'],$period['to']],
            ]];
        }
        $query->execute([$period['start'],$period['end']]);$rows=$query->fetchAll();
        $headers=$rows?array_keys($rows[0]):($kind==='feedback'?['id','user_id','rating','functionality_rating','ease_rating','area','source','comment','status','created_at']:['id','actor_type','actor_id','event_type','target_type','target_id','metadata','created_at']);
        return [$headers,array_map('array_values',$rows)];
    }

    public static function csv(array $headers,array $rows): string
    {
        $stream=fopen('php://temp','w+');fwrite($stream,"\xEF\xBB\xBF");
        foreach ([$headers,...$rows] as $row) {
            $safe=array_map(static function($value): string {
                $value=(string)($value??'');
                return preg_match('/^[\s]*[=+@\-\t\r]/u',$value)?"'".$value:$value;
            },$row);
            fputcsv($stream,$safe,',','"','');
        }
        rewind($stream);$text=stream_get_contents($stream);fclose($stream);return $text;
    }
}
