<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class FeedbackRepository
{
    public const AREAS = ['overall', 'resume', 'ai', 'templates', 'downloads', 'cover_letters', 'account', 'support'];
    public const STATUSES = ['new', 'reviewed', 'planned', 'resolved'];

    public function __construct(private readonly PDO $db) {}

    public function policy(): array
    {
        $query = $this->db->query("SELECT payload FROM operations_settings WHERE setting_key = 'feedback_policy'");
        return array_replace(['enabled' => true, 'downloadPrompt' => true, 'reward' => 5, 'rewardLimit' => 1], json_decode((string)($query->fetchColumn() ?: '{}'), true) ?: []);
    }

    public function savePolicy(array $body, int $adminId): void
    {
        $reward = filter_var($body['reward'] ?? null, FILTER_VALIDATE_INT);
        $limit = filter_var($body['rewardLimit'] ?? $this->policy()['rewardLimit'], FILTER_VALIDATE_INT);
        if (!is_bool($body['enabled'] ?? null) || !is_bool($body['downloadPrompt'] ?? null) || $reward === false || $reward < 0 || $reward > 1000 || $limit===false || $limit<0 || $limit>100) {
            throw new \DomainException('Choose availability, a reward from 0 to 1,000 tokens and a reward limit from 0 to 100 responses per account.');
        }
        $policy = ['enabled' => $body['enabled'], 'downloadPrompt' => $body['downloadPrompt'], 'reward' => $reward, 'rewardLimit' => $limit];
        $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('feedback_policy',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()")
            ->execute([json_encode($policy, JSON_THROW_ON_ERROR), $adminId]);
    }

    public function eligibility(int $userId): array
    {
        $query = $this->db->prepare('SELECT COUNT(*) FROM feedback_rewards WHERE user_id = ?');
        $query->execute([$userId]);
        $count=(int)$query->fetchColumn();$policy=$this->policy();
        $last=$this->db->prepare('SELECT MAX(created_at) FROM user_feedback WHERE user_id=?');$last->execute([$userId]);
        return ['policy' => $policy, 'rewardEligible' => $count<(int)$policy['rewardLimit'], 'rewardsReceived'=>$count, 'rewardsRemaining'=>max(0,(int)$policy['rewardLimit']-$count), 'lastFeedbackAt'=>$last->fetchColumn()?:null, 'bonus' => (new BonusCreditService($this->db))->balance($userId)];
    }

    public function submit(int $userId, array $body): array
    {
        $policy = $this->policy();
        if (!$policy['enabled']) throw new \DomainException('Feedback is temporarily unavailable. You can still contact support.');
        $ratings = [];
        foreach (['rating', 'functionalityRating', 'easeRating'] as $key) {
            $value = $body[$key] ?? null;
            if ($key !== 'rating' && ($value === null || $value === '')) { $ratings[$key] = null; continue; }
            $value = filter_var($value, FILTER_VALIDATE_INT);
            if ($value === false || $value < 1 || $value > 5) throw new \DomainException('Choose a rating between one and five stars.');
            $ratings[$key] = $value;
        }
        $comment = Sanitizer::cleanText($body['comment'] ?? '', true, 5000);
        $area = (string)($body['area'] ?? 'overall');
        $source = (string)($body['source'] ?? 'general');
        $key = (string)($body['submissionKey'] ?? '');
        if (mb_strlen($comment) < 10 || !in_array($area, self::AREAS, true) || !in_array($source, ['general', 'resume_download'], true)
            || !preg_match('/^[a-f0-9-]{36}$/D', $key)) throw new \DomainException('Choose an area and share at least 10 characters about what worked or could improve.');
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE');
            $query->execute([$userId]);
            if (!$query->fetchColumn()) throw new \DomainException('Your account could not be found.');
            $query = $this->db->prepare('SELECT id FROM user_feedback WHERE user_id = ? AND submission_key = ?');
            $query->execute([$userId, $key]);
            if ($id = $query->fetchColumn()) {
                $this->db->commit();
                return ['id' => (int)$id, 'rewardGranted' => 0, 'duplicate' => true, 'bonus' => (new BonusCreditService($this->db))->balance($userId)];
            }
            $this->db->prepare('INSERT INTO user_feedback (user_id,rating,functionality_rating,ease_rating,area,source,comment,submission_key) VALUES (?,?,?,?,?,?,?,?)')
                ->execute([$userId, $ratings['rating'], $ratings['functionalityRating'], $ratings['easeRating'], $area, $source, $comment, $key]);
            $id = (int)$this->db->lastInsertId();
            $query = $this->db->prepare('SELECT COUNT(*) FROM feedback_rewards WHERE user_id=?');$query->execute([$userId]);$rewardCount=(int)$query->fetchColumn();
            $reward = 0;
            if ($rewardCount < (int)$policy['rewardLimit']) {
                $this->db->prepare('INSERT INTO feedback_rewards (user_id,feedback_id,amount) VALUES (?,?,?)')->execute([$userId,$id,(int)$policy['reward']]);
                $reward=(int)$policy['reward'];
                if ($reward > 0) (new BonusCreditService($this->db))->adjust($userId,$reward,'Thank you for your feedback','feedback','feedback-reward:'.$userId.':'.($rewardCount+1));
            }
            (new AuditLogger($this->db))->log('feedback.submitted', 'feedback', $id, ['rating' => $ratings['rating'], 'area' => $area, 'reward' => $reward], 'user', $userId);
            $this->db->commit();
            return ['id' => $id, 'rewardGranted' => $reward, 'duplicate' => false, 'bonus' => (new BonusCreditService($this->db))->balance($userId)];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function listing(string $status = '', int $page = 1, ?array $period = null): array
    {
        $conditions=[];$params=[];
        if(in_array($status,self::STATUSES,true)){$conditions[]='f.status=?';$params[]=$status;}
        if($period){$conditions[]='f.created_at>=? AND f.created_at<?';$params[]=$period['start'];$params[]=$period['end'];}
        $where=$conditions?' WHERE '.implode(' AND ',$conditions):'';
        $query = $this->db->prepare('SELECT COUNT(*) FROM user_feedback f'.$where);
        $query->execute($params);
        $total = (int)$query->fetchColumn();
        $query = $this->db->prepare('SELECT f.*,u.first_name,u.last_name,u.email FROM user_feedback f JOIN users u ON u.id=f.user_id'.$where.' ORDER BY f.id DESC LIMIT 25 OFFSET '.(max(0,min(10000,$page-1))*25));
        $query->execute($params);
        return ['items' => $query->fetchAll(), 'total' => $total, 'policy' => $this->policy()];
    }

    public function review(int $id, array $body, int $adminId): void
    {
        $status = (string)($body['status'] ?? '');
        if (!in_array($status, self::STATUSES, true)) throw new \DomainException('Choose a feedback review status.');
        $note=Sanitizer::cleanText($body['note']??'',true,5000);
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare('UPDATE user_feedback SET status=?,admin_note=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=?');
            $query->execute([$status,$note,$id,(int)($body['version']??0)]);
            if (!$query->rowCount()) throw new ConcurrentUpdate('This feedback was updated by someone else. Refresh before saving.');
            $this->db->prepare('INSERT INTO feedback_reviews (feedback_id,admin_id,status,note) VALUES (?,?,?,?)')->execute([$id,$adminId,$status,$note]);
            (new AuditLogger($this->db))->log('admin.feedback_reviewed','feedback',$id,['status'=>$status,'reviewId'=>(int)$this->db->lastInsertId()],'admin',$adminId);
            $this->db->commit();
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }

    public function reviews(int $id): array
    {
        $query=$this->db->prepare('SELECT id,admin_id,status,note,created_at FROM feedback_reviews WHERE feedback_id=? ORDER BY id');$query->execute([$id]);return $query->fetchAll();
    }
}
