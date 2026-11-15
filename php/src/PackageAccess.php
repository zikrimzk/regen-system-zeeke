<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Purchased/granted benefits are snapshots, independent of future catalogue edits. */
final class PackageAccess
{
    public const VISIBILITY_TOOLS = ['ai_assist','ai_refine','ai_review','ai_cover_letter'];
    public function __construct(private readonly PDO $db) {}

    public static function cleanFeatures(mixed $input): array
    {
        if (!is_array($input) || count($input) > count(FeaturePricing::CATALOGUE)) throw new \DomainException('Choose valid package features.');
        $features = [];
        foreach ($input as $key => $uses) {
            if (!isset(FeaturePricing::CATALOGUE[$key])) throw new \DomainException('Choose a supported package feature.');
            if (!FeaturePricing::CATALOGUE[$key][1] && $key!=='templates') {
                if ($uses !== null) throw new \DomainException('Workspace access does not have a per-use limit.');
            } elseif ($uses!==null && (!is_int($uses) || $uses < 1 || $uses > 10000)) throw new \DomainException('Choose unlimited or a limit between 1 and 10,000.');
            $features[$key] = $uses;
        }
        return $features;
    }

    public static function cleanVisibility(mixed $input): array
    {
        if (!is_array($input) || !array_is_list($input) || count($input)>count(self::VISIBILITY_TOOLS)
            || array_filter($input, static fn($key):bool=>!in_array($key,self::VISIBILITY_TOOLS,true))) {
            throw new \DomainException('Choose supported optional tools to hide.');
        }
        return array_values(array_unique($input));
    }

