<?php
declare(strict_types=1);
namespace ReGen;

use PDO;

/** Claim capacity and the granted snapshot commit together. */
final class PackageClaims
{
    public function __construct(private readonly PDO $db) {}

    public static function state(array $package,int $count,bool $claimed=false,?int $now=null): array
    {
        $now??=time();$enabled=(bool)($package['claim_enabled']??false);
        $start=$package['claim_starts_at']??null;$end=$package['claim_ends_at']??null;
        $remaining=max(0,(int)($package['claim_limit']??0)-$count);
        $state='disabled';
        if($enabled){
            if(!(bool)$package['active']||!$start||!$end)$state='unavailable';
            elseif($now<strtotime($start.' UTC'))$state='upcoming';
            elseif($now>=strtotime($end.' UTC'))$state='ended';
            else $state=$remaining===0?'full':'available';
        }
        if($claimed)$state='claimed';
        return ['enabled'=>$enabled,'state'=>$state,'remaining'=>$remaining,'limit'=>(int)($package['claim_limit']??0),'startsAt'=>$start,'endsAt'=>$end,'claimed'=>$claimed];
    }

    public function claim(int $packageId,int $userId,int $version): array
    {
        $this->db->beginTransaction();
        try {
            // Same lock order as admin grants and wallet operations.
            (new BonusCreditService($this->db))->lock($userId);
            $q=$this->db->prepare('SELECT email_verified_at,account_status FROM users WHERE id=? FOR UPDATE');$q->execute([$userId]);$user=$q->fetch();
            if(!$user||!$user['email_verified_at']||$user['account_status']!=='active')throw new \DomainException('Verify your email before claiming a package.');
            $q=$this->db->prepare('SELECT * FROM token_packages WHERE id=? FOR UPDATE');$q->execute([$packageId]);$package=$q->fetch();
            if(!$package)throw new \OutOfBoundsException('Package not found.');
            $q=$this->db->prepare('SELECT grant_id FROM package_claims WHERE package_id=? AND user_id=?');$q->execute([$packageId,$userId]);
            if($previous=$q->fetch()){$this->db->commit();return ['id'=>(int)$previous['grant_id'],'duplicate'=>true];}
            if((int)$package['version']!==$version)throw new ConcurrentUpdate('This package changed. Review it before claiming.');
            if(!(new TokenStore($this->db))->policy()['enabled'])throw new \DomainException('Package claims are temporarily paused.');
            $q=$this->db->prepare('SELECT COUNT(*) FROM package_claims WHERE package_id=?');$q->execute([$packageId]);
            $state=self::state($package,(int)$q->fetchColumn());
            if($state['state']!=='available')throw new \DomainException(match($state['state']){'upcoming'=>'This claim period has not started.','ended'=>'This claim period has ended.','full'=>'All available claims have been taken.',default=>'This package is not available to claim.'});
            $id=(new PackageAccess($this->db))->grant($packageId,['userId'=>$userId,'version'=>$version,'reference'=>'claim-package-'.$packageId.'-account-'.$userId,'reason'=>'Free package claim'],null);
            $this->db->prepare('INSERT INTO package_claims (package_id,user_id,grant_id) VALUES (?,?,?)')->execute([$packageId,$userId,$id]);
            (new AuditLogger($this->db))->log('store.package_claimed','package_grant',$id,['packageId'=>$packageId],'user',$userId);
            (new RealtimeEvents($this->db))->publish('store','users');
            (new RealtimeEvents($this->db))->publish('store','admin');
            $this->db->commit();return ['id'=>$id,'duplicate'=>false];
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }
}
