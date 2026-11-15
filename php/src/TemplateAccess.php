<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Template ownership is account-bound and recorded with the actual document write. */
final class TemplateAccess
{
    public function __construct(private readonly PDO $db) {}

    private function entitlements(int $userId,bool $lock=false): array
    {
        $q=$this->db->prepare("SELECT e.id,e.included_uses,e.template_tiers,g.package_name,g.expires_at
            FROM package_entitlements e JOIN package_grants g ON g.id=e.grant_id
            WHERE g.user_id=? AND e.feature_key='templates' AND g.revoked_at IS NULL AND e.enabled=1 AND (g.expires_at IS NULL OR g.expires_at>UTC_TIMESTAMP())
            ORDER BY e.included_uses IS NOT NULL,g.expires_at IS NULL,g.expires_at,g.id".($lock?' FOR UPDATE':''));
        $q->execute([$userId]);$rows=$q->fetchAll();
        if (!$rows) return [];
        $ids = array_column($rows, 'id');
        $unlocks = $this->db->prepare('SELECT entitlement_id,template_id FROM package_template_unlocks WHERE entitlement_id IN ('.implode(',', array_fill(0,count($ids),'?')).')');
        $unlocks->execute($ids);
        $owned = [];
        foreach ($unlocks->fetchAll() as $unlock) $owned[$unlock['entitlement_id']][] = $unlock['template_id'];
        foreach($rows as &$row){
            $row['tiers']=json_decode((string)($row['template_tiers']??'null'),true)??['basic','premium'];
            $row['unlocked'] = $owned[$row['id']] ?? [];
            $row['remaining']=$row['included_uses']===null?null:max(0,(int)$row['included_uses']-count($row['unlocked']));
        }
        return $rows;
    }

    private function permanentDesigns(int $userId): array
    {
        $q=$this->db->prepare('SELECT template_id FROM user_template_library WHERE user_id=?');$q->execute([$userId]);return $q->fetchAll(PDO::FETCH_COLUMN);
    }

    private function decision(string $id,array $price,array $entitlements,?string $current,array $permanent): array
    {
        if($id===$current)return ['allowed'=>true,'state'=>'current','label'=>'Current design','cost'=>0];
        if($price['unlocked'])return ['allowed'=>true,'state'=>'unlocked','label'=>'Gallery unlocked','cost'=>0];
        if($price['mode']==='free')return ['allowed'=>true,'state'=>'free','label'=>'Free access','cost'=>0];
        if($price['mode']!=='package_only'&&in_array($id,$permanent,true))return ['allowed'=>true,'state'=>'unlocked','label'=>'Already owned','cost'=>0];
        $tier=TemplateCatalog::get($id)['tier'];
        if(in_array($id,$permanent,true)&&array_filter($entitlements,static fn(array $e):bool=>in_array($tier,$e['tiers'],true)))return ['allowed'=>true,'state'=>'unlocked','label'=>'Already owned','cost'=>0];
        foreach($entitlements as $e)if(in_array($tier,$e['tiers'],true)&&in_array($id,$e['unlocked'],true))return ['allowed'=>true,'state'=>'unlocked','label'=>'Unlocked','cost'=>0];
        foreach($entitlements as $e)if(in_array($tier,$e['tiers'],true)&&($e['remaining']===null||$e['remaining']>0))return ['allowed'=>true,'state'=>'included','label'=>$e['remaining']===null?'Unlimited unlocks':$e['remaining'].' new unlock'.($e['remaining']===1?'':'s').' left','cost'=>0,'entitlementId'=>(int)$e['id'],'packageName'=>$e['package_name']];
        if($price['mode']==='unlock')return ['allowed'=>true,'state'=>'individual_unlock','label'=>'Unlock gallery','cost'=>$price['cost']];
        $supportsTier=(bool)array_filter($entitlements,static fn(array $e):bool=>in_array($tier,$e['tiers'],true));
        return ['allowed'=>false,'state'=>$supportsTier?'limit_reached':($entitlements?'tier_locked':'package_required'),'label'=>$supportsTier?'No new unlocks left':($tier==='premium'?'Premium access needed':'Basic access needed'),'cost'=>0];
    }

    public function catalogue(int $userId,?string $current=null,?array $price=null): array
    {
        $price??=(new FeaturePricing($this->db))->all($userId)['templates'];$rows=$this->entitlements($userId);$templates=[];$permanent=$this->permanentDesigns($userId);
        foreach(TemplateCatalog::all() as $template)$templates[$template['id']]=$this->decision($template['id'],$price,$rows,$current,$permanent);
        return ['mode'=>$price['mode'],'price'=>$price,'currentTemplate'=>$current,'items'=>$templates,'packages'=>array_map(static fn(array $e):array=>['name'=>$e['package_name'],'tiers'=>$e['tiers'],'limit'=>$e['included_uses']===null?null:(int)$e['included_uses'],'remaining'=>$e['remaining'],'unlocked'=>$e['unlocked'],'expiresAt'=>$e['expires_at']],$rows)];
    }

    /** Saved work remains readable; clean exports still require its current collection. */
    public function assertExport(int $userId,string $id): void
    {
        $price=(new FeaturePricing($this->db))->all($userId)['templates'];
        if($price['mode']==='free'||$price['unlocked'])return;
        $tier=TemplateCatalog::get($id)['tier'];
        $permanent=$this->permanentDesigns($userId);
        foreach($this->entitlements($userId) as $grant)if(in_array($tier,$grant['tiers'],true)&&(in_array($id,$grant['unlocked'],true)||in_array($id,$permanent,true)||$grant['remaining']===null||$grant['remaining']>0))return;
        if($price['mode']!=='package_only'&&in_array($id,$this->permanentDesigns($userId),true))return;
        throw new TemplateAccessDenied('Your current design is not included in your active template access. Choose an included design before downloading.');
    }

    /** Must run inside DocumentWriteGuard, so simultaneous unlocks share the account lock. */
    public function apply(int $userId,string $id,?string $current): void
    {
        if(!$this->db->inTransaction())throw new \LogicException('Template unlocks require a document transaction.');
        $price=(new FeaturePricing($this->db))->all($userId)['templates'];
        $decision=$this->decision($id,$price,$this->entitlements($userId,true),$current,$this->permanentDesigns($userId));
        if($decision['state']==='individual_unlock')throw new TemplateAccessDenied('Unlock the template gallery to use this design.',$price);
        if(!$decision['allowed'])throw new TemplateAccessDenied($decision['state']==='limit_reached'?'Your package has no new template unlocks left. Choose an unlocked design or view packages.':'Your package does not include this template collection. Choose an included design or view packages.');
        if(!isset($decision['entitlementId']))return;
        $this->db->prepare('INSERT INTO package_template_unlocks (entitlement_id,template_id) VALUES (?,?)')->execute([$decision['entitlementId'],$id]);
        (new AuditLogger($this->db))->log('package.template_unlocked','template',$id,['entitlementId'=>$decision['entitlementId']],'user',$userId);
        (new RealtimeEvents($this->db))->publish('store','user',$userId);
    }
}
