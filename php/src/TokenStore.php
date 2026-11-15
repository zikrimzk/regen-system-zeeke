<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

final class TokenStore
{
    public const COIN_COLORS=['emerald','gold','sapphire','amethyst','rose','slate'];
    private ?array $storePolicy = null;
    public function __construct(private readonly PDO $db)
    {
    }

    public function policy(): array
    {
        if ($this->storePolicy !== null) return $this->storePolicy;
        $value = $this->db->query("SELECT payload FROM operations_settings WHERE setting_key='token_store'")->fetchColumn();
        $policy = array_replace(['enabled' => true,'showOnLanding'=>true,'displayMode'=>'showcase','coinColor'=>'emerald', 'title' => 'Packages for your next application', 'description' => 'Choose the features and uses you need.', 'notice' => '', 'version' => 0], json_decode((string)($value?: '{}'), true)?: []);
        if ($policy['notice'] === 'Paid checkout opens later. Free offers can be claimed when available.') $policy['notice'] = '';
        return $this->storePolicy = $policy;
    }

    public function savePolicy(array $body, int $adminId): void
    {
        foreach (['title' => 100, 'description' => 400, 'notice' => 300] as $key => $max) {
            $body[$key] = Sanitizer::cleanText($body[$key] ?? '', true, $max);
            if ($key==='title' && $body[$key] === '') throw new \DomainException('Enter a store heading.');
        }
        if (!is_bool($body['enabled'] ?? null)) throw new \DomainException('Choose whether the store is visible.');
        $this->db->beginTransaction();
        try {
            $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('token_store','{\"version\":0}',?) ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)")->execute([$adminId]);
            $q = $this->db->query("SELECT payload FROM operations_settings WHERE setting_key='token_store' FOR UPDATE");
            $current = json_decode((string)($q->fetchColumn()?: '{}'), true)?: [];
            if ((int)($current['version'] ?? 0) !== (int)($body['version'] ?? -1)) throw new ConcurrentUpdate('Store settings changed. Reopen them before saving.');
            $body['showOnLanding']=$body['showOnLanding']??$current['showOnLanding']??true;
            $body['displayMode']=$body['displayMode']??$current['displayMode']??'showcase';
            $body['coinColor']=$body['coinColor']??$current['coinColor']??'emerald';
            if(!in_array($body['coinColor'],self::COIN_COLORS,true))throw new \DomainException('Choose a supported balance coin colour.');
            if(!is_bool($body['showOnLanding'])||!in_array($body['displayMode'],['simple','showcase'],true))throw new \DomainException('Choose a valid package design and landing visibility.');
            $data = array_intersect_key($body, array_flip(['enabled','showOnLanding','displayMode','coinColor', 'title', 'description', 'notice']));
            $data['version'] = (int)($current['version'] ?? 0) + 1;
            $this->db->prepare("INSERT INTO operations_settings (setting_key,payload,updated_by) VALUES ('token_store',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()")->execute([json_encode($data, JSON_THROW_ON_ERROR), $adminId]);
            (new AuditLogger($this->db))->log('admin.store_settings_updated', 'settings', 'store', $data, 'admin', $adminId);
            (new RealtimeEvents($this->db))->publish('store', 'users');
            (new RealtimeEvents($this->db))->publish('store', 'admin');
            $this->db->commit();
            $this->storePolicy = null;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function packages(bool $admin, int $page = 1,bool $landing=false,?int $userId=null,?string $layout=null,?string $feature=null,bool $offersOnly=false): array
    {
        $page = max(1, min(10000, $page));
        $where = $admin?'': ' WHERE active=1'.($landing?' AND landing_visible=1':'');
        if($layout!==null){if(!in_array($layout,['hero','row'],true))throw new \DomainException('Choose a supported package layout.');$where.=($where===''?' WHERE ':' AND ')."card_layout='".$layout."'";}
        if($feature!==null&&isset(FeaturePricing::CATALOGUE[$feature])){
            $jsonPaths = array_map(fn(string $key): string => $this->db->quote('$."'.$key.'"'), MochiPolicy::storeFeatures($feature));
            $where .= ($where===''?' WHERE ':' AND ')."JSON_CONTAINS_PATH(features_json,'one',".implode(',', $jsonPaths).")=1";
        }
        if($admin&&$offersOnly)$where.=($where===''?' WHERE ':' AND ')."(claim_enabled=1 OR compare_price_minor IS NOT NULL OR badge<>'')";
        $total = (int) $this->db->query('SELECT COUNT(*) FROM token_packages' . $where)->fetchColumn();
        $claimed=$userId===null?'0':'EXISTS(SELECT 1 FROM package_claims pc WHERE pc.package_id=p.id AND pc.user_id='.(int)$userId.')';
        $ownership = $userId === null ? '' : ',EXISTS(SELECT 1 FROM package_grants g WHERE g.package_id=p.id AND g.user_id='.(int)$userId
            .' AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP())'
            .' AND EXISTS(SELECT 1 FROM package_entitlements e WHERE e.grant_id=g.id)) AS active_grant'
            .",EXISTS(SELECT 1 FROM payment_orders o WHERE o.package_id=p.id AND o.user_id=".(int)$userId
            ." AND o.state='paid' AND o.refunded_minor<o.amount_minor) AS has_purchase";
        $rows = $this->db->query('SELECT p.*,(SELECT COUNT(*) FROM package_claims pc WHERE pc.package_id=p.id) AS claim_count,'.$claimed.' AS claimed_by_user'
            .$ownership.' FROM token_packages p' . $where . ' ORDER BY sort_order,id LIMIT 12 OFFSET ' . (($page-1) * 12))->fetchAll();
        $visibility=[];
        if ($admin && $rows) {
            $keys=array_map(static fn(array $row):string=>'package_visibility_'.(int)$row['id'],$rows);
            $q=$this->db->prepare('SELECT setting_key,payload FROM operations_settings WHERE setting_key IN ('.implode(',',array_fill(0,count($keys),'?')).')');
            $q->execute($keys);
            foreach($q->fetchAll() as $setting) $visibility[$setting['setting_key']]=json_decode((string)$setting['payload'],true)?:[];
        }
        foreach ($rows as &$row) {
            if ($admin) $row['hide_unavailable_tools']=$visibility['package_visibility_'.$row['id']]??[];
            foreach (['id', 'tokens', 'bonus_tokens', 'price_minor', 'sort_order', 'version'] as $key) $row[$key] = (int) $row[$key];
            $row['active'] = (bool) $row['active'];
            $row['highlighted'] = (bool) $row['highlighted'];
            if ($userId !== null) {
                $row['active_grant'] = (bool) $row['active_grant'];
                $row['has_purchase'] = (bool) $row['has_purchase'];
            }
            $row['landing_visible']=(bool)$row['landing_visible'];$row['claim_enabled']=(bool)$row['claim_enabled'];
            $row['claim_limit']=$row['claim_limit']===null?null:(int)$row['claim_limit'];
            $row['claim_count']=(int)$row['claim_count'];
            $row['claim']=PackageClaims::state($row,$row['claim_count'],(bool)$row['claimed_by_user']);unset($row['claimed_by_user']);
            $row['features'] = json_decode((string)($row['features_json'] ?? '{}'),true) ?: [];
            $row['template_tiers'] = json_decode((string)($row['template_tiers']??'null'),true)??['basic','premium'];
            unset($row['features_json']);
            $row['validity_days'] = $row['validity_days'] === null ? null : (int)$row['validity_days'];
            $row['compare_price_minor'] = $row['compare_price_minor'] === null ? null : (int)$row['compare_price_minor'];
            $row = self::promotion($row);
            unset($row['updated_by']);
        }
        return ['items' => $rows, 'total' => $total, 'page' => $page, 'pageSize' => 12];
    }

    public function sections(bool $landing=false,?int $userId=null,int $heroPage=1,int $rowPage=1,?string $feature=null): array
    {
        return ['hero'=>$this->packages(false,$heroPage,$landing,$userId,'hero',$feature),'row'=>$this->packages(false,$rowPage,$landing,$userId,'row',$feature)];
    }

    public function savePackage(?int $id, array $body, int $adminId): int
    {
        $name = Sanitizer::cleanText($body['name'] ?? '', false, 80);
        $description = Sanitizer::cleanText($body['description'] ?? '', true, 300);
        $badge = Sanitizer::cleanText($body['badge'] ?? '', false, 30);
        $headline = array_key_exists('offerHeadline', $body) ? Sanitizer::cleanText($body['offerHeadline'], false, 100) : null;
        $cta = array_key_exists('offerCta', $body) ? Sanitizer::cleanText($body['offerCta'], false, 40) : null;
        $numbers = [];
        foreach (['tokens' => [0, 10000], 'bonusTokens' => [0, 10000], 'priceMinor' => [0, 100000000], 'sortOrder' => [0, 100000]] as $key => [$min, $max]) {
            $number = filter_var($body[$key] ?? null, FILTER_VALIDATE_INT);
            if ($number === false || $number < $min || $number > $max) throw new \DomainException('Enter valid token quantities, price and display order.');
            $numbers[$key] = $number;
        }
        if ($name === '' || !in_array($body['currency'] ?? '', ['MYR', 'USD', 'SGD'], true) || !is_bool($body['active'] ?? null) || !is_bool($body['highlighted'] ?? null)) throw new \DomainException('Complete the package name, currency and publication options.');
        $features = PackageAccess::cleanFeatures($body['features'] ?? []);
        $hiddenTools=array_key_exists('hideUnavailableTools',$body)?PackageAccess::cleanVisibility($body['hideUnavailableTools']):null;
        $templateTiers=PackageAccess::cleanTemplateTiers($body['templateTiers']??['basic','premium']);
        $layout=$body['cardLayout']??'hero';$coinColor=$body['coinColor']??'emerald';
        if(!in_array($layout,['hero','row'],true)||!in_array($coinColor,self::COIN_COLORS,true))throw new \DomainException('Choose a hero card or one-line offer and a supported coin colour.');
        if (!$features && $numbers['tokens']+$numbers['bonusTokens'] < 1) throw new \DomainException('Include at least one feature or token in this package.');
        if ($numbers['tokens']+$numbers['bonusTokens'] > 10000) throw new \DomainException('A package can include up to 10,000 saved tokens.');
        $days = $body['validityDays'] ?? null;
        if ($days !== null && (!is_int($days) || $days < 1 || $days > 3650)) throw new \DomainException('Validity must be 1–3,650 days, or no expiry.');
        if (!$features) $days=null;
        $compare = $body['comparePriceMinor'] ?? null;
        if ($compare !== null && (!is_int($compare) || $compare <= $numbers['priceMinor'] || $compare > 100000000)) throw new \DomainException('The original price must be higher than the package price.');
        $dates = [];
        foreach (['promotionStartsAt','promotionEndsAt'] as $key) {
            $input = $body[$key] ?? null;
            if ($input !== null && (!is_string($input) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/D',$input) || strtotime($input) === false)) throw new \DomainException('Choose valid promotion dates.');
            $dates[$key] = $input === null ? null : gmdate('Y-m-d H:i:s',strtotime($input));
        }
        if ($dates['promotionStartsAt'] && $dates['promotionEndsAt'] && $dates['promotionStartsAt'] >= $dates['promotionEndsAt']) throw new \DomainException('The promotion must end after it starts.');
        $motion = $body['promotionMotion'] ?? 'none';
        if (!in_array($motion,['none','glow','shine'],true)) throw new \DomainException('Choose a supported promotion effect.');
        $landingVisible=$body['landingVisible']??true;$claimEnabled=$body['claimEnabled']??false;
        if(!is_bool($landingVisible)||!is_bool($claimEnabled))throw new \DomainException('Choose valid package visibility and claim options.');
        $claimDates=[];
        foreach(['claimStartsAt','claimEndsAt'] as $key){$input=$body[$key]??null;if($input!==null&&(!is_string($input)||!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/D',$input)||strtotime($input)===false))throw new \DomainException('Choose valid claim dates.');$claimDates[$key]=$input===null?null:gmdate('Y-m-d H:i:s',strtotime($input));}
        $claimLimit=$body['claimLimit']??null;
        if($claimLimit!==null&&(!is_int($claimLimit)||$claimLimit<1||$claimLimit>1000000))throw new \DomainException('Claim capacity must be between 1 and 1,000,000 accounts.');
        if($claimEnabled&&(!$claimDates['claimStartsAt']||!$claimDates['claimEndsAt']||$claimDates['claimEndsAt']<=$claimDates['claimStartsAt']||$claimLimit===null))throw new \DomainException('Free claims need a start, a later end, and a total claim limit.');
        $this->db->beginTransaction();
        try {
            $values = [$name, $description, $numbers['tokens'], $numbers['bonusTokens'], $numbers['priceMinor'], $body['currency'], $badge, (int) $body['highlighted'], (int) $body['active'], $numbers['sortOrder'], $adminId];
            if ($id === null) {
                $this->db->prepare('INSERT INTO token_packages (name,description,tokens,bonus_tokens,price_minor,currency,badge,highlighted,active,sort_order,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute($values);
                $id = (int) $this->db->lastInsertId();
            } else {
                $q = $this->db->prepare('UPDATE token_packages SET name=?,description=?,tokens=?,bonus_tokens=?,price_minor=?,currency=?,badge=?,highlighted=?,active=?,sort_order=?,updated_by=?,version=version+1 WHERE id=? AND version=?');
                $q->execute([...$values, $id, (int)($body['version'] ?? -1)]);
                if ($q->rowCount() !== 1) throw new ConcurrentUpdate('This package changed. Reopen it before saving.');
            }
            $this->db->prepare('UPDATE token_packages SET features_json=?,validity_days=?,compare_price_minor=?,promotion_starts_at=?,promotion_ends_at=?,promotion_motion=?,template_tiers=? WHERE id=?')->execute([json_encode($features,JSON_THROW_ON_ERROR),$days,$compare,$dates['promotionStartsAt'],$dates['promotionEndsAt'],$motion,json_encode($templateTiers,JSON_THROW_ON_ERROR),$id]);
            if ($headline !== null || $cta !== null) {
                $this->db->prepare('UPDATE token_packages SET offer_headline=COALESCE(?,offer_headline),offer_cta=COALESCE(?,offer_cta) WHERE id=?')->execute([$headline,$cta,$id]);
                (new AuditLogger($this->db))->log('admin.package_offer_copy_updated','token_package',$id,array_filter(['headline'=>$headline,'cta'=>$cta],static fn($value)=>$value!==null),'admin',$adminId);
            }
            if($id!==null&&$claimLimit!==null){$q=$this->db->prepare('SELECT COUNT(*) FROM package_claims WHERE package_id=?');$q->execute([$id]);if($claimLimit<(int)$q->fetchColumn())throw new \DomainException('Capacity cannot be lower than claims already made.');}
            $this->db->prepare('UPDATE token_packages SET landing_visible=?,claim_enabled=?,claim_starts_at=?,claim_ends_at=?,claim_limit=? WHERE id=?')->execute([(int)$landingVisible,(int)$claimEnabled,$claimDates['claimStartsAt'],$claimDates['claimEndsAt'],$claimLimit,$id]);
            $this->db->prepare('UPDATE token_packages SET card_layout=?,coin_color=? WHERE id=?')->execute([$layout,$coinColor,$id]);
            if ($hiddenTools!==null) {
                $this->db->prepare('INSERT INTO operations_settings(setting_key,payload,updated_by) VALUES(?,?,?)
                    ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()')
                    ->execute(['package_visibility_'.$id,json_encode($hiddenTools,JSON_THROW_ON_ERROR),$adminId]);
            }
            (new AuditLogger($this->db))->log('admin.package_distribution_updated','token_package',$id,['cardLayout'=>$layout,'coinColor'=>$coinColor,'landingVisible'=>$landingVisible,'claimEnabled'=>$claimEnabled,'claimLimit'=>$claimLimit,...$claimDates],'admin',$adminId);
            (new AuditLogger($this->db))->log('admin.token_package_saved', 'token_package', $id, ['name' => $name, 'active' => $body['active'], 'tokens' => $numbers['tokens'], 'bonusTokens' => $numbers['bonusTokens'], 'priceMinor' => $numbers['priceMinor'], 'currency' => $body['currency'],'features'=>$features,'templateTiers'=>$templateTiers,'validityDays'=>$days,'originalPriceMinor'=>$compare,'promotion'=>$dates,'motion'=>$motion,'badge'=>$badge,'highlighted'=>$body['highlighted']], 'admin', $adminId);
            (new RealtimeEvents($this->db))->publish('store', 'users');
            (new RealtimeEvents($this->db))->publish('store', 'admin');
            $this->db->commit();
            return $id;
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function wallet(int $userId, int $page = 1): array
    {
        $history = (new BonusCreditService($this->db))->history($userId, $page);
        $q = $this->db->prepare("SELECT c.id,c.feature_key,c.paid_tokens,IF(c.state='held' AND c.reserved_until<UTC_TIMESTAMP(),'available',c.state) AS state,c.created_at FROM feature_use_credits c WHERE user_id=? AND state IN ('available','held') ORDER BY c.id DESC LIMIT 10 OFFSET " . ((max(1, min(10000, $page))-1) * 10));
        $q->execute([$userId]);
        $history['credits'] = $q->fetchAll();
        $q = $this->db->prepare('SELECT feature_key,paid_tokens,created_at FROM user_feature_entitlements WHERE user_id=?');
        $q->execute([$userId]);
        $history['unlocks'] = $q->fetchAll();
        $q = $this->db->prepare("SELECT COUNT(*) FROM feature_use_credits WHERE user_id=? AND state IN ('available','held')");
        $q->execute([$userId]);
        $history['creditTotal'] = (int) $q->fetchColumn();
        return $history;
    }

    public function activity(int $userId,int $page=1): array
    {
        $page=max(1,min(10000,$page));$history=$this->wallet($userId,$page);
        $union="SELECT CONCAT('saved-',id) AS event_id,reason,amount,balance_after,'saved' AS bucket,created_at FROM ai_bonus_ledger WHERE user_id=?
            UNION ALL SELECT CONCAT('base-',id),CONCAT('AI: ',operation),-CAST(base_tokens AS SIGNED),NULL,'base',created_at FROM ai_token_activity WHERE user_id=?
            UNION ALL SELECT CONCAT('package-',r.id),CONCAT(g.package_name,': ',e.feature_key),-1,NULL,'package',r.created_at FROM package_use_reservations r JOIN package_entitlements e ON e.id=r.entitlement_id JOIN package_grants g ON g.id=e.grant_id WHERE g.user_id=? AND r.state='used'";
        $q=$this->db->prepare('SELECT * FROM ('.$union.') activity ORDER BY created_at DESC,event_id DESC LIMIT 12 OFFSET '.(($page-1)*12));
        $q->execute([$userId,$userId,$userId]);$history['ledger']=$q->fetchAll();
        $q=$this->db->prepare('SELECT COUNT(*) FROM ('.$union.') activity');$q->execute([$userId,$userId,$userId]);
        $history['total']=(int)$q->fetchColumn();$history['pageSize']=12;
        return $history;
    }

    public function balance(int $userId): array
    {
        $quota=(new AiQuotaService($this->db))->status($userId);
        return ['base'=>$quota['baseRemaining'],'bonus'=>$quota['bonusRemaining'],'total'=>$quota['remaining'],'reserved'=>$quota['reserved']+$quota['bonusReserved'],'resetAt'=>$quota['resetAt'],'renewable'=>$quota['renewable'],'renewalHours'=>$quota['renewalHours'],'coinColor'=>$this->policy()['coinColor']];
    }

    public static function promotion(array $row): array
    {
        $now = time();
        $active = (!$row['promotion_starts_at'] || strtotime($row['promotion_starts_at'].' UTC') <= $now) && (!$row['promotion_ends_at'] || strtotime($row['promotion_ends_at'].' UTC') > $now);
        $row['promotion_active'] = $active;
        $row['display_price_minor'] = !$active && $row['compare_price_minor'] ? $row['compare_price_minor'] : $row['price_minor'];
        $row['discount_percent'] = $active && $row['compare_price_minor'] ? (int)round(100*(1-$row['price_minor']/$row['compare_price_minor'])) : 0;
        return $row;
    }
}
