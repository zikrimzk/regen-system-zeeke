<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use Throwable;

final class ResumeRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @param array<string, mixed> $user
     *  @return array<string, mixed>
     */
    public function getOrCreatePrimary(int $userId, array $user, string $title, string $templateId = 'classic'): array
    {
        $lockName = 'resume-single:' . $userId;
        $lock = $this->db->prepare('SELECT GET_LOCK(?, 5)');
        $lock->execute([$lockName]);
        if ((int) $lock->fetchColumn() !== 1) {
            $existing = $this->getPrimaryByUser($userId);
            if ($existing !== null) {
                return $this->primaryPayload($existing, true);
            }
            throw new \RuntimeException('Could not reserve resume creation lock.');
        }

        try {
            $existing = $this->getPrimaryByUser($userId);
            if ($existing !== null) {
                return $this->primaryPayload($existing, true);
            }
            return DocumentWriteGuard::run($this->db, $userId, fn(): array => $this->create($userId, $user, $title, $templateId));
        } finally {
            try {
                $release = $this->db->prepare('SELECT RELEASE_LOCK(?)');
                $release->execute([$lockName]);
            } catch (Throwable) {
            }
        }
    }

    /** @return list<array<string, mixed>> */
    public function getSummariesByUser(int $userId): array
    {
        $statement = $this->db->prepare(
            "SELECT id, title, created_at, updated_at,
                    JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.fullName')) AS full_name,
                    JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.jobTitle')) AS job_title
             FROM resumes
             WHERE user_id = ?
             ORDER BY updated_at DESC, id DESC
             LIMIT 1"
        );
        $statement->execute([$userId]);
        return $statement->fetchAll() ?: [];
    }

    /** @return array<string, mixed>|null */
    public function getPrimaryByUser(int $userId): ?array
    {
        $statement = $this->db->prepare(
            'SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1'
        );
        $statement->execute([$userId]);
        return $this->decodeRow($statement->fetch());
    }

    public function primaryDesign(int $userId): ?array
    {
        $query = $this->db->prepare("SELECT id,JSON_UNQUOTE(JSON_EXTRACT(resume_data,'$.templateId')) AS template_id
            FROM resumes WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 1");
        $query->execute([$userId]);
        return $query->fetch() ?: null;
    }

    /** The account avatar follows the uploaded portrait, independently of template visibility. */
    public function accountPhoto(int $userId): string
    {
        $statement = $this->db->prepare(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(resume_data, '$.personal.photoBase64'))
             FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1"
        );
        $statement->execute([$userId]);
        $photo = $statement->fetchColumn();
        return is_string($photo) && strlen($photo) <= 2200000
            && preg_match('#^data:image/(?:png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$#D', $photo)
            ? $photo : '';
    }

    /** @return array<string, mixed>|null */
    public function getById(int $resumeId, int $userId): ?array
    {
        $statement = $this->db->prepare(
            'SELECT * FROM resumes
             WHERE id = ? AND user_id = ?
               AND id = (
                 SELECT active.primary_id FROM (
                   SELECT id AS primary_id FROM resumes
                   WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1
                 ) AS active
               )
             LIMIT 1'
        );
        $statement->execute([$resumeId, $userId, $userId]);
        return $this->decodeRow($statement->fetch());
    }

    public function saveSection(int $resumeId, int $userId, string $section, mixed $data): bool
    {
        return DocumentWriteGuard::run($this->db, $userId, function () use ($resumeId,$userId,$section,$data): bool {
        $previous = $section === 'templateId' ? $this->getById($resumeId,$userId) : null;
        if ($section === 'templateId') {
            if($previous===null)return false;
            (new TemplateManagement($this->db))->requireSelectable((string)$data);
            (new TemplateAccess($this->db))->apply($userId,(string)$data,$previous['resume_data']['templateId']??'classic');
        }
        (new RecoveryService($this->db))->snapshot($userId, 'Automatic document history', null, true);
        // WRITE RELATED PREFERENCES TOGETHER SO A FAILURE CANNOT LEAVE HALF-APPLIED SETTINGS.
        $settings = $section === 'documentSettings';
        $expression = $settings
            ? "JSON_SET(resume_data, '$.sectionOrder', JSON_EXTRACT(?, '$'), '$.appearance', JSON_EXTRACT(?, '$'), '$.writing', JSON_EXTRACT(?, '$'))"
            : "JSON_SET(resume_data, ?, JSON_EXTRACT(?, '$'))";
        $values = $settings
            ? [self::encode($data['sectionOrder']), self::encode($data['appearance']), self::encode($data['writing'])]
            : ['$.' . $section, self::encode($data)];
        $statement = $this->db->prepare(
            'UPDATE resumes
             SET resume_data = ' . $expression . ', updated_at = NOW()
             WHERE id = ? AND user_id = ?
               AND id = (
                 SELECT active.primary_id FROM (
                   SELECT id AS primary_id FROM resumes
                   WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1
                 ) AS active
               )'
        );
        $statement->execute([
            ...$values,
            $resumeId,
            $userId,
            $userId,
        ]);
        if ($section === 'templateId' && $previous !== null && ($previous['resume_data']['templateId'] ?? 'classic') !== $data) {
            (new TemplateManagement($this->db))->recordSelection($userId,(string)$data);
            (new AuditLogger($this->db))->log('user.template_selected','template',(string)$data,[],'user',$userId);
        }
        return $statement->rowCount() > 0 || $this->getById($resumeId, $userId) !== null;
        });
    }

    /** @param array<string, mixed> $data */
    public function savePersonal(int $resumeId, int $userId, array $data): bool
    {
        $existing = $this->getById($resumeId, $userId);
        if ($existing === null) {
            return false;
        }
        $personal = is_array($existing['resume_data']['personal'] ?? null)
            ? $existing['resume_data']['personal']
            : [];
        $merged = array_replace($personal, $data);
        return $this->saveSection($resumeId, $userId, 'personal', $merged);
    }

    public function updatePhoto(int $resumeId, int $userId, string $photoBase64): bool
    {
        $existing = $this->getById($resumeId, $userId);
        if ($existing === null) {
            return false;
        }
        $personal = is_array($existing['resume_data']['personal'] ?? null)
            ? $existing['resume_data']['personal']
            : [];
        $personal['photoPath'] = '';
        $personal['photoBase64'] = $photoBase64;
        return $this->saveSection($resumeId, $userId, 'personal', $personal);
    }

    public function updateTitle(int $resumeId, int $userId, string $title): bool
    {
        return DocumentWriteGuard::run($this->db,$userId,function()use($resumeId,$userId,$title):bool {
        $statement = $this->db->prepare(
            'UPDATE resumes SET title = ?, updated_at = NOW()
             WHERE id = ? AND user_id = ?
               AND id = (
                 SELECT active.primary_id FROM (
                   SELECT id AS primary_id FROM resumes
                   WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1
                 ) AS active
               )'
        );
        $statement->execute([$title, $resumeId, $userId, $userId]);
        if($statement->rowCount())(new RealtimeEvents($this->db))->publish('templates','admin');
        return $statement->rowCount() > 0;
        });
    }

    /** @param array<string, mixed> $review */
    public function saveAtsReview(int $resumeId, int $userId, array $review): bool
    {
        $statement = $this->db->prepare(
            'UPDATE resumes
             SET resume_data = JSON_SET(resume_data, \'$._regenReview\', JSON_EXTRACT(?, \'$\'))
             WHERE id = ? AND user_id = ?
               AND id = (
                 SELECT active.primary_id FROM (
                   SELECT id AS primary_id FROM resumes
                   WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1
                 ) AS active
               )'
        );
        $statement->execute([
            self::encode($review),
            $resumeId,
            $userId,
            $userId,
        ]);
        return $statement->rowCount() > 0;
    }

    /** @param array<string, mixed> $user
     *  @return array<string, mixed>
     */
    private function create(int $userId, array $user, string $title, string $templateId): array
    {
        (new TemplateManagement($this->db))->requireSelectable($templateId);
        (new TemplateAccess($this->db))->apply($userId,$templateId,null);
        $address = (string) ($user['address'] ?? '');
        $location = self::seedLocation($address);
        $resumeData = [
            'templateId' => TemplateCatalog::get($templateId)['id'],
            'sectionOrder' => TemplateCatalog::get($templateId)['recommendedOrder'],
            'writing' => ResumeWriting::settings(['dateOrder'=>'newest']),
            'additional' => [],
            'personal' => [
                'fullName' => trim((string) ($user['first_name'] ?? '') . ' ' . (string) ($user['last_name'] ?? '')),
                'jobTitle' => '',
                'phone' => (string) ($user['phone'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'linkedin' => '',
                'address' => $address,
                'streetAddress' => '',
                'locationCountry' => $location['country'],
                'locationState' => $location['state'],
                'locationCity' => '',
                'postcode' => $location['postcode'],
                'photoPath' => '',
                'photoBase64' => '',
            ],
            'summary' => '',
            'education' => [],
            'experience' => [],
            'projects' => [],
            'extracurricular' => [],
            'skills' => [
                'interpersonal' => '',
                'software' => '',
                'technical' => '',
                'language' => '',
                'custom' => [],
            ],
            'achievements' => [],
            'certifications' => [],
            'references' => [],
        ];
        $statement = $this->db->prepare(
            'INSERT INTO resumes (user_id, title, resume_data) VALUES (?, ?, ?)'
        );
        $statement->execute([$userId, $title, self::encode($resumeData)]);
        $resumeId = (int) $this->db->lastInsertId();
        (new TemplateManagement($this->db))->recordSelection($userId,$templateId);
        return [
            'id' => $resumeId,
            'title' => $title,
            'resumeData' => $resumeData,
        ];
    }

    /** @return array<string, string> */
    private static function seedLocation(string $address): array
    {
        $parts = array_values(array_filter(array_map('trim', explode(',', trim($address)))));
        $country = $parts !== [] ? (string) end($parts) : 'Malaysia';
        preg_match('/\b\d{5}\b/', $address, $matches);
        $postcode = $matches[0] ?? '';
        $state = '';
        if ($country === 'Malaysia' && count($parts) >= 2) {
            $state = trim((string) preg_replace('/\b\d{5}\b/', '', $parts[count($parts) - 2]));
        }
        return compact('country', 'state', 'postcode');
    }

    /** @return array<string, mixed>|null */
    private function decodeRow(mixed $row): ?array
    {
        if (!is_array($row)) {
            return null;
        }
        $data = $row['resume_data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : [];
        }
        $row['resume_data'] = is_array($data) ? $data : [];
        return $row;
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private function primaryPayload(array $row, bool $existing): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'resumeData' => $row['resume_data'],
            'existing' => $existing,
        ];
    }

    private static function encode(mixed $value): string
    {
        $json = json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );
        if (!is_string($json)) {
            throw new \RuntimeException('Resume data could not be encoded.');
        }
        return $json;
    }
}
