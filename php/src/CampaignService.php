<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/**
 * Owns announcement publication and persistent token claims.
 * Campaign/user locks and a unique request reference enforce reward limits in MySQL.
 */
final class CampaignService
{
    public const COLORS = ['emerald','blue','amber','violet','neutral'];
    public const STATUSES = ['draft','active','paused','archived'];

    public function __construct(private readonly PDO $db) {}

    public function listing(int $page = 1): array
    {
        $total = (int) $this->db->query('SELECT COUNT(*) FROM campaigns')->fetchColumn();
        $page = max(1, min($page, max(1, (int) ceil($total / 10))));
        $query = $this->db->query("SELECT c.*,
            (SELECT COUNT(DISTINCT user_id) FROM campaign_claims WHERE campaign_id=c.id) AS recipients_rewarded,
            (SELECT COUNT(*) FROM user_notifications WHERE dedupe_key LIKE CONCAT('announcement-campaign:',c.id,':%')) AS delivered_count,
            (SELECT COUNT(*) FROM campaign_receipts WHERE campaign_id=c.id AND dismissed_at IS NOT NULL) AS dismissed_count,
            (SELECT COUNT(*) FROM users WHERE account_status='active' AND (c.audience='all' OR email_verified_at IS NOT NULL)) AS eligible_count
            FROM campaigns c ORDER BY id DESC LIMIT 10 OFFSET ".(($page - 1) * 10));
        $items = $query->fetchAll();
        foreach ($items as &$item) $item['visibility'] = $this->visibility($item);
        unset($item);
        return ['items'=>$items, 'total'=>$total, 'page'=>$page, 'pageSize'=>10, 'colors'=>self::COLORS, 'serverNow'=>gmdate(DATE_ATOM)];
    }

    private function visibility(array $campaign): array
    {
        $state = $campaign['status'];
        if ($state === 'active') {
            $state = $campaign['starts_at'] && strtotime($campaign['starts_at'].' UTC') > time() ? 'scheduled'
                : ($campaign['ends_at'] && strtotime($campaign['ends_at'].' UTC') <= time() ? 'ended' : 'live');
        }
        $reason = match ($state) {
            'draft' => 'Not visible to users. Publish the draft when its details are ready.',
            'scheduled' => 'Not visible yet. The dashboard banner and inbox message become available at the scheduled start.',
            'ended' => 'The end time has passed. The banner is hidden and claims are closed; existing inbox messages remain.',
            'paused' => 'The banner and new claims are paused. Existing inbox messages remain readable.',
            'archived' => 'The banner and new claims are closed. Existing inbox messages remain readable.',
            default => 'Visible to eligible accounts. A dismissed banner stays in the user’s notification inbox.',
        };
        return ['state'=>$state, 'visible'=>$state==='live', 'reason'=>$reason];
    }

    public function save(?int $id,array $body,int $adminId): int
    {
        $data=$this->validate($body);
        $this->db->beginTransaction();
        try {
            if($id===null){
                if($data['status']!=='draft')throw new \DomainException('Save a draft before publishing the campaign.');
                $query=$this->db->prepare('INSERT INTO campaigns (title,body,color,status,audience,starts_at,ends_at,reward_enabled,reward_amount,reward_limit,total_claim_limit,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
                $query->execute([...array_values($data),$adminId]);$id=(int)$this->db->lastInsertId();$before=null;
            }else{
                $query=$this->db->prepare('SELECT * FROM campaigns WHERE id=? FOR UPDATE');$query->execute([$id]);$before=$query->fetch();
                if(!$before)throw new \OutOfBoundsException('Campaign not found.');
                if((int)$before['version']!==(int)($body['version']??-1))throw new ConcurrentUpdate('This campaign changed in another session. Reopen it before saving.');
                if($before['published_at']!==null&&$data['status']==='draft')throw new \DomainException('A published campaign can be paused or archived. Create a new draft for a separate campaign.');
                if($data['total_claim_limit']>0&&$data['total_claim_limit']<(int)$before['claim_count'])throw new \DomainException('The campaign cap cannot be lower than the claims already awarded.');
                $query=$this->db->prepare('UPDATE campaigns SET title=?,body=?,color=?,status=?,audience=?,starts_at=?,ends_at=?,reward_enabled=?,reward_amount=?,reward_limit=?,total_claim_limit=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=?');
                $query->execute([...array_values($data),$id]);
            }
            if($data['status']==='active')$this->db->prepare('UPDATE campaigns SET published_at=COALESCE(published_at,UTC_TIMESTAMP()),max_user_id=GREATEST(max_user_id,(SELECT COALESCE(MAX(id),0) FROM users)) WHERE id=?')->execute([$id]);
            (new AuditLogger($this->db))->log('admin.campaign_saved','campaign',$id,['before'=>$before,'after'=>$data],'admin',$adminId);
            $this->db->commit();return $id;
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }

    public function forUser(int $userId): array
    {
        $this->syncUser($userId);
        $query=$this->db->prepare("SELECT c.* FROM campaigns c JOIN users u ON u.id=? LEFT JOIN campaign_receipts r ON r.campaign_id=c.id AND r.user_id=u.id WHERE ".$this->activeCondition('c')." AND (c.audience='all' OR u.email_verified_at IS NOT NULL) AND r.dismissed_at IS NULL ORDER BY c.published_at DESC,c.id DESC LIMIT 4");
        $query->execute([$userId]);$rows=$query->fetchAll();
        $next=$this->db->prepare("SELECT MIN(CASE WHEN c.starts_at>UTC_TIMESTAMP() THEN c.starts_at WHEN c.ends_at>UTC_TIMESTAMP() THEN c.ends_at END) FROM campaigns c JOIN users u ON u.id=? WHERE c.status='active' AND (c.audience='all' OR u.email_verified_at IS NOT NULL)");
        $next->execute([$userId]);
        return ['items'=>array_map(fn(array $row):array=>$this->publicCampaign($row,$userId),array_slice($rows,0,3)), 'hasMore'=>count($rows)>3, 'serverNow'=>gmdate(DATE_ATOM), 'nextChangeAt'=>$next->fetchColumn() ?: null];
    }

    public function detail(int $id,int $userId): array
    {
        $received="EXISTS(SELECT 1 FROM user_notifications n WHERE n.user_id=u.id AND n.dedupe_key=CONCAT('announcement-campaign:',c.id,':',u.id))";
        // Previously delivered messages remain readable; future notices stay private even at a guessed URL.
        $query=$this->db->prepare("SELECT c.* FROM campaigns c JOIN users u ON u.id=? WHERE c.id=? AND c.published_at IS NOT NULL AND (".$this->activeCondition('c')." OR $received) AND (c.audience='all' OR u.email_verified_at IS NOT NULL OR $received)");
        $query->execute([$userId,$id]);$row=$query->fetch();
        if(!$row)throw new \OutOfBoundsException('Campaign not found.');
        return $this->publicCampaign($row,$userId);
    }

    public function dismiss(int $id,int $userId): void
    {
        $this->detail($id,$userId);
        $this->db->prepare('INSERT INTO campaign_receipts (campaign_id,user_id,dismissed_at) VALUES (?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE dismissed_at=UTC_TIMESTAMP()')->execute([$id,$userId]);
        (new AuditLogger($this->db))->log('campaign.dismissed','campaign',$id,[],'user',$userId);
    }

    /** Reserve the account first, then the campaign, to serialize both claim limits. */
    public function claim(int $id,int $userId,string $key): array
    {
        if(!preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D',$key))throw new \DomainException('A valid claim reference is required.');
        $this->db->beginTransaction();
        try {
            $query=$this->db->prepare('SELECT id,email_verified_at,account_status FROM users WHERE id=? FOR UPDATE');$query->execute([$userId]);$user=$query->fetch();
            if(!$user||$user['account_status']!=='active')throw new \OutOfBoundsException('Account not found.');
            $query=$this->db->prepare('SELECT * FROM campaigns WHERE id=? FOR UPDATE');$query->execute([$id]);$campaign=$query->fetch();
            if(!$campaign)throw new \OutOfBoundsException('Campaign not found.');
            $query=$this->db->prepare('SELECT user_id,campaign_id,amount FROM campaign_claims WHERE request_key=?');$query->execute([$key]);$existing=$query->fetch();
            if($existing){
                if((int)$existing['user_id']!==$userId||(int)$existing['campaign_id']!==$id)throw new \DomainException('This claim reference belongs to a different claim.');
                $this->db->commit();return ['duplicate'=>true,'rewardGranted'=>(int)$existing['amount'],'bonus'=>(new BonusCreditService($this->db))->balance($userId),'campaign'=>$this->detail($id,$userId)];
            }
            if(!$this->isActive($campaign)||!$campaign['reward_enabled']||($campaign['audience']==='verified'&&$user['email_verified_at']===null))throw new \DomainException('This campaign reward is not available.');
            $query=$this->db->prepare('SELECT COUNT(*) FROM campaign_claims WHERE campaign_id=? AND user_id=?');$query->execute([$id,$userId]);$received=(int)$query->fetchColumn();
            if($received>=(int)$campaign['reward_limit'])throw new \DomainException('You have received all rewards available to your account for this campaign.');
            if((int)$campaign['total_claim_limit']>0&&(int)$campaign['claim_count']>=(int)$campaign['total_claim_limit'])throw new \DomainException('All campaign rewards have been claimed.');
            $amount=(int)$campaign['reward_amount'];
            $this->db->prepare('INSERT INTO campaign_claims (campaign_id,user_id,sequence_number,amount,request_key) VALUES (?,?,?,?,?)')->execute([$id,$userId,$received+1,$amount,$key]);$claimId=(int)$this->db->lastInsertId();
            (new BonusCreditService($this->db))->adjust($userId,$amount,'Campaign: '.$campaign['title'],'campaign','campaign-claim:'.$claimId);
            $this->db->prepare('UPDATE campaigns SET claim_count=claim_count+1 WHERE id=?')->execute([$id]);
            (new AuditLogger($this->db))->log('campaign.reward_claimed','campaign',$id,['claimId'=>$claimId,'amount'=>$amount,'sequence'=>$received+1],'user',$userId);
            $this->db->commit();
            return ['duplicate'=>false,'rewardGranted'=>$amount,'bonus'=>(new BonusCreditService($this->db))->balance($userId),'campaign'=>$this->detail($id,$userId)];
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }

    public function syncUser(int $userId): void
    {
        $query=$this->db->prepare("SELECT c.id,c.title,c.body FROM campaigns c JOIN users u ON u.id=? WHERE ".$this->activeCondition('c')." AND (c.audience='all' OR u.email_verified_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM user_notifications n WHERE n.user_id=u.id AND n.dedupe_key=CONCAT('announcement-campaign:',c.id,':',u.id)) ORDER BY c.id LIMIT 20");
        $query->execute([$userId]);foreach($query->fetchAll() as $row)$this->deliver($row,$userId);
    }

    public function deliverBatch(): void
    {
        // Delivery can overlap safely: notification deduplication is enforced by MySQL.
        // Do not hold a campaign lock while inserting user-owned notifications.
        $campaign=$this->db->query('SELECT * FROM campaigns c WHERE '.$this->activeCondition('c').' AND delivery_cursor<max_user_id ORDER BY id LIMIT 1')->fetch();
        if(!$campaign)return;
        $query=$this->db->prepare('SELECT id,email_verified_at,account_status FROM users WHERE id>? AND id<=? ORDER BY id LIMIT 100');
        $query->execute([$campaign['delivery_cursor'],$campaign['max_user_id']]);$users=$query->fetchAll();
        foreach($users as $user)if($user['account_status']==='active'&&($campaign['audience']==='all'||$user['email_verified_at']!==null))$this->deliver($campaign,(int)$user['id']);
        $cursor=$users?(int)end($users)['id']:(int)$campaign['max_user_id'];
        $this->db->prepare('UPDATE campaigns SET delivery_cursor=GREATEST(delivery_cursor,?) WHERE id=?')->execute([$cursor,$campaign['id']]);
    }

    private function deliver(array $campaign,int $userId): void
    {
        (new NotificationService($this->db))->notify($userId,'announcement',$campaign['title'],$campaign['body'],'/notifications?campaign='.$campaign['id'],'announcement-campaign:'.$campaign['id'].':'.$userId,false);
    }

    private function publicCampaign(array $row,int $userId): array
    {
        $query=$this->db->prepare('SELECT COUNT(*) FROM campaign_claims WHERE campaign_id=? AND user_id=?');$query->execute([$row['id'],$userId]);$received=(int)$query->fetchColumn();
        $remaining=max(0,(int)$row['reward_limit']-$received);
        if((int)$row['total_claim_limit']>0)$remaining=min($remaining,max(0,(int)$row['total_claim_limit']-(int)$row['claim_count']));
        $eligibility=$this->db->prepare('SELECT email_verified_at FROM users WHERE id=?');$eligibility->execute([$userId]);$verified=$eligibility->fetchColumn();
        return ['id'=>(int)$row['id'],'title'=>$row['title'],'body'=>$row['body'],'color'=>$row['color'],'status'=>$row['status'],'active'=>$this->isActive($row),'rewardEnabled'=>(bool)$row['reward_enabled'],'rewardAmount'=>(int)$row['reward_amount'],'claimsReceived'=>$received,'claimsRemaining'=>$remaining,'canClaim'=>($row['audience']==='all'||$verified!==null)&&$this->isActive($row)&&(bool)$row['reward_enabled']&&$remaining>0,'startsAt'=>$row['starts_at'],'endsAt'=>$row['ends_at']];
    }

    private function activeCondition(string $alias): string
    {
        return "$alias.status='active' AND ($alias.starts_at IS NULL OR $alias.starts_at<=UTC_TIMESTAMP()) AND ($alias.ends_at IS NULL OR $alias.ends_at>UTC_TIMESTAMP())";
    }

    private function isActive(array $row): bool
    {
        return $row['status']==='active'&&(!$row['starts_at']||strtotime($row['starts_at'].' UTC')<=time())&&(!$row['ends_at']||strtotime($row['ends_at'].' UTC')>time());
    }

    private function validate(array $body): array
    {
        $title=Sanitizer::cleanText($body['title']??'',false,180);$text=Sanitizer::cleanText($body['body']??'',true,5000);
        $amount=filter_var($body['rewardAmount']??5,FILTER_VALIDATE_INT);$limit=filter_var($body['rewardLimit']??1,FILTER_VALIDATE_INT);$cap=filter_var($body['totalClaimLimit']??0,FILTER_VALIDATE_INT);
        if(mb_strlen($title)<3||mb_strlen($text)<5||!in_array($body['color']??'',self::COLORS,true)||!in_array($body['status']??'',self::STATUSES,true)||!in_array($body['audience']??'all',['all','verified'],true)||!is_bool($body['rewardEnabled']??null)||$amount===false||$amount<1||$amount>1000||$limit===false||$limit<1||$limit>100||$cap===false||$cap<0||$cap>1000000)throw new \DomainException('Provide a title, message, valid color and reward settings. Rewards allow 1–1,000 tokens and 1–100 claims per user.');
        $dates=[];foreach(['startsAt','endsAt'] as $key){$value=$body[$key]??null;if(!$value){$dates[]=null;continue;}$date=\DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z',(string)$value,new \DateTimeZone('UTC'));if(!$date||$date->format('Y-m-d\TH:i:s\Z')!==$value)throw new \DomainException('Choose a valid campaign schedule.');$dates[]=$date->format('Y-m-d H:i:s');}
        if($dates[0]&&$dates[1]&&$dates[1]<=$dates[0])throw new \DomainException('The campaign must end after it starts.');
        return ['title'=>$title,'body'=>$text,'color'=>$body['color'],'status'=>$body['status'],'audience'=>$body['audience']??'all','starts_at'=>$dates[0],'ends_at'=>$dates[1],'reward_enabled'=>(int)$body['rewardEnabled'],'reward_amount'=>$amount,'reward_limit'=>$limit,'total_claim_limit'=>$cap];
    }
}
