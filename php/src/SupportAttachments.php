<?php
declare(strict_types=1);
namespace ReGen;

use PDO;
/** File content is private; neither filenames nor paths supplied by a client are trusted. */
final class SupportAttachments
{
    public const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
    public function __construct(private readonly PDO $db, private readonly ?string $storageDirectory = null)
    {
    }

    private function directory(): string
    {
        return $this->storageDirectory ?? Storage::directory('support-attachments');
    }

    public function stage(array $files): array
    {
        if (!$files || !isset($files['name'])) return [];
        if (!is_array($files['name'])) throw new \DomainException('Choose attachments using the file picker.');
        $limits = (new SupportConfiguration($this->db))->attachmentLimits();
        $items = [];
        $total = 0;
        foreach ($files['name'] as $index => $name) {
            $error = $files['error'][$index] ?? UPLOAD_ERR_NO_FILE;
            if ($error === UPLOAD_ERR_NO_FILE) continue;
            if ($error !== UPLOAD_ERR_OK) throw new \DomainException('One of the attachments could not be uploaded. Check the file size and try again.');
            $path = $files['tmp_name'][$index] ?? '';
            if (!is_string($path) || !is_uploaded_file($path)) throw new \DomainException('Invalid attachment upload.');
            $item = $this->inspect($path, (string) $name, $limits['effectiveMaxFileBytes']);
            $total += $item['size'];
            if (count($items) >= $limits['maxFiles'] || $total > $limits['effectiveMaxTotalBytes']) throw new \DomainException('Use up to ' . $limits['maxFiles'] . ' files and stay within the total attachment size limit.');
            $items[] = $item;
        }
        $staged = [];
        $processedTotal = 0;
        try {
            foreach ($items as $item) {
                $key = bin2hex(random_bytes(32));
                $destination = $this->directory() . '/' . $key;
                if (str_starts_with($item['mime'], 'image/')) {
                    $image = @imagecreatefromstring((string)file_get_contents($item['path']));
                    if (!$image) throw new \DomainException('This image cannot be opened. Save a new copy and try again.');
                    try {
                        $ok = match ($item['mime']) {
                            'image/jpeg' => imagejpeg($image, $destination, 88), 'image/png' => imagepng($image, $destination, 7), default => imagewebp($image, $destination, 88)
                        };
                    } finally {
                        imagedestroy($image);
                    }
                    if (!$ok) {
                        @unlink($destination);
                        throw new \RuntimeException('The image could not be saved.');
                    }
                } elseif (!move_uploaded_file($item['path'], $destination)) throw new \RuntimeException('The attachment could not be saved.');
                @chmod($destination, 0600);
                $size = (int)filesize($destination);
                $staged[] = ['key' => $key, 'filename' => $item['filename'], 'mime' => $item['mime'], 'size' => $size];
                $processedTotal += $size;
                if ($size > $limits['effectiveMaxFileBytes'] || $processedTotal > $limits['effectiveMaxTotalBytes']) throw new \DomainException('The processed image exceeds the file size limit. Choose a smaller image.');
            }
            return $staged;
        } catch (\Throwable $error) {
            $this->discard($staged);
            throw $error;
        }
    }

    public function inspect(string $path, string $name, int $limit): array
    {
        $size = is_file($path)?(int)filesize($path): 0;
        if ($size < 1 || $size > $limit) throw new \DomainException('Choose non-empty files within the displayed size limit.');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (!isset(self::TYPES[$mime])) throw new \DomainException('Supported attachments are JPG, PNG, WebP images and PDF documents.');
        $extension = strtolower(pathinfo(str_replace('\\', '/', $name), PATHINFO_EXTENSION));
        if (!in_array($extension, $mime === 'image/jpeg'?['jpg', 'jpeg']: [self::TYPES[$mime]], true)) throw new \DomainException('The filename extension does not match the file content. Export a new copy and try again.');
        if (str_starts_with($mime, 'image/')) {
            $image = @getimagesize($path);
            if (!$image || $image[0] > 10000 || $image[1] > 10000 || $image[0] * $image[1] > 12000000) throw new \DomainException('Use an image smaller than 12 megapixels.');
        } elseif (file_get_contents($path, false, null, 0, 5) !== '%PDF-') throw new \DomainException('This PDF is invalid. Export a new PDF and try again.');
        $filename = Sanitizer::cleanText(basename(str_replace('\\', '/', $name)), false, 180);
        if ($filename === '') $filename = 'Attachment.' . self::TYPES[$mime];
        return ['path' => $path, 'filename' => $filename, 'mime' => $mime, 'size' => $size];
    }