    public function hiddenUnavailableTools(int $userId): array
    {
        $q=$this->db->prepare("SELECT v.payload FROM package_grants g
            JOIN operations_settings v ON v.setting_key=CONCAT('package_visibility_',g.package_id)
            WHERE g.user_id=? AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP())
            AND EXISTS(SELECT 1 FROM package_entitlements e WHERE e.grant_id=g.id AND e.enabled=1)");
        $q->execute([$userId]);
        $hidden=[];
        foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $value) {
            $list=json_decode((string)$value,true);
            if (is_array($list)) $hidden=array_merge($hidden,array_intersect(self::VISIBILITY_TOOLS,$list));
        }
        return array_unique($hidden);
    }

    public function benefits(int $userId, array $features = []): array
    {
        $featureFilter = $features ? ' AND e.feature_key IN (' . implode(',', array_fill(0,count($features),'?')) . ')' : '';
        $q = $this->db->prepare("SELECT e.id,e.feature_key,e.included_uses,g.package_name,g.expires_at,
            IF(e.feature_key='templates',(SELECT COUNT(*) FROM package_template_unlocks t WHERE t.entitlement_id=e.id),
            (SELECT COUNT(*) FROM package_use_reservations r WHERE r.entitlement_id=e.id AND (r.state='used' OR r.state='held' AND r.reserved_until>UTC_TIMESTAMP()))) AS consumed
            FROM package_entitlements e JOIN package_grants g ON g.id=e.grant_id
            WHERE g.user_id=? AND g.revoked_at IS NULL AND e.enabled=1 AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP())"
            . $featureFilter . " ORDER BY g.expires_at IS NULL,g.expires_at,g.id");
        $q->execute([$userId, ...$features]);
        $result = [];
        foreach ($q->fetchAll() as $row) {
            $key = $row['feature_key'];
            $result[$key] ??= ['uses'=>0,'unlocked'=>false,'name'=>$row['package_name']];
            if ($row['included_uses'] === null) $result[$key]['unlocked'] = true;
            else $result[$key]['uses'] += max(0, (int)$row['included_uses'] - (int)$row['consumed']);
        }
        return $result;
    }

    public function hasAccessBenefit(int $userId, string $feature): bool
    {
        $query = $this->db->prepare('SELECT 1 FROM package_grants g JOIN package_entitlements e ON e.grant_id=g.id
            WHERE g.user_id=? AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP())
            AND e.feature_key=? AND e.enabled=1 AND e.included_uses IS NULL LIMIT 1');
        $query->execute([$userId, $feature]);
        return (bool)$query->fetchColumn();
    }

    public static function cleanTemplateTiers(mixed $input): array
    {
        if (!is_array($input)||!array_is_list($input)||!$input||count($input)>2||array_diff($input,['basic','premium'])||count(array_unique($input))!==count($input)) throw new \DomainException('Choose Basic, Premium, or both template collections.');
        return array_values(array_intersect(['basic','premium'],$input));
    }

    public function grants(int $userId,int $page=1,int $pageSize=50,bool $includeDisabled=false,bool $activeOnly=false): array
    {
        $page=max(1,min(10000,$page));$pageSize=max(1,min(50,$pageSize));
        $q = $this->db->prepare('SELECT id,package_id,package_name,expires_at,created_at,revoked_at,revocation_reason,credited_tokens,reversed_tokens,version,reason FROM package_grants WHERE user_id=?'.($activeOnly?' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP())':'').' ORDER BY id DESC LIMIT '.$pageSize.' OFFSET '.(($page-1)*$pageSize));
        $q->execute([$userId]);
        $grants = $q->fetchAll();
        $features = $this->db->prepare("SELECT e.feature_key,e.included_uses,e.template_tiers,e.enabled,
            IF(e.feature_key='templates',(SELECT COUNT(*) FROM package_template_unlocks t WHERE t.entitlement_id=e.id),
            (SELECT COUNT(*) FROM package_use_reservations r WHERE r.entitlement_id=e.id AND (r.state='used' OR r.state='held' AND r.reserved_until>UTC_TIMESTAMP()))) AS consumed
            FROM package_entitlements e WHERE e.grant_id=?".($includeDisabled?'':' AND e.enabled=1'));
        foreach ($grants as &$grant) {
            $grant['id']=(int)$grant['id'];$grant['version']=(int)$grant['version'];$grant['credited_tokens']=(int)$grant['credited_tokens'];$grant['reversed_tokens']=(int)$grant['reversed_tokens'];
            $grant['revoked']=$grant['revoked_at']!==null;
            $grant['expired'] = $grant['expires_at'] !== null && strtotime($grant['expires_at'].' UTC') <= time();
            $grant['active']=!$grant['revoked']&&!$grant['expired'];
            $features->execute([$grant['id']]);
            $grant['features'] = array_map(static fn(array $row): array => ['key'=>$row['feature_key'],'enabled'=>(bool)$row['enabled'],'consumed'=>(int)$row['consumed'],'name'=>FeaturePricing::CATALOGUE[$row['feature_key']][0] ?? $row['feature_key'],'unlimited'=>$row['included_uses']===null&&(FeaturePricing::CATALOGUE[$row['feature_key']][1]||$row['feature_key']==='templates'),'tiers'=>$row['feature_key']==='templates'?(json_decode((string)($row['template_tiers']??'null'),true)??['basic','premium']):null,'included'=>$row['included_uses']===null?null:(int)$row['included_uses'],'remaining'=>$row['included_uses']===null?null:max(0,(int)$row['included_uses']-(int)$row['consumed'])],$features->fetchAll());
        }
        return $grants;
    }

    public function grant(int $packageId, array $body, ?int $adminId): int
    {
        $userId = filter_var($body['userId'] ?? null,FILTER_VALIDATE_INT);
        $reference = (string)($body['reference'] ?? '');
        $reason = Sanitizer::cleanText($body['reason'] ?? '',true,300);
        if (!$userId || $reason === '' || !preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$reference)) throw new \DomainException('Choose an account and give a reason for the package grant.');
        $owns=!$this->db->inTransaction();
        if($adminId===null&&$owns)throw new \LogicException('Self-service grants require a claim transaction.');
        if($owns)$this->db->beginTransaction();
        try {
            $wallet = new BonusCreditService($this->db);
            $wallet->lock($userId);
            $q = $this->db->prepare('SELECT id,user_id,package_id FROM package_grants WHERE request_key=?');
            $q->execute([$reference]);
            if ($old = $q->fetch()) {
                if ((int)$old['user_id'] !== $userId || (int)$old['package_id'] !== $packageId) throw new \DomainException('That grant reference is already in use.');
                if($owns)$this->db->commit();
                return (int)$old['id'];
            }
            $q = $this->db->prepare('SELECT * FROM token_packages WHERE id=? LOCK IN SHARE MODE');
            $q->execute([$packageId]);
            $package = $q->fetch();
            if (!$package) throw new \OutOfBoundsException('Package not found.');
            if ((int)$package['version'] !== (int)($body['version'] ?? -1)) throw new ConcurrentUpdate('The package changed. Review it before granting access.');
            $includeTokens=$body['includeTokens']??true;
            if(!is_bool($includeTokens))throw new \DomainException('Choose whether to credit the included saved tokens.');
            $id = $this->recordGrant($userId, $packageId, $package, $reference, $reason, $adminId, $includeTokens);
            if($owns)$this->db->commit();
            return $id;
        } catch (\Throwable $error) {
            if ($owns && $this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** The caller holds the account and payment-order locks in the same transaction. */
    public function grantPurchase(int $userId, ?int $packageId, array $snapshot, string $reference): int
    {
        if (!$this->db->inTransaction()) throw new \LogicException('Purchases require a payment transaction.');
        return $this->recordGrant($userId, $packageId, $snapshot, 'hitpay-'.$reference, 'HitPay payment '.$reference, null, true);
    }

    private function recordGrant(int $userId, ?int $packageId, array $package, string $reference, string $reason, ?int $adminId, bool $includeTokens): int
    {
        $expiry = $package['validity_days'] ? gmdate('Y-m-d H:i:s',time()+(int)$package['validity_days']*86400) : null;
        $tokens = $includeTokens ? (int)$package['tokens']+(int)$package['bonus_tokens'] : 0;
        $this->db->prepare('INSERT INTO package_grants (user_id,package_id,package_name,expires_at,request_key,reason,granted_by,credited_tokens) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$userId,$packageId,$package['name'],$expiry,$reference,$reason,$adminId,$tokens]);
        $id = (int)$this->db->lastInsertId();
        $insert = $this->db->prepare('INSERT INTO package_entitlements (grant_id,feature_key,included_uses,template_tiers) VALUES (?,?,?,?)');
        foreach (json_decode((string)($package['features_json'] ?? '{}'),true) ?: [] as $key=>$uses) {
            $insert->execute([$id,$key,$uses,$key==='templates'?($package['template_tiers']??null):null]);
        }
        if ($tokens) (new BonusCreditService($this->db))->adjust($userId,$tokens,'Package: '.$package['name'],'package_grant','package-grant:'.$id,$adminId);
        (new AuditLogger($this->db))->log($adminId===null?'store.package_benefit_granted':'admin.package_granted','package_grant',$id,['userId'=>$userId,'packageId'=>$packageId,'reason'=>$reason,'expiresAt'=>$expiry],$adminId===null?'user':'admin',$adminId??$userId);
        (new RealtimeEvents($this->db))->publish('wallet','user',$userId);
        (new RealtimeEvents($this->db))->publish('store','user',$userId);
        return $id;
    }

    /** Reserve the earliest-expiring eligible benefit; row locks prevent overspending. */
    public function reserve(int $userId,string $key): ?array
    {
        $owns = !$this->db->inTransaction();
        if ($owns) $this->db->beginTransaction();
        try {
            (new BonusCreditService($this->db))->lock($userId);
            $q = $this->db->prepare("SELECT e.id,e.included_uses FROM package_entitlements e JOIN package_grants g ON g.id=e.grant_id WHERE g.user_id=? AND e.feature_key=? AND g.revoked_at IS NULL AND e.enabled=1 AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP()) ORDER BY e.included_uses IS NOT NULL,g.expires_at IS NULL,g.expires_at,g.id FOR UPDATE");
            $q->execute([$userId,$key]);
            $rows = $q->fetchAll();
            foreach ($rows as $row) {
                $count = $this->db->prepare("SELECT COUNT(*) FROM package_use_reservations WHERE entitlement_id=? AND (state='used' OR state='held' AND reserved_until>UTC_TIMESTAMP())");
                $count->execute([$row['id']]);
                if ($row['included_uses']!==null && (int)$count->fetchColumn() >= (int)$row['included_uses']) continue;
                $reference = bin2hex(random_bytes(16));
                $this->db->prepare("INSERT INTO package_use_reservations (entitlement_id,reservation_key,reserved_until) VALUES (?,?,UTC_TIMESTAMP()+INTERVAL 15 MINUTE)")->execute([$row['id'],$reference]);
                $reservation = ['package'=>true,'unlimited'=>$row['included_uses']===null,'id'=>(int)$this->db->lastInsertId(),'reference'=>$reference];
                if ($owns) $this->db->commit();
                return $reservation;
            }
            if ($owns) $this->db->commit();
            return null;
        } catch (\Throwable $error) {
            if ($owns && $this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function settle(array $reservation,bool $success): void
    {
        if (!isset($reservation['id'])) return;
        $q=$this->db->prepare("UPDATE package_use_reservations r JOIN package_entitlements e ON e.id=r.entitlement_id JOIN package_grants g ON g.id=e.grant_id SET r.state=? WHERE r.id=? AND r.reservation_key=? AND r.state='held' AND r.reserved_until>UTC_TIMESTAMP() AND (?=0 OR (g.revoked_at IS NULL AND e.enabled=1 AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP())))");$q->execute([$success?'used':'released',$reservation['id'],$reservation['reference'],(int)$success]);
        if($success&&$q->rowCount()!==1){$check=$this->db->prepare("SELECT id FROM package_use_reservations WHERE id=? AND reservation_key=? AND state='used'");$check->execute([$reservation['id'],$reservation['reference']]);if(!$check->fetchColumn())throw new \DomainException('The package reservation expired. Please try again.');}
    }
}
