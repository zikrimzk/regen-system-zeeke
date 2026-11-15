<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Account-scoped package corrections preserve usage and wallet history. */
final class AccountPackages
{
    public function __construct(private readonly PDO $db) {}

    public function overview(int $userId,int $page=1): array
    {
        $q=$this->db->prepare('SELECT id,account_status,ai_token_limit FROM users WHERE id=?');$q->execute([$userId]);
        $account=$q->fetch();if(!$account)throw new \OutOfBoundsException('User account not found.');
        $controls=(new FeaturePolicy($this->db))->all();
        foreach($controls as $key=>&$control)if($account['account_status']!=='active'||str_starts_with($key,'ai_')&&$account['ai_token_limit']!==null&&(int)$account['ai_token_limit']===0)$control['available']=false;
        unset($control);
        $q=$this->db->prepare('SELECT COUNT(*) FROM package_grants WHERE user_id=?');$q->execute([$userId]);
        return ['items'=>(new PackageAccess($this->db))->grants($userId,$page,10,true),'total'=>(int)$q->fetchColumn(),'page'=>max(1,min(10000,$page)),'pageSize'=>10,'prices'=>(new FeaturePricing($this->db))->all($userId),'controls'=>$controls,'wallet'=>(new BonusCreditService($this->db))->balance($userId)];
    }

    public function change(int $userId,?int $grantId,string $action,array $body,int $adminId): array
    {
        $body=array_intersect_key($body,array_flip(['reference','reason','version','packageId','packageVersion','includeTokens','reverseTokens','features','templateTiers','expiresAt']));
        if(!in_array($action,['add','adjust','replace','revoke'],true))throw new \DomainException('Choose a supported package action.');
        $reference=(string)($body['reference']??'');$reason=Sanitizer::cleanText($body['reason']??'',true,300);
        if(!preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$reference)||$reason==='')throw new \DomainException('Give a reason and a valid operation reference.');
        $body['reason']=$reason;
        $hash=hash('sha256',json_encode([$userId,$grantId,$action,$body],JSON_THROW_ON_ERROR));
        $this->db->beginTransaction();
        try {
            (new BonusCreditService($this->db))->lock($userId);
            $q=$this->db->prepare('SELECT * FROM package_grant_operations WHERE request_key=?');$q->execute([$reference]);
            if($old=$q->fetch()){
                if(!hash_equals($old['payload_hash'],$hash))throw new \DomainException('This operation reference was already used for a different change.');
                $this->db->commit();return ['id'=>(int)$old['result_grant_id'],'duplicate'=>true];
            }
            $before=null;$resultId=$grantId;
            if($action!=='add'){
                $q=$this->db->prepare('SELECT * FROM package_grants WHERE id=? AND user_id=? FOR UPDATE');$q->execute([$grantId,$userId]);$before=$q->fetch();
                if(!$before)throw new \OutOfBoundsException('This package grant does not belong to this account.');
                if((int)$before['version']!==(int)($body['version']??-1))throw new ConcurrentUpdate('This grant changed. Reopen it before saving.');
                if($before['revoked_at']!==null)throw new \DomainException('This grant is already revoked. Add a new package to restore access.');
            }
            if(in_array($action,['add','replace'],true)){
                $packageId=filter_var($body['packageId']??null,FILTER_VALIDATE_INT);
                $packageVersion=filter_var($body['packageVersion']??null,FILTER_VALIDATE_INT);
                if(!$packageId||$packageVersion===false)throw new \DomainException('Choose a package from the current catalogue.');
                $includeTokens=$body['includeTokens']??($action==='add');
                if(!is_bool($includeTokens))throw new \DomainException('Choose whether to grant the included saved tokens.');
                $resultId=(new PackageAccess($this->db))->grant($packageId,['userId'=>$userId,'version'=>$packageVersion,'reason'=>$reason,'reference'=>'managed-'.substr(hash('sha256',$reference),0,48),'includeTokens'=>$includeTokens],$adminId);
            }
            if($action==='adjust')$this->adjust($before,$body);
            if(in_array($action,['replace','revoke'],true)){
                $reverse=$body['reverseTokens']??false;if(!is_bool($reverse))throw new \DomainException('Choose whether to reverse the original saved-token credit.');
                $amount=$reverse?max(0,(int)$before['credited_tokens']-(int)$before['reversed_tokens']):0;
                if($amount)(new BonusCreditService($this->db))->adjust($userId,-$amount,'Package correction: '.$reason,'package_reversal','package-reversal:'.$grantId,$adminId);
                if($amount)$this->db->prepare('UPDATE package_grants SET reversed_tokens=reversed_tokens+? WHERE id=?')->execute([$amount,$grantId]);
                $this->db->prepare('UPDATE package_grants SET revoked_at=UTC_TIMESTAMP(),revoked_by=?,revocation_reason=?,version=version+1 WHERE id=?')->execute([$adminId,$reason,$grantId]);
                $this->releaseHolds($grantId);
            }
            $this->db->prepare('INSERT INTO package_grant_operations (request_key,user_id,grant_id,result_grant_id,action,payload_hash,admin_id) VALUES (?,?,?,?,?,?,?)')->execute([$reference,$userId,$grantId,$resultId,$action,$hash,$adminId]);
            (new AuditLogger($this->db))->log('admin.account_package_'.$action,'package_grant',$resultId,['userId'=>$userId,'previousGrant'=>$before,'change'=>$body,'reason'=>$reason,'savedTokenPolicy'=>'Existing credits change only when explicitly selected'],'admin',$adminId);
            foreach(['store','pricing','wallet','documents'] as $topic)(new RealtimeEvents($this->db))->publish($topic,'user',$userId);
            (new RealtimeEvents($this->db))->publish('store','admin');
            $this->db->commit();return ['id'=>(int)$resultId,'duplicate'=>false];
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }

    private function adjust(array $grant,array $body): void
    {
        $features=PackageAccess::cleanFeatures($body['features']??null);
        if(!$features)throw new \DomainException('Keep at least one feature, or revoke this grant.');
        $tiers=PackageAccess::cleanTemplateTiers($body['templateTiers']??['basic','premium']);
        $expires=$body['expiresAt']??null;
        if($expires!==null){
            $date=is_string($expires)?\DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z',$expires,new \DateTimeZone('UTC')):false;
            if(!$date||$date->format('Y-m-d\TH:i:s\Z')!==$expires||$date->getTimestamp()<=time())throw new \DomainException('Choose a future expiry or no expiry.');
            $expires=$date->format('Y-m-d H:i:s');
        }
        $q=$this->db->prepare("SELECT e.*,
            IF(e.feature_key='templates',(SELECT COUNT(*) FROM package_template_unlocks t WHERE t.entitlement_id=e.id),
            (SELECT COUNT(*) FROM package_use_reservations r WHERE r.entitlement_id=e.id AND (r.state='used' OR r.state='held' AND r.reserved_until>UTC_TIMESTAMP()))) AS consumed
            FROM package_entitlements e WHERE e.grant_id=? FOR UPDATE");$q->execute([$grant['id']]);$old=[];
        foreach($q->fetchAll() as $row)$old[$row['feature_key']]=$row;
        foreach($features as $key=>$limit)if($limit!==null&&$limit<(int)($old[$key]['consumed']??0))throw new \DomainException('The '.$key.' limit cannot be below uses or unlocks already consumed or reserved.');
        $this->db->prepare('UPDATE package_entitlements SET enabled=0 WHERE grant_id=?')->execute([$grant['id']]);
        $save=$this->db->prepare('INSERT INTO package_entitlements (grant_id,feature_key,included_uses,template_tiers,enabled) VALUES (?,?,?,?,1) ON DUPLICATE KEY UPDATE included_uses=VALUES(included_uses),template_tiers=VALUES(template_tiers),enabled=1');
        foreach($features as $key=>$limit)$save->execute([$grant['id'],$key,$limit,$key==='templates'?json_encode($tiers,JSON_THROW_ON_ERROR):null]);
        $this->db->prepare('UPDATE package_grants SET expires_at=?,version=version+1 WHERE id=?')->execute([$expires,$grant['id']]);
        // Disabled benefits and expired rights cannot fulfil an in-flight paid action.
        $this->releaseHolds((int)$grant['id'],true);
    }

    private function releaseHolds(int $grantId,bool $disabledOnly=false): void
    {
        $q=$this->db->prepare("UPDATE package_use_reservations r JOIN package_entitlements e ON e.id=r.entitlement_id SET r.state='released' WHERE e.grant_id=? AND r.state='held'".($disabledOnly?' AND e.enabled=0':''));$q->execute([$grantId]);
    }
}
