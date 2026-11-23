<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

final class FeaturePricing
{
    // Background editing/reading can be unlocked, never billed for every automatic save or refresh.
    public const CATALOGUE = [
        'resume_create' => ['Create resume', true],
        'resume_editor' => ['Resume editing', false],
        'templates' => ['Resume templates', false],
        'cover_letters' => ['Cover letters', false],
        'cover_letter_create' => ['Create letter', true],
        'ai_assist' => ['Assist me', true],
        'ai_refine' => ['Refine writing', true],
        'ai_review' => ['AI resume review', true],
        'ai_cover_letter' => ['AI letter draft', true],
        'mochi_coach' => ['Mochi personal coach', false],
        'mochi_play' => ['Play with Mochi', false],
        'mochi_chat' => ['Mochi chat and writing help', true],
        'pdf_download' => ['PDF downloads', true],
        'document_preview' => ['Document previews', false],
        'photo_upload' => ['Photo uploads', true],
        'resume_rename' => ['Rename resume', true],
        'document_settings' => ['Document appearance', false],
    ];
    public const DEPENDENCIES = ['resume_create'=>['resume_editor','templates'],'templates'=>['resume_editor'],'pdf_download'=>['templates'],'cover_letter_create'=>['cover_letters'],'ai_cover_letter'=>['cover_letters'],'ai_assist'=>['resume_editor'],'ai_refine'=>['resume_editor'],'ai_review'=>['resume_editor'],'photo_upload'=>['resume_editor'],'document_settings'=>['resume_editor']];

    public function __construct(private readonly PDO $db)
    {
    }

    private function strictRulesReady(): bool
    {
        return (bool)$this->db->query("SELECT setting_key FROM operations_settings WHERE setting_key='strict_package_upgrade_024'")->fetchColumn();
    }

    public function all(?int $userId = null, bool $presentation = false): array
    {
        $rows = $this->db->query('SELECT * FROM feature_prices')->fetchAll(PDO::FETCH_UNIQUE);
        $ready=$this->strictRulesReady();
        $unlocks = [];
        $credits = [];
        $access = new PackageAccess($this->db);
        $packages = $userId ? $access->benefits($userId) : [];
        $hidden = $userId && $presentation ? $access->hiddenUnavailableTools($userId) : [];
        if ($userId && array_filter($rows, static fn(array $row): bool => $row['mode'] !== 'free')) {
            $q = $this->db->prepare('SELECT feature_key FROM user_feature_entitlements WHERE user_id=?');
            $q->execute([$userId]);
            $unlocks = $q->fetchAll(PDO::FETCH_COLUMN);
            $q = $this->db->prepare("SELECT feature_key,COUNT(*) AS available FROM feature_use_credits WHERE user_id=? AND (state='available' OR state='held' AND reserved_until<UTC_TIMESTAMP()) GROUP BY feature_key");
            $q->execute([$userId]);
            foreach ($q->fetchAll() as $row) $credits[$row['feature_key']] = (int) $row['available'];
        }
        $result = [];
        foreach (self::CATALOGUE as $key => [$name, $perUse]) {
            $row = $rows[$key] ?? [];
            $mode=$ready&&in_array($row['mode']??null,['free','unlock','per_use','package_only'],true)?$row['mode']:'package_only';
            if (MochiPolicy::packageOnly($key)) $mode = 'package_only';
            $result[$key] = ['key' => $key, 'name' => $name, 'perUseAllowed' => $perUse, 'packageMetered'=>$perUse||$key==='templates', 'mode' => $mode, 'cost' => (int)($row['token_cost'] ?? 0), 'version' => (int)($row['version'] ?? 0), 'unlocked' => $mode!=='package_only'&&in_array($key, $unlocks, true), 'credits' => $mode==='package_only'?0:($credits[$key] ?? 0), 'packageIncluded'=>isset($packages[$key]), 'packageUses'=>$packages[$key]['uses'] ?? 0, 'packageUnlocked'=>$packages[$key]['unlocked'] ?? false, 'packageUnlimited'=>($perUse||$key==='templates')&&($packages[$key]['unlocked']??false), 'packageName'=>$packages[$key]['name'] ?? null];
            $price=&$result[$key];
            $price['accessState']=$price['packageUnlocked']||$price['packageUses']>0?'included':($mode==='free'?'public':($price['unlocked']?'unlocked':($price['credits']>0?'prepaid':($mode!=='package_only'?'token_fallback':($price['packageIncluded']?'exhausted':'locked')))));
            $price['accessAllowed']=!in_array($price['accessState'],['locked','exhausted'],true);
            $price['hiddenByPackage']=in_array($key,$hidden,true)&&!$price['accessAllowed'];
            $price['requires']=self::DEPENDENCIES[$key]??[];
            unset($price);
        }
        return $result;
    }

