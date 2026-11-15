<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class TemplateManagement
{
    public function __construct(private readonly PDO $db) {}

    public function catalogue(bool $includeHidden = false): array
    {
        $controls = $this->db->query('SELECT * FROM template_controls')->fetchAll(PDO::FETCH_UNIQUE | PDO::FETCH_ASSOC);
        $items = [];
        foreach (TemplateCatalog::all() as $index => $template) {
            $control = $controls[$template['id']] ?? [];
            $template['visible'] = (bool) ($control['visible'] ?? true);
            $template['popular'] = (bool) ($control['popular'] ?? false);
            $template['sortOrder'] = (int) ($control['sort_order'] ?? ($index + 1) * 10);
            $template['version'] = (int) ($control['version'] ?? 0);
            if ($includeHidden || $template['visible']) $items[] = $template;
        }
        usort($items, static fn(array $a, array $b): int => [$a['sortOrder'], $a['id']] <=> [$b['sortOrder'], $b['id']]);
        return $items;
    }

    public function selectable(mixed $id): bool
    {
        if (!TemplateCatalog::valid($id)) return false;
        $query = $this->db->prepare('SELECT visible FROM template_controls WHERE template_id=?');
        $query->execute([$id]);
        $visible = $query->fetchColumn();
        return $visible === false || (bool) $visible;
    }

    public function report(): array
    {
        $query = $this->db->query("SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.resume_data,'$.templateId')),'classic') AS template_id,COUNT(DISTINCT r.user_id) AS users
            FROM resumes r WHERE NOT EXISTS (SELECT 1 FROM resumes newer WHERE newer.user_id=r.user_id AND
            (newer.updated_at>r.updated_at OR (newer.updated_at=r.updated_at AND newer.id>r.id))) GROUP BY template_id");
        $current = $query->fetchAll(PDO::FETCH_KEY_PAIR);
        $history = $this->db->query('SELECT template_id,COUNT(DISTINCT user_id) FROM template_selection_events GROUP BY template_id')->fetchAll(PDO::FETCH_KEY_PAIR);
        $saved=$this->db->query("SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(resume_data,'$.templateId')),'classic') AS template_id,COUNT(*) AS total FROM resumes GROUP BY template_id")->fetchAll(PDO::FETCH_KEY_PAIR);
        return array_map(static fn(array $template): array => [...$template,
            'savedResumes' => (int)($saved[$template['id']]??0),
            'currentUsers' => (int) ($current[$template['id']] ?? 0),
            'recordedUsers' => (int) ($history[$template['id']] ?? 0),
        ], $this->catalogue(true));
    }

    public function requireSelectable(string $id): void
    {
        $query=$this->db->prepare('SELECT visible FROM template_controls WHERE template_id=? LOCK IN SHARE MODE');
        $query->execute([$id]);$visible=$query->fetchColumn();
        if (!TemplateCatalog::valid($id) || ($visible !== false && !(bool)$visible)) throw new \DomainException('This template is no longer available for selection. Choose another design.');
    }

    /** Actual saved records, rather than gallery previews or selection history. */
    public function usage(string $template,int $page=1,string $search=''): array
    {
        if(!TemplateCatalog::valid($template))throw new \OutOfBoundsException('Template not found.');
        $where="COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.resume_data,'$.templateId')),'classic')=?";
        $params=[$template];
        if($search!==''){$where.=' AND (u.email LIKE ? OR CONCAT(u.first_name,\' \',u.last_name) LIKE ? OR r.title LIKE ?)';$params=[...$params,...array_fill(0,3,'%'.mb_substr($search,0,120).'%')];}
        $from=' FROM resumes r JOIN users u ON u.id=r.user_id WHERE '.$where;
        $q=$this->db->prepare('SELECT COUNT(*)'.$from);$q->execute($params);$total=(int)$q->fetchColumn();
        $page=max(1,min($page,max(1,(int)ceil($total/20))));
        $q=$this->db->prepare('SELECT r.id,r.user_id,r.title,r.updated_at,u.first_name,u.last_name,u.email'.$from.' ORDER BY r.updated_at DESC,r.id DESC LIMIT 20 OFFSET '.(($page-1)*20));$q->execute($params);
        return ['items'=>$q->fetchAll(),'total'=>$total,'page'=>$page,'pages'=>max(1,(int)ceil($total/20))];
    }

    public function savedResume(string $template,int $resumeId): array
    {
        if(!TemplateCatalog::valid($template))throw new \OutOfBoundsException('Template not found.');
        $q=$this->db->prepare("SELECT r.id,r.user_id,r.resume_data FROM resumes r JOIN users u ON u.id=r.user_id WHERE r.id=? AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.resume_data,'$.templateId')),'classic')=?");
        $q->execute([$resumeId,$template]);$row=$q->fetch();
        if(!$row)throw new \OutOfBoundsException('Saved resume not found for this template.');
        return ['id'=>(int)$row['id'],'userId'=>(int)$row['user_id'],'data'=>json_decode($row['resume_data'],true,512,JSON_THROW_ON_ERROR)];
    }

    public function update(string $id, array $body, int $adminId): void
    {
        $order = filter_var($body['sortOrder'] ?? null, FILTER_VALIDATE_INT);
        if (!TemplateCatalog::valid($id) || !is_bool($body['visible'] ?? null) || !is_bool($body['popular'] ?? null)
            || $order === false || $order < 0 || $order > 1000) {
            throw new \DomainException('Choose visibility, a Popular badge and a display order from 0 to 1,000.');
        }
        $this->db->beginTransaction();
        try {
            // Lock the catalogue together so simultaneous edits cannot hide every choice.
            $rows = $this->db->query('SELECT * FROM template_controls ORDER BY template_id FOR UPDATE')->fetchAll(PDO::FETCH_UNIQUE | PDO::FETCH_ASSOC);
            $before = $rows[$id] ?? ['version' => 0, 'visible' => 1, 'popular' => 0, 'sort_order' => 0];
            if ((int) $before['version'] !== (int) ($body['version'] ?? -1)) throw new ConcurrentUpdate('This template was changed in another session. Refresh before saving.');
            if (!$body['visible']) {
                $otherVisible = array_filter(TemplateCatalog::all(), static fn(array $template): bool => $template['id'] !== $id && (bool) ($rows[$template['id']]['visible'] ?? true));
                if (!$otherVisible) throw new \DomainException('Keep at least one template visible so customers can create a resume.');
            }
            $query = $this->db->prepare('INSERT INTO template_controls (template_id,visible,popular,sort_order,version,updated_by) VALUES (?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE visible=VALUES(visible),popular=VALUES(popular),sort_order=VALUES(sort_order),version=VALUES(version),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()');
            $query->execute([$id, (int) $body['visible'], (int) $body['popular'], $order, (int) $before['version'] + 1, $adminId]);
            (new AuditLogger($this->db))->log('admin.template_updated', 'template', $id, ['before' => $before,
                'after' => ['visible' => $body['visible'], 'popular' => $body['popular'], 'sortOrder' => $order]], 'admin', $adminId);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function recordSelection(int $userId, string $id): void
    {
        $this->db->prepare('INSERT INTO template_selection_events (template_id,user_id) VALUES (?,?)')->execute([$id, $userId]);
        (new RealtimeEvents($this->db))->publish('templates','admin');
    }
}
