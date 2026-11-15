<?php
declare(strict_types=1);
namespace ReGen;
use PDO;

final class FeaturePolicy
{
    public const FEATURES = [
        'registration'=>'User registration', 'google_login'=>'Google sign-in', 'resume_create'=>'Resume creation',
        'resume_editor'=>'Resume editing', 'templates'=>'Template gallery', 'cover_letters'=>'Cover letters',
        'ai_assist'=>'AI guided assistance', 'ai_refine'=>'AI writing refinement', 'ai_review'=>'AI resume review',
        'ai_cover_letter'=>'AI cover letter writing', 'pdf_download'=>'PDF downloads', 'document_preview'=>'Document previews',
        'photo_upload'=>'Portrait uploads', 'profile_edit'=>'Profile changes', 'profile_email'=>'Email changes',
        'self_delete'=>'Account deletion', 'support'=>'Support tickets',
        'profile_password'=>'Password changes', 'session_controls'=>'User device controls', 'resume_rename'=>'Resume renaming', 'document_settings'=>'Document appearance settings',
        'feedback'=>'User Feedback',
    ];
    private ?array $cache = null;
    public function __construct(private readonly PDO $db) {}
    public function all(): array
    {
        if ($this->cache !== null) return $this->cache;
        $rows = $this->db->query('SELECT * FROM feature_controls')->fetchAll(PDO::FETCH_UNIQUE);
        $legacy=(new AdminRepository($this->db))->settings();
        $result = [];
        foreach (self::FEATURES as $key=>$name) {
            $row = $rows[$key] ?? [];
            $start = $row['downtime_start'] ?? null; $end = $row['downtime_end'] ?? null;
            $scheduled = $start !== null && strtotime($start.' UTC') <= time() && ($end === null || strtotime($end.' UTC') > time());
            $result[$key] = ['key'=>$key, 'name'=>$name, 'enabled'=>(bool) ($row['enabled'] ?? true), 'visible'=>(bool) ($row['visible'] ?? true), 'message'=>$row['message'] ?? '', 'downtimeStart'=>$start, 'downtimeEnd'=>$end, 'version'=>(int) ($row['version'] ?? 0)];
            $policyAllowed=match($key) { 'registration'=>$legacy['registrationEnabled'], 'google_login'=>$legacy['googleLoginEnabled'], 'profile_email'=>$legacy['profileEmailChangeEnabled'], 'self_delete'=>$legacy['userSelfDeleteEnabled'], 'feedback'=>(new FeedbackRepository($this->db))->policy()['enabled'], default=>!str_starts_with($key,'ai_') || $legacy['aiEnabled'] };
            $result[$key]['policyBlocked']=!$policyAllowed;
            $result[$key]['available'] = $result[$key]['enabled'] && $result[$key]['visible'] && !$scheduled && $policyAllowed;
        }
        return $this->cache = $result;
    }
    public function save(string $key, array $data, int $adminId): void
    {
        if (!isset(self::FEATURES[$key])) throw new \DomainException('Unknown feature.');
        foreach (['enabled','visible'] as $field) if (!is_bool($data[$field] ?? null)) throw new \DomainException('Choose enabled and visible states.');
        $dates = [];
        foreach (['downtimeStart','downtimeEnd'] as $field) {
            $value = $data[$field] ?? null;
            if ($value === null || $value === '') { $dates[] = null; continue; }
            if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/D', $value) || strtotime($value) === false) throw new \DomainException('Downtime must use valid UTC dates.');
            $canonical=preg_replace('/\.\d{3}Z$/','Z',$value);
            if(strlen($canonical)===17)$canonical=substr($canonical,0,-1).':00Z';
            if((int)substr($value,0,4)<1000 || gmdate('Y-m-d\TH:i:s\Z',strtotime($value))!==$canonical)throw new \DomainException('Downtime must use valid calendar dates.');
            $dates[] = gmdate('Y-m-d H:i:s', strtotime($value));
        }
        if (($dates[1] !== null && $dates[0] === null) || ($dates[0] !== null && $dates[1] !== null && $dates[1] <= $dates[0])) throw new \DomainException('Downtime must end after it starts.');
        $this->db->beginTransaction();
        try {
            $q = $this->db->prepare('INSERT IGNORE INTO feature_controls (feature_key, version) VALUES (?, 0)'); $q->execute([$key]);
            $q = $this->db->prepare('UPDATE feature_controls SET enabled=?, visible=?, message=?, downtime_start=?, downtime_end=?, version=version+1, updated_by=?, updated_at=UTC_TIMESTAMP() WHERE feature_key=? AND version=?');
            $q->execute([(int)$data['enabled'], (int)$data['visible'], Sanitizer::cleanText($data['message'] ?? '', false, 300), ...$dates, $adminId, $key, (int)($data['version'] ?? -1)]);
            if ($q->rowCount() !== 1) throw new ConcurrentUpdate('This feature changed in another session. Refresh before saving.');
            $this->db->commit(); $this->cache = null;
        } catch (\Throwable $e) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $e; }
    }
    public static function forRoute(string $path, string $method): array
    {
        if ($path==='/api/feedback' || $path==='/feedback') return ['feedback'];
        if ($path === '/api/auth/register' || $path === '/register') return ['registration'];
        if (in_array($path, ['/api/auth/google','/api/auth/google/config'], true)) return ['google_login'];
        if (str_starts_with($path, '/api/support') || $path === '/support') return ['support'];
        if (str_starts_with($path, '/api/cover-letters') || $path === '/cover-letters') {
            return ['cover_letters', ...(str_ends_with($path, '/ai-suggest') ? ['ai_cover_letter'] : []), ...(str_ends_with($path, '/pdf') ? ['pdf_download'] : []), ...(str_ends_with($path, '/preview')||str_ends_with($path, '/document') ? ['document_preview'] : [])];
        }
        if (str_ends_with($path, '/ai-assist')) return ['ai_assist'];
        if (str_ends_with($path, '/ai-suggest')) return ['ai_refine'];
        if (str_ends_with($path, '/ats-review') && $method === 'POST') return ['ai_review'];
        if (str_starts_with($path, '/api/templates') || $path === '/templates') return ['templates'];
        if (preg_match('#^/api/pdf/\d+/generate$#', $path)) return ['pdf_download'];
        if (str_starts_with($path, '/api/pdf/')) return ['document_preview'];
        if (preg_match('#^/api/resume/\d+/photo$#', $path) && $method === 'POST') return ['resume_editor','photo_upload'];
        if (preg_match('#^/api/resume/\d+/(section|photo)$#', $path) && $method !== 'GET') return ['resume_editor'];
        if ($path === '/api/dashboard' && $method === 'POST') return ['resume_create'];
        if (preg_match('#^/api/dashboard/\d+/title$#', $path) && $method === 'PATCH') return ['resume_rename'];
        if ($path === '/builder') return ['resume_editor'];
        if ($path === '/api/profile' && $method === 'PATCH') return ['profile_edit'];
        if ($path === '/api/profile/email' && $method === 'PUT') return ['profile_email'];
        if ($path === '/api/profile/password' && $method === 'PUT') return ['profile_password'];
        if (str_starts_with($path, '/api/profile/sessions') && $method !== 'GET') return ['session_controls'];
        if ($path === '/api/profile/account' && $method === 'DELETE') return ['self_delete'];
        return [];
    }
}