    public function save(string $key, array $body, int $adminId): void
    {
        if(!$this->strictRulesReady())throw new \DomainException('Apply migration 024 before changing commercial access rules.');
        if (!isset(self::CATALOGUE[$key])) throw new \DomainException('Choose a supported product feature.');
        $mode = $body['mode'] ?? '';
        if (MochiPolicy::packageOnly($key) && $mode !== 'package_only') throw new \DomainException('Mochi is included through packages.');
        $cost = filter_var($body['cost'] ?? null, FILTER_VALIDATE_INT);
        if (!in_array($mode, ['free', 'unlock', 'per_use','package_only'], true) || $cost === false || $cost < 0 || $cost > 10000 || (!in_array($mode,['free','package_only'],true) && $cost < 1) || ($mode === 'per_use' && !self::CATALOGUE[$key][1])) throw new \DomainException('Choose a valid access model and token price.');
        $this->db->beginTransaction();
        try {
            $this->db->prepare('INSERT INTO feature_prices (feature_key) VALUES (?) ON DUPLICATE KEY UPDATE feature_key=VALUES(feature_key)')->execute([$key]);
            $q = $this->db->prepare('UPDATE feature_prices SET mode=?,token_cost=?,version=version+1,updated_by=? WHERE feature_key=? AND version=?');
            $q->execute([$mode, $mode==='free'?0:$cost, $adminId, $key, (int)($body['version'] ?? -1)]);
            if ($q->rowCount() !== 1) throw new ConcurrentUpdate('This price changed. Reopen it before saving.');
            (new AuditLogger($this->db))->log('admin.feature_price_updated', 'feature', $key, ['mode' => $mode, 'cost' => $mode === 'free'?0: $cost], 'admin', $adminId);
            (new RealtimeEvents($this->db))->publish('store', 'users');
            (new RealtimeEvents($this->db))->publish('pricing', 'admin');
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function purchase(int $userId, string $key, int $version, string $reference): array
    {
        if (MochiPolicy::packageOnly($key)) throw new \DomainException('Choose a package that includes Mochi.');
        if(!$this->strictRulesReady())throw new \DomainException('Commercial access rules are being updated. Please try again later.');
        if (!isset(self::CATALOGUE[$key]) || !preg_match('/^[a-zA-Z0-9-]{16,64}$/D', $reference)) throw new \DomainException('Choose a feature and a valid purchase reference.');
        $this->db->beginTransaction();
        try {
            $wallet = new BonusCreditService($this->db);
            $wallet->lock($userId);
            $q = $this->db->prepare('SELECT * FROM token_access_purchases WHERE request_key=?');
            $q->execute([$reference]);
            $previous = $q->fetch();
            if ($previous) {
                if ((int) $previous['user_id'] !== $userId || $previous['feature_key'] !== $key || (int) $previous['price_version'] !== $version) throw new \DomainException('That purchase reference is already in use.');
                $this->db->commit();
                return ['duplicate' => true, 'feature' => $key];
            }
            $q = $this->db->prepare('SELECT * FROM feature_prices WHERE feature_key=? LOCK IN SHARE MODE');
            $q->execute([$key]);
            $price = $q->fetch();
            if (!$price || $price['mode'] === 'free' || (int) $price['version'] !== $version) throw new ConcurrentUpdate('The price changed. Review the current price before continuing.');
            if($price['mode']==='package_only')throw new \DomainException('This feature requires an eligible package.');
            if (str_starts_with($key,'ai_') && $price['mode'] === 'per_use') throw new \DomainException('Use the AI action directly. Its Coin cost is charged only when it succeeds.');
            $available = (new FeaturePolicy($this->db))->all()[$key === 'cover_letter_create'?'cover_letters': $key] ?? null;
            if ($available && !$available['available']) throw new \DomainException('This feature is temporarily unavailable. No tokens were spent.');
            if (str_starts_with($key, 'ai_') && !trim((string)Config::get('openai.api_key', ''))) throw new \DomainException('AI assistance is currently unavailable. No tokens were spent.');
            $q = $this->db->prepare('SELECT user_id FROM user_feature_entitlements WHERE user_id=? AND feature_key=?');
            $q->execute([$userId, $key]);
            if ($q->fetchColumn()) {
                $this->db->commit();
                return ['duplicate' => true, 'feature' => $key];
            }
            $cost = (int) $price['token_cost'];
            $wallet->adjust($userId, -$cost, 'Access: ' . self::CATALOGUE[$key][0], 'feature_access', 'access:' . $reference);
            if ($price['mode'] === 'unlock') $this->db->prepare('INSERT INTO user_feature_entitlements (user_id,feature_key,paid_tokens) VALUES (?,?,?)')->execute([$userId, $key, $cost]);
            else $this->db->prepare('INSERT INTO feature_use_credits (user_id,feature_key,paid_tokens) VALUES (?,?,?)')->execute([$userId, $key, $cost]);
            $this->db->prepare('INSERT INTO token_access_purchases (request_key,user_id,feature_key,mode,token_cost,price_version) VALUES (?,?,?,?,?,?)')->execute([$reference, $userId, $key, $price['mode'], $cost, $version]);
            (new AuditLogger($this->db))->log('store.feature_access_purchased', 'feature', $key, ['cost' => $cost, 'mode' => $price['mode']], 'user', $userId);
            $this->db->commit();
            return ['duplicate' => false, 'feature' => $key];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function reserve(int $userId, array $keys, bool $unmetered = false): array
    {
        if (!$keys) return ['allowed'=>true,'reservations'=>[]];
        $this->db->beginTransaction();
        $reservations = [];
        try {
            (new BonusCreditService($this->db))->lock($userId);
            $prices=$this->all($userId);
            foreach (array_unique($keys) as $key) {
                if(!isset($prices[$key]))throw new \DomainException('Unknown commercial feature.');
                $price=$prices[$key];
                if ($unmetered) {
                    if ($price['mode'] === 'free' || $price['unlocked'] || $price['packageUnlocked']) continue;
                    $this->db->rollBack();
                    return ['allowed'=>false,'price'=>$price];
                }
                // AI reserves and settles its benefit with the provider result, never at navigation time.
                if(str_starts_with($key,'ai_')&&$price['accessAllowed'])continue;
                $package = (new PackageAccess($this->db))->reserve($userId,$key);
                if ($package !== null) { $reservations[]=$package; continue; }
                if($price['mode']==='free'||$price['unlocked'])continue;
                if($price['mode']==='package_only'){
                    $this->db->rollBack();
                    return ['allowed'=>false,'price'=>$price,'wallet'=>(new BonusCreditService($this->db))->balance($userId)];
                }
                $q = $this->db->prepare("SELECT id FROM feature_use_credits WHERE user_id=? AND feature_key=? AND (state='available' OR state='held' AND reserved_until<UTC_TIMESTAMP()) ORDER BY id LIMIT 1 FOR UPDATE");
                $q->execute([$userId, $key]);
                $id = $q->fetchColumn();
                if (!$id) {
                    $this->db->rollBack();
                    return ['allowed' => false, 'price' => $prices[$key], 'wallet' => (new BonusCreditService($this->db))->balance($userId)];
                }
                $reference = bin2hex(random_bytes(16));
                $this->db->prepare("UPDATE feature_use_credits SET state='held',reservation_key=?,reserved_until=UTC_TIMESTAMP()+INTERVAL 15 MINUTE WHERE id=?")->execute([$reference, $id]);
                $reservations[] = ['id' => (int) $id, 'reference' => $reference];
            }
            $this->db->commit();
            return ['allowed' => true, 'reservations' => $reservations];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function settle(array $reservations, bool $success): void
    {
        if (!$reservations) return;
        $owns=!$this->db->inTransaction();if($owns)$this->db->beginTransaction();
        try {
        $q = $this->db->prepare("UPDATE feature_use_credits SET state=?,reserved_until=NULL,reservation_key=IF(?=1,reservation_key,NULL),used_at=IF(?=1,UTC_TIMESTAMP(),NULL) WHERE id=? AND state='held' AND reservation_key=? AND (?=0 OR reserved_until>UTC_TIMESTAMP())");
        foreach ($reservations as $item) {
            if (!empty($item['package'])) (new PackageAccess($this->db))->settle($item,$success);
            else {
                $q->execute([$success?'used':'available',(int)$success,(int)$success,$item['id'],$item['reference'],(int)$success]);
                if($success&&$q->rowCount()!==1){$check=$this->db->prepare("SELECT id FROM feature_use_credits WHERE id=? AND reservation_key=? AND state='used'");$check->execute([$item['id'],$item['reference']]);if(!$check->fetchColumn())throw new \DomainException('The action reservation expired. Please try again.');}
            }
        }
        if($owns)$this->db->commit();
        }catch(\Throwable $error){if($owns&&$this->db->inTransaction())$this->db->rollBack();throw $error;}
    }

    public function reserveAiBenefit(int $userId,string $key): ?array
    {
        $package = (new PackageAccess($this->db))->reserve($userId,$key);
        if ($package !== null) return $package;
        if($this->all($userId)[$key]['mode']==='package_only')return null;
        $this->db->beginTransaction();
        try {
            $q=$this->db->prepare("SELECT id FROM feature_use_credits WHERE user_id=? AND feature_key=? AND (state='available' OR state='held' AND reserved_until<UTC_TIMESTAMP()) ORDER BY id LIMIT 1 FOR UPDATE");
            $q->execute([$userId,$key]);
            $id=$q->fetchColumn();
            if (!$id) { $this->db->commit(); return null; }
            $reference=bin2hex(random_bytes(16));
            $this->db->prepare("UPDATE feature_use_credits SET state='held',reservation_key=?,reserved_until=UTC_TIMESTAMP()+INTERVAL 15 MINUTE WHERE id=?")->execute([$reference,$id]);
            $this->db->commit();
            return ['id'=>(int)$id,'reference'=>$reference];
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function refund(int $userId, int $id): void
    {
        $this->db->beginTransaction();
        try {
            $wallet = new BonusCreditService($this->db);
            $wallet->lock($userId);
            $q = $this->db->prepare('SELECT * FROM feature_use_credits WHERE id=? AND user_id=? FOR UPDATE');
            $q->execute([$id, $userId]);
            $credit = $q->fetch();
            if (!$credit) throw new \OutOfBoundsException('Token credit not found.');
            if ($credit['state'] === 'refunded') {
                $this->db->commit();
                return;
            }
            if ($credit['state'] !== 'available' && !($credit['state'] === 'held' && strtotime($credit['reserved_until'] . ' UTC') < time())) throw new \DomainException('Only unused credits can be returned to your Coin balance.');
            $wallet->adjust($userId, (int) $credit['paid_tokens'], 'Unused feature credit returned', 'feature_refund', 'feature-refund:' . $id);
            $this->db->prepare("UPDATE feature_use_credits SET state='refunded',reservation_key=NULL,reserved_until=NULL WHERE id=?")->execute([$id]);
            (new AuditLogger($this->db))->log('store.feature_credit_refunded', 'credit', $id, ['amount' => (int) $credit['paid_tokens']], 'user', $userId);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public static function forRequest(string $path, string $method): array
    {
        if (in_array($path, ['/builder'], true)) return ['resume_editor'];
        // Browsing samples is free. Actual template writes enforce tier and ownership rules.
        if ($path === '/cover-letters' || str_starts_with($path, '/api/cover-letters')) return ['cover_letters', ...($method === 'POST' && $path === '/api/cover-letters'?['cover_letter_create']: []), ...(str_ends_with($path, '/ai-suggest')?['ai_cover_letter']: []), ...(str_ends_with($path, '/pdf')?['pdf_download']: []), ...(str_ends_with($path, '/document') || str_ends_with($path, '/preview')?['document_preview']: [])];
        if ($path === '/api/dashboard' && $method === 'POST') return ['resume_create'];
        if (preg_match('#^/api/dashboard/\d+/title$#D', $path) && $method === 'PATCH') return ['resume_rename'];
        if (preg_match('#^/api/pdf/\d+/generate$#D', $path)) return ['pdf_download'];
        if (str_starts_with($path, '/api/pdf/')) return ['document_preview'];
        if (str_ends_with($path, '/ai-assist')) return ['ai_assist'];
        if (str_ends_with($path, '/ai-suggest')) return ['ai_refine'];
        if (str_ends_with($path, '/ats-review') && $method === 'POST') return ['ai_review'];
        if (preg_match('#^/api/resume/\d+/photo$#D', $path) && $method === 'POST') return ['resume_editor', 'photo_upload'];
        if (preg_match('#^/api/resume/\d+/section$#D', $path) && $method !== 'GET') return ['resume_editor'];
        return [];
    }
}