    public function attach(array $items, int $ticketId, int $messageId, int $userId): void
    {
        $q = $this->db->prepare('INSERT INTO support_attachments (ticket_id,message_id,user_id,storage_key,filename,mime_type,byte_size) VALUES (?,?,?,?,?,?,?)');
        foreach ($items as $item) $q->execute([$ticketId, $messageId, $userId, $item['key'], $item['filename'], $item['mime'], $item['size']]);
    }

    public function discard(array $items): void
    {
        foreach ($items as $item)if (preg_match('/^[a-f0-9]{64}$/D', $item['key']))@unlink($this->directory() . '/' . $item['key']);
    }

    public function forMessages(array $messages, bool $admin): array
    {
        if (!$messages) return $messages;
        $q = $this->db->prepare('SELECT id,ticket_id,message_id,filename,mime_type,byte_size FROM support_attachments WHERE message_id IN (' . implode(',', array_fill(0, count($messages), '?')) . ') ORDER BY id');
        $q->execute(array_column($messages, 'id'));
        $files = [];
        foreach ($q->fetchAll() as $item) {
            $item['url'] = '/api/' . ($admin?'admin': 'support') . '/tickets/' . $item['ticket_id'] . '/attachments/' . $item['id'];
            unset($item['ticket_id']);
            $files[$item['message_id']][] = $item;
        }
        foreach ($messages as &$message) $message['attachments'] = $files[$message['id']] ?? [];
        return $messages;
    }

    public function serve(int $ticketId, int $id, ?int $userId): never
    {
        $q = $this->db->prepare('SELECT a.* FROM support_attachments a JOIN support_messages m ON m.id=a.message_id JOIN support_tickets t ON t.id=a.ticket_id WHERE a.id=? AND a.ticket_id=?' . ($userId !== null?' AND t.user_id=? AND m.internal_note=0': ''));
        $q->execute($userId === null?[$id, $ticketId]: [$id, $ticketId, $userId]);
        $file = $q->fetch();
        if (!$file || !preg_match('/^[a-f0-9]{64}$/D', $file['storage_key']))Http::json(['success' => false, 'message' => 'Attachment not found.'], 404);
        $path = $this->directory() . '/' . $file['storage_key'];
        if (!is_file($path))Http::json(['success' => false, 'message' => 'Attachment is unavailable. Contact support.'], 404);
        (new AuditLogger($this->db))->log('support.attachment_viewed', 'ticket', $ticketId, ['attachmentId' => $id], $userId === null?'admin': 'user', $userId ?? Session::adminId());
        if (session_status() === PHP_SESSION_ACTIVE)session_write_close();
        header('Cache-Control: no-store');
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: ' . (str_starts_with($file['mime_type'], 'image/')?'inline': 'attachment') . '; filename="attachment-' . $id . '.' . self::TYPES[$file['mime_type']] . '"');
        readfile($path);
        exit;
    }

    public function prune(): int
    {
        // Run outside web requests, at most once a day. A lock also excludes overlapping cron jobs.
        $guard = fopen($this->directory() . '/.cleanup-state', 'c+');
        if (!$guard) throw new \RuntimeException('Attachment cleanup state is not writable.');
        try {
            if (!flock($guard, LOCK_EX|LOCK_NB)) return 0;
            if ((int)stream_get_contents($guard) > time()-86400) return 0;
            $count = 0;
            $batch = [];
            foreach (new \DirectoryIterator($this->directory()) as $file) {
                if ($file->isLink() || !$file->isFile() || !preg_match('/^[a-f0-9]{64}$/D', $file->getFilename()) || $file->getMTime() > time()-86400) continue;
                $batch[$file->getFilename()] = $file->getPathname();
                if (count($batch) === 100) {
                    $count += $this->pruneBatch($batch);
                    $batch = [];
                }
                if ($count >= 1000)break;
            }
            if ($batch) $count += $this->pruneBatch($batch);
            rewind($guard);
            ftruncate($guard, 0);
            fwrite($guard, (string)time());
            fflush($guard);
            return $count;
        } finally {
            flock($guard, LOCK_UN);
            fclose($guard);
        }
    }

    private function pruneBatch(array $files): int
    {
        $marks = implode(',', array_fill(0, count($files), '?'));
        $query = $this->db->prepare('SELECT storage_key FROM support_attachments WHERE storage_key IN (' . $marks . ')');
        $query->execute(array_keys($files));
        foreach ($query->fetchAll(PDO::FETCH_COLUMN) as $key)unset($files[$key]);
        $removed = 0;
        foreach ($files as $path)if (@unlink($path)) $removed++;
        return $removed;
    }
}
