<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class CoverLetterRepository
{
    public function __construct(private readonly PDO $db) {}
    public function count(int $userId): int
    {
        $query = $this->db->prepare('SELECT COUNT(*) FROM cover_letters WHERE user_id = ?');
        $query->execute([$userId]);
        return (int) $query->fetchColumn();
    }
    public function list(int $userId): array
    {
        $q = $this->db->prepare('SELECT id, resume_id, company, role, updated_at FROM cover_letters WHERE user_id = ? ORDER BY updated_at DESC, id DESC');
        $q->execute([$userId]);
        return $q->fetchAll() ?: [];
    }
    public function get(int $id, int $userId): ?array
    {
        $q = $this->db->prepare('SELECT * FROM cover_letters WHERE id = ? AND user_id = ?');
        $q->execute([$id, $userId]);
        return $q->fetch() ?: null;
    }
    public static function clean(array $data): array
    {
        $date=$data['letter_date']??gmdate('Y-m-d');
        $parsed=is_string($date)?\DateTimeImmutable::createFromFormat('!Y-m-d',$date):false;
        if(!$parsed||$parsed->format('Y-m-d')!==$date||$date<'1000-01-01')throw new \DomainException('Choose a valid letter date.');
        return [
            'company'=>Sanitizer::cleanText($data['company'] ?? '', false, 200),
            'role'=>Sanitizer::cleanText($data['role'] ?? '', false, 200),
            'recipient'=>Sanitizer::cleanText($data['recipient'] ?? '', false, 200),
            'company_details'=>Sanitizer::cleanText($data['company_details'] ?? '', true, 5000),
            'job_description'=>Sanitizer::cleanText($data['job_description'] ?? '', true, 8000),
            'body'=>self::cleanBody($data['body'] ?? ''),
            'recipient_address'=>Sanitizer::cleanText($data['recipient_address']??'',true,1000),
            'letter_date'=>$date,
        ];
    }
    public static function cleanBody(mixed $value): string
    {
        $text=is_scalar($value)?str_replace(["\r\n","\r"],"\n",(string)$value):'';
        $paragraphs=preg_split('/\n[\h]*\n+/u',mb_substr($text,0,18000))?:[];
        return mb_substr(implode("\n\n",array_filter(array_map(static fn(string $p):string=>Sanitizer::cleanText($p,false,16000),$paragraphs))),0,16000);
    }
    public function save(?int $id, int $userId, int $resumeId, array $data): int
    {
        return DocumentWriteGuard::run($this->db,$userId,function() use($id,$userId,$resumeId,$data):int {
        if ($id !== null) (new RecoveryService($this->db))->snapshot($userId, 'Before cover letter update', null, true);
        $values = array_values(self::clean($data));
        if ($id !== null) {
            $q = $this->db->prepare('UPDATE cover_letters SET company=?, role=?, recipient=?, company_details=?, job_description=?, body=?, recipient_address=?, letter_date=?, updated_at=NOW() WHERE id=? AND user_id=?');
            $q->execute([...$values, $id, $userId]);
            return $id;
        }
        $q = $this->db->prepare('INSERT INTO cover_letters (company, role, recipient, company_details, job_description, body, recipient_address, letter_date, user_id, resume_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $q->execute([...$values, $userId, $resumeId]);
        return (int) $this->db->lastInsertId();
        });
    }
    public function delete(int $id, int $userId): void
    {
        DocumentWriteGuard::run($this->db,$userId,function() use($id,$userId):void {
        (new RecoveryService($this->db))->snapshot($userId, 'Before cover letter deletion');
        $q = $this->db->prepare('DELETE FROM cover_letters WHERE id=? AND user_id=?');
        $q->execute([$id, $userId]);
        });
    }
}
