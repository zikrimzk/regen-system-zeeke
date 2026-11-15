<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class SupportConfiguration
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function get(): array
    {
        $query = $this->db->query("SELECT payload FROM operations_settings WHERE setting_key='support_configuration'");
        return array_replace(['responseHours' => 24, 'message' => 'Tell us what happened and include any error message. Our team will follow up here.', 'replies' => []], json_decode((string)($query->fetchColumn()?: '{}'), true)?: []);
    }

    public function save(array $body, int $adminId): void
    {
        $hours = filter_var($body['responseHours'] ?? null, FILTER_VALIDATE_INT);
        $message = Sanitizer::cleanText($body['message'] ?? '', true, 500);
        if ($hours === false || $hours < 1 || $hours > 720 || $message === '' || !is_array($body['replies'] ?? null) || count($body['replies']) > 20) throw new \DomainException('Choose a response target from 1 to 720 hours, a welcome message and up to 20 saved replies.');
        $replies = [];
        foreach ($body['replies'] as $reply) {
            $title = Sanitizer::cleanText($reply['title'] ?? '', false, 100);
            $text = Sanitizer::cleanText($reply['body'] ?? '', true, 3000);
            if ($title === '' || $text === '') throw new \DomainException('Each saved reply needs a title and message.');
            $replies[] = ['title' => $title, 'body' => $text];
        }
        $data = ['responseHours' => $hours, 'message' => $message, 'replies' => $replies];
        $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('support_configuration',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()") ->execute([json_encode($data, JSON_THROW_ON_ERROR), $adminId]);
        (new AuditLogger($this->db))->log('admin.support_configuration_updated', 'settings', 'support', ['responseHours' => $hours, 'savedReplyCount' => count($replies)], 'admin', $adminId);
    }

    public function attachmentLimits(): array
    {
        $row = $this->db->query("SELECT payload FROM operations_settings WHERE setting_key='support_attachments'")->fetchColumn();
        $saved = json_decode((string)($row?: '{}'), true)?: [];
        $limits = array_replace(['maxFiles' => 4, 'maxFileBytes' => 5 * 1024 * 1024, 'maxTotalBytes' => 20 * 1024 * 1024], $saved);
        $bytes = static function(string $name): int {
            $value = trim((string)ini_get($name));
            if ((float) $value <= 0) return PHP_INT_MAX;
            return (int)((float) $value * (match (strtolower(substr($value, -1))) {
                'g' => 1073741824, 'm' => 1048576, 'k' => 1024, default => 1
            }));
        };
        $limits['configuredMaxFiles'] = $limits['maxFiles'];
        $limits['maxFiles'] = min($limits['maxFiles'], max(0, (int)ini_get('max_file_uploads')));
        $limits['effectiveMaxFileBytes'] = min($limits['maxFileBytes'], $bytes('upload_max_filesize'));
        $limits['effectiveMaxTotalBytes'] = max(0, min($limits['maxTotalBytes'], $bytes('post_max_size')-65536));
        return $limits;
    }

    public function saveAttachmentLimits(array $body, int $adminId): void
    {
        $count = filter_var($body['maxFiles'] ?? null, FILTER_VALIDATE_INT);
        $file = filter_var($body['maxFileBytes'] ?? null, FILTER_VALIDATE_INT);
        $total = filter_var($body['maxTotalBytes'] ?? null, FILTER_VALIDATE_INT);
        if ($count === false || $count < 0 || $count > 12 || $file === false || $file < 1048576 || $file > 8388608 || $total === false || $total < $file || $total > 31457280) throw new \DomainException('Choose 0–12 files, 1–8 MB per file, and a total limit up to 30 MB.');
        $data = ['maxFiles' => $count, 'maxFileBytes' => $file, 'maxTotalBytes' => $total];
        $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('support_attachments',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()")->execute([json_encode($data, JSON_THROW_ON_ERROR), $adminId]);
        (new AuditLogger($this->db))->log('admin.support_upload_limits_updated', 'settings', 'support', $data, 'admin', $adminId);
    }
}
