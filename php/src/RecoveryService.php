<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class RecoveryService
{
    public function __construct(private readonly PDO $db) {}
    public function policy(): array
    {
        $q=$this->db->query("SELECT payload FROM operations_settings WHERE setting_key='recovery_policy'");
        return array_replace(['autoEnabled'=>true,'maxPoints'=>10,'intervalMinutes'=>10,'retentionDays'=>90],json_decode((string)($q->fetchColumn()?:'{}'),true)?:[]);
    }
    public function savePolicy(array $body,int $adminId): void
    {
        if(!is_bool($body['autoEnabled']??null))throw new \DomainException('Choose whether automatic history is enabled.');
        $data=['autoEnabled'=>$body['autoEnabled']];
        foreach(['maxPoints'=>[2,50],'intervalMinutes'=>[5,1440],'retentionDays'=>[1,365]] as $key=>[$min,$max]) {
            $value=filter_var($body[$key]??null,FILTER_VALIDATE_INT);if($value===false||$value<$min||$value>$max)throw new \DomainException('Choose valid recovery retention and capture limits.');$data[$key]=$value;
        }
        $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('recovery_policy',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()")->execute([json_encode($data,JSON_THROW_ON_ERROR),$adminId]);
    }
    public function purgeExpired(): int
    {
        $days=max(1,min(365,(int)$this->policy()['retentionDays']));
        return $this->db->exec('DELETE FROM recovery_snapshots WHERE created_at<UTC_TIMESTAMP()-INTERVAL '.$days.' DAY LIMIT 500');
    }
    public function listing(int $userId=0): array
    {
        $q=$this->db->prepare('SELECT s.id,s.user_id,s.label,s.created_by,s.created_at,s.restored_at,OCTET_LENGTH(s.payload) AS bytes,u.email FROM recovery_snapshots s JOIN users u ON u.id=s.user_id'.($userId>0?' WHERE s.user_id=?':'').' ORDER BY s.id DESC LIMIT 100'); $q->execute($userId>0?[$userId]:[]); return $q->fetchAll();
    }
    public function snapshot(int $userId, string $label, ?int $adminId=null, bool $automatic=false): ?int
    {
        $policy=$this->policy();if($automatic && !$policy['autoEnabled'])return null;
        $own=!$this->db->inTransaction();
        if($own)$this->db->beginTransaction();
        try {
            $q=$this->db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $q->execute([$userId]);
            if(!$q->fetchColumn()) throw new \DomainException('User not found.');
            if ($automatic) {
                $q=$this->db->prepare('SELECT id FROM recovery_snapshots WHERE user_id=? AND created_at>UTC_TIMESTAMP()-INTERVAL '.max(5,min(1440,(int)$policy['intervalMinutes'])).' MINUTE LIMIT 1'); $q->execute([$userId]);
                if ($q->fetchColumn()) { if($own)$this->db->commit(); return null; }
            }
            $resumes=$this->db->prepare('SELECT id,title,resume_data FROM resumes WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 1'); $resumes->execute([$userId]);
            $letters=$this->db->prepare('SELECT id,resume_id,company,role,recipient,company_details,job_description,body,recipient_address,letter_date FROM cover_letters WHERE user_id=? ORDER BY id'); $letters->execute([$userId]);
            $payload=json_encode(['format'=>1,'userId'=>$userId,'resumes'=>$resumes->fetchAll(),'letters'=>$letters->fetchAll()],JSON_THROW_ON_ERROR);
            $q=$this->db->prepare('INSERT INTO recovery_snapshots (user_id,label,payload,created_by) VALUES (?,?,?,?)'); $q->execute([$userId,mb_substr($label,0,180),$payload,$adminId]); $id=(int)$this->db->lastInsertId();
            // KEEP BOUNDED HISTORY. ACCOUNT DELETION CASCADES THESE COPIES.
            $old=$this->db->prepare('SELECT id FROM recovery_snapshots WHERE user_id=? ORDER BY id DESC LIMIT 1000 OFFSET '.max(2,min(50,(int)$policy['maxPoints']))); $old->execute([$userId]);
            $remove=$this->db->prepare('DELETE FROM recovery_snapshots WHERE id=?'); foreach($old->fetchAll(PDO::FETCH_COLUMN) as $oldId)$remove->execute([$oldId]);
            if($own)$this->db->commit(); return $id;
        } catch(\Throwable $e) { if($own && $this->db->inTransaction())$this->db->rollBack(); throw $e; }
    }
    public function inspect(int $id): ?array
    {
        $q=$this->db->prepare('SELECT id,user_id,label,payload,created_at FROM recovery_snapshots WHERE id=?'); $q->execute([$id]); $row=$q->fetch();
        if(!$row)return null;
        $data=json_decode($row['payload'],true,64,JSON_THROW_ON_ERROR);
        return ['id'=>(int)$row['id'],'userId'=>(int)$row['user_id'],'label'=>$row['label'],'createdAt'=>$row['created_at'],'resumeTitles'=>array_column($data['resumes'],'title'),'letterCount'=>count($data['letters'])];
    }
    public function restore(int $id, int $adminId): int
    {
        $this->db->beginTransaction();
        try {
            $q=$this->db->prepare('SELECT user_id FROM recovery_snapshots WHERE id=?'); $q->execute([$id]); $userId=(int)$q->fetchColumn();
            if(!$userId)throw new \OutOfBoundsException('Recovery point not found.');
            $q=$this->db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $q->execute([$userId]); if(!$q->fetchColumn())throw new \DomainException('Account no longer exists.');
            $days=max(1,min(365,(int)$this->policy()['retentionDays']));
            $q=$this->db->prepare('SELECT payload FROM recovery_snapshots WHERE id=? AND user_id=? AND created_at>=UTC_TIMESTAMP()-INTERVAL '.$days.' DAY FOR UPDATE'); $q->execute([$id,$userId]); $payload=$q->fetchColumn();
            if(!$payload)throw new \DomainException('Recovery point expired. Refresh the list.');
            $data=json_decode($payload,true,64,JSON_THROW_ON_ERROR);
            if(($data['format']??0)!==1 || (int)$data['userId']!==$userId)throw new \DomainException('Invalid recovery point.');
            $this->snapshot($userId,'Before restore #'.$id,$adminId);
            $resumeId=null;
            foreach($data['resumes'] as $resume) {
                $q=$this->db->prepare('SELECT id FROM resumes WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 1'); $q->execute([$userId]); $resumeId=$q->fetchColumn();
                if($resumeId) $this->db->prepare('UPDATE resumes SET title=?,resume_data=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?')->execute([$resume['title'],$resume['resume_data'],$resumeId,$userId]);
                else { $this->db->prepare('INSERT INTO resumes (user_id,title,resume_data) VALUES (?,?,?)')->execute([$userId,$resume['title'],$resume['resume_data']]); $resumeId=(int)$this->db->lastInsertId(); }
            }
            // UPSERT OWNED LETTERS; NEWER LETTERS ARE RETAINED.
            if($resumeId)foreach($data['letters'] as $letter) {
                $q=$this->db->prepare('SELECT id FROM cover_letters WHERE id=? AND user_id=?'); $q->execute([$letter['id'],$userId]);
                $existing=$q->fetchColumn();
                $values=array_values(CoverLetterRepository::clean($letter));
                if($existing)$this->db->prepare('UPDATE cover_letters SET company=?,role=?,recipient=?,company_details=?,job_description=?,body=?,recipient_address=?,letter_date=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?')->execute([...$values,$existing,$userId]);
                else {
                    $q=$this->db->prepare('SELECT user_id FROM cover_letters WHERE id=?');$q->execute([$letter['id']]);
                    if($q->fetchColumn())throw new \DomainException('A document identifier belongs to another account. Restore was cancelled.');
                    $this->db->prepare('INSERT INTO cover_letters (id,company,role,recipient,company_details,job_description,body,recipient_address,letter_date,user_id,resume_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([$letter['id'],...$values,$userId,$resumeId]);
                }
            }
            $this->db->prepare('UPDATE recovery_snapshots SET restored_at=UTC_TIMESTAMP() WHERE id=?')->execute([$id]);
            $this->db->prepare('INSERT INTO document_generations (user_id,generation) VALUES (?,1) ON DUPLICATE KEY UPDATE generation=generation+1')->execute([$userId]);
            (new NotificationService($this->db))->notify($userId,'security','Document recovery completed','An administrator restored your saved documents from recovery point #'.$id.'. Contact Support if you did not request this.');
            $this->db->commit(); return $userId;
        } catch(\Throwable $e) { if($this->db->inTransaction())$this->db->rollBack(); throw $e; }
    }
}
