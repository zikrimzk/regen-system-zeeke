<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class SupportRepository
{
    public const STATUSES = ['open','in_progress','waiting_user','resolved','closed'];
    public const CATEGORIES = ['account','ai','resume','cover_letter','billing','technical','other'];
    public function __construct(private readonly PDO $db) {}
    public function listing(?int $userId, string $status, string $search, int $page): array
    {
        $where=[]; $params=[];
        if ($userId !== null) { $where[]='t.user_id=?'; $params[]=$userId; }
        if ($status==='awaiting_staff')$where[]="t.status IN ('open','in_progress')";
        if (in_array($status,self::STATUSES,true)) { $where[]='t.status=?'; $params[]=$status; }
        if ($search !== '') { $where[]='(t.subject LIKE ? OR u.email LIKE ? OR CAST(t.id AS CHAR)=?)'; $params[]='%'.$search.'%'; $params[]='%'.$search.'%'; $params[]=$search; }
        $sql=' FROM support_tickets t JOIN users u ON u.id=t.user_id'.($where?' WHERE '.implode(' AND ',$where):'');
        $q=$this->db->prepare('SELECT COUNT(*)'.$sql); $q->execute($params); $total=(int)$q->fetchColumn();
        $q=$this->db->prepare('SELECT t.*,u.first_name,u.last_name,u.email'.$sql.' ORDER BY t.updated_at DESC,t.id DESC LIMIT 25 OFFSET '.(max(0,min(10000,$page-1))*25)); $q->execute($params);
        return ['items'=>$q->fetchAll(),'total'=>$total];
    }
    public function detail(int $id, ?int $userId, int $messagePage = 1): ?array
    {
        $q=$this->db->prepare('SELECT t.*,u.first_name,u.last_name,u.email FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?'.($userId !== null?' AND t.user_id=?':'')); $q->execute($userId!==null?[$id,$userId]:[$id]); $ticket=$q->fetch();
        if (!$ticket) return null;
        $where='ticket_id=?'.($userId!==null?' AND internal_note=0':'');
        $q=$this->db->prepare('SELECT COUNT(*) FROM support_messages WHERE '.$where);$q->execute([$id]);$total=(int)$q->fetchColumn();$messagePage=max(1,min(max(1,(int)ceil($total/20)),$messagePage));
        $q=$this->db->prepare('SELECT id,author_type,author_id,internal_note,body,created_at FROM support_messages WHERE '.$where.' ORDER BY id DESC LIMIT 20 OFFSET '.(($messagePage-1)*20)); $q->execute([$id]);
        $result=['ticket'=>$ticket,'messages'=>array_reverse($q->fetchAll()),'messagePagination'=>['page'=>$messagePage,'pages'=>max(1,(int)ceil($total/20)),'total'=>$total]];
        if($userId===null){
            $ticket['clientContext']=json_decode((string)($ticket['client_context']??'{}'),true)?:[];$result['ticket']=$ticket;
            $q=$this->db->prepare("SELECT created_at,user_agent,metadata FROM audit_logs WHERE target_type='user' AND target_id=? AND event_type IN ('auth.login_success','auth.google_login_success') ORDER BY id DESC LIMIT 5");$q->execute([(string)$ticket['user_id']]);
            $result['recentSignIns']=array_map(static function(array $row):array{$meta=json_decode((string)$row['metadata'],true)?:[];return ['at'=>$row['created_at'],'client'=>$meta['client']??DeviceContext::fromUserAgent($row['user_agent'])];},$q->fetchAll());
        }else{unset($result['ticket']['client_context']);}
        $result['messages']=(new SupportAttachments($this->db))->forMessages($result['messages'],$userId===null);
        $result['attachmentLimits']=(new SupportConfiguration($this->db))->attachmentLimits();
        return $result;
    }
    public function create(int $userId, array $body, array $uploads=[]): int
    {
        $subject=Sanitizer::cleanText($body['subject'] ?? '',false,180); $text=Sanitizer::cleanText($body['body'] ?? '',true,10000); $category=$body['category'] ?? '';
        if (mb_strlen($subject)<5 || mb_strlen($text)<10 || !in_array($category,self::CATEGORIES,true)) throw new \DomainException('Enter a subject of at least 5 characters, a category and details of at least 10 characters.');
        $attachments=new SupportAttachments($this->db);$staged=$attachments->stage($uploads);
        $this->db->beginTransaction();
        try {
            $context=DeviceContext::capture(is_array($body['clientContext']??null)?$body['clientContext']:[]);
            $q=$this->db->prepare('INSERT INTO support_tickets (user_id,subject,category,client_context) VALUES (?,?,?,?)'); $q->execute([$userId,$subject,$category,json_encode($context,JSON_THROW_ON_ERROR)]); $id=(int)$this->db->lastInsertId();
            $this->db->prepare("INSERT INTO support_messages (ticket_id,author_type,author_id,body) VALUES (?,'user',?,?)")->execute([$id,$userId,$text]);
            $attachments->attach($staged,$id,(int)$this->db->lastInsertId(),$userId);
            (new AuditLogger($this->db))->log('support.ticket_created','ticket',$id,[],'user',$userId);
            (new NotificationService($this->db))->notify($userId,'support','Ticket #'.$id.' received','We received your support request: '.$subject.'. You can follow progress and reply in Support.','/support?ticket='.$id,'ticket-created:'.$id);
            $this->db->commit(); return $id;
        } catch (\Throwable $e) { if($this->db->inTransaction())$this->db->rollBack();$attachments->discard($staged);throw $e; }
    }
    public function update(int $id, ?int $userId, int $actorId, array $body, array $uploads=[]): void
    {
        $attachments=new SupportAttachments($this->db);$staged=[];
        $this->db->beginTransaction();
        try {
            $q=$this->db->prepare('SELECT * FROM support_tickets WHERE id=?'.($userId!==null?' AND user_id=?':'').' FOR UPDATE'); $q->execute($userId!==null?[$id,$userId]:[$id]); $ticket=$q->fetch();
            if (!$ticket) throw new \OutOfBoundsException('Ticket not found.');
            if ((int)($body['version'] ?? -1)!==(int)$ticket['version']) throw new ConcurrentUpdate('This conversation changed. Refresh before sending your update. Your unsent reply is still in the form.');
            if($ticket['status']==='closed')throw new \DomainException($userId===null?'Reopen this request before changing it or adding a reply.':'This request is closed. Open a new support request if you need further help.');
            $text=Sanitizer::cleanText($body['body'] ?? '',true,10000); $note=$userId===null && ($body['internalNote'] ?? false)===true;
            $staged=$attachments->stage($uploads);
            if ($userId!==null && $text==='' && !$staged) throw new \DomainException('Enter a reply or attach a file.');
            $status=$userId!==null?'open':($body['status'] ?? $ticket['status']); $priority=$userId!==null?$ticket['priority']:($body['priority'] ?? $ticket['priority']);
            if (!in_array($status,self::STATUSES,true) || !in_array($priority,['low','normal','high','urgent'],true)) throw new \DomainException('Choose a valid status and priority.');
            $assigned=$userId!==null?$ticket['assigned_admin_id']:(array_key_exists('assignedAdminId',$body)?$body['assignedAdminId']:$ticket['assigned_admin_id']);
            if ($assigned) {
                $q=$this->db->prepare("SELECT a.id FROM admins a WHERE a.id=? AND a.status='active' AND NOT EXISTS(SELECT 1 FROM admin_access_assignments x WHERE x.admin_id=a.id AND x.expires_at IS NOT NULL AND x.expires_at<=UTC_TIMESTAMP()) AND (a.is_bootstrap=0 OR EXISTS(SELECT 1 FROM app_settings s WHERE s.setting_key='bootstrap_admin_enabled' AND s.setting_value='1')) AND (a.role='super_admin' OR EXISTS(SELECT 1 FROM admin_permissions p WHERE p.admin_id=a.id AND p.module='support.manage'))"); $q->execute([(int)$assigned]);
                if (!$q->fetchColumn()) throw new \DomainException('Assignee needs active support access.');
            }
            if ($text!==''||$staged) {
                $this->db->prepare('INSERT INTO support_messages (ticket_id,author_type,author_id,internal_note,body) VALUES (?,?,?,?,?)')->execute([$id,$userId===null?'admin':'user',$actorId,(int)$note,$text]);
                $attachments->attach($staged,$id,(int)$this->db->lastInsertId(),(int)$ticket['user_id']);
            }
            $this->db->prepare('UPDATE support_tickets SET status=?,priority=?,assigned_admin_id=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$status,$priority,$assigned?:null,$id]);
            (new AuditLogger($this->db))->log('support.ticket_changed','ticket',$id,['before'=>['status'=>$ticket['status'],'priority'=>$ticket['priority'],'assignedAdminId'=>$ticket['assigned_admin_id']],'after'=>['status'=>$status,'priority'=>$priority,'assignedAdminId'=>$assigned?:null],'internalNote'=>$note,'hasMessage'=>$text!==''],$userId===null?'admin':'user',$actorId);
            if($userId!==null)(new AdminAlertService($this->db))->publish('support','New reply on request #'.$id,'A user replied to request #'.$id.'. Review it in Support.','support-reply:'.$id.':'.((int)$ticket['version']+1));
            if ($userId===null && ((!$note && $text!=='') || $status!==$ticket['status'])) (new NotificationService($this->db))->notify((int)$ticket['user_id'],'support','Ticket #'.$id.' updated','Your support request "'.$ticket['subject'].'" is now '.str_replace('_',' ',$status).'.'.($text!==''&&!$note?' A support reply is available.':''),'/support?ticket='.$id,'ticket-update:'.$id.':'.((int)$ticket['version']+1));
            $this->db->commit();
        } catch (\Throwable $e) { if($this->db->inTransaction())$this->db->rollBack();$attachments->discard($staged);throw $e; }
    }
    public function reopen(int $id,int $adminId,int $version): void
    {
        $this->db->beginTransaction();
        try{
            $query=$this->db->prepare('SELECT * FROM support_tickets WHERE id=? FOR UPDATE');$query->execute([$id]);$ticket=$query->fetch();
            if(!$ticket)throw new \OutOfBoundsException('Ticket not found.');
            if((int)$ticket['version']!==$version)throw new ConcurrentUpdate('This request changed. Refresh before reopening it.');
            if($ticket['status']!=='closed')throw new \DomainException('Only closed requests need to be reopened.');
            $this->db->prepare("UPDATE support_tickets SET status='open',version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=?")->execute([$id]);
            (new AuditLogger($this->db))->log('support.ticket_reopened','ticket',$id,['previousStatus'=>'closed'],'admin',$adminId);
            (new NotificationService($this->db))->notify((int)$ticket['user_id'],'support','Ticket #'.$id.' reopened','The support team reopened your request. You can reply in Support.','/support?ticket='.$id,'ticket-reopened:'.$id.':'.($version+1));
            $this->db->commit();
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }
    public function assignees(): array
    {
        return $this->db->query("SELECT a.id,a.first_name,a.last_name FROM admins a WHERE a.status='active' AND NOT EXISTS(SELECT 1 FROM admin_access_assignments x WHERE x.admin_id=a.id AND x.expires_at IS NOT NULL AND x.expires_at<=UTC_TIMESTAMP()) AND (a.is_bootstrap=0 OR EXISTS(SELECT 1 FROM app_settings s WHERE s.setting_key='bootstrap_admin_enabled' AND s.setting_value='1')) AND (a.role='super_admin' OR EXISTS(SELECT 1 FROM admin_permissions p WHERE p.admin_id=a.id AND p.module='support.manage')) ORDER BY a.first_name")->fetchAll();
    }
}
