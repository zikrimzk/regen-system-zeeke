<?php
declare(strict_types=1);
namespace ReGen\Actions;

use ReGen\ {
    BonusCreditService, ConcurrentUpdate, FeaturePricing, HitPay, Http, PackageAccess, PageRenderer, RateLimiter, Sanitizer, Session, SupportConfiguration, TokenStore
};

trait CommerceActions
{
    private function commerceRoutes(string $path, string $method): void
    {
        try {
            $store = new TokenStore($this->db);
            $pricing = new FeaturePricing($this->db);
            if(preg_match('#^/api/admin/users/(\d+)/packages(?:/(\d+)/(adjust|replace|revoke))?$#D',$path,$m)){
                $service=new \ReGen\AccountPackages($this->db);
                if($method==='GET'&&empty($m[2]))Http::json(['success'=>true,...$service->overview((int)$m[1],(int)($_GET['page']??1))]);
                if($method==='POST'){
                    RateLimiter::enforce('account-package-change',(string)Session::adminId(),60,60);
                    Http::json(['success'=>true,...$service->change((int)$m[1],isset($m[2])?(int)$m[2]:null,$m[3]??'add',Http::jsonBody(),Session::adminId())]);
                }
            }
            if(preg_match('#^/api/admin/users/(\d+)/packages/catalogue$#D',$path,$m)&&$method==='GET')Http::json(['success'=>true,...$store->packages(true,(int)($_GET['page']??1))]);
            if ($path === '/api/admin/store' && $method === 'GET') {
                $list = ($_GET['view'] ?? '') === 'settings' ? [] : $store->packages(true,(int)($_GET['page']??1),false,null,null,null,($_GET['offers']??null)==='1');
                Http::json(['success'=>true,...$list,'policy'=>$store->policy(),'prices'=>$pricing->all(),
                    'checkoutMode'=>HitPay::available() ? HitPay::mode() : null]);
            }
            if ($path === '/api/admin/store/accounts' && $method === 'GET') {
                $search=Sanitizer::cleanText($_GET['search'] ?? '',false,120);
                if (mb_strlen($search)<2) Http::json(['success'=>true,'items'=>[]]);
                $q=$this->db->prepare("SELECT id,first_name,last_name,email FROM users WHERE email LIKE ? OR CONCAT(first_name,' ',last_name) LIKE ? ORDER BY id DESC LIMIT 10");
                $q->execute(['%'.$search.'%','%'.$search.'%']);Http::json(['success'=>true,'items'=>$q->fetchAll()]);
            }
            if (preg_match('#^/api/admin/store/packages/(\d+)/grant$#D',$path,$m) && $method === 'POST') Http::json(['success'=>true,'id'=>(new PackageAccess($this->db))->grant((int)$m[1],Http::jsonBody(),Session::adminId())],201);
            if ($path === '/api/admin/store/policy' && $method === 'PUT') {
                $store->savePolicy(Http::jsonBody(), Session::adminId());
                Http::json(['success' => true]);
            }
            if ($path === '/api/admin/store/packages' && $method === 'POST')Http::json(['success' => true, 'id' => $store->savePackage(null, Http::jsonBody(), Session::adminId())], 201);
            if (preg_match('#^/api/admin/store/packages/(\d+)$#D', $path, $m) && $method === 'PUT')Http::json(['success' => true, 'id' => $store->savePackage((int) $m[1], Http::jsonBody(), Session::adminId())]);
            if ($path === '/api/admin/pricing' && $method === 'GET')Http::json(['success' => true, 'prices' => $pricing->all()]);
            if (preg_match('#^/api/admin/pricing/([a-z_]+)$#D', $path, $m) && $method === 'PUT') {
                $pricing->save($m[1], Http::jsonBody(), Session::adminId());
                Http::json(['success' => true]);
            }
            if ($path === '/api/admin/settings/support-attachments') {
                $config = new SupportConfiguration($this->db);
                if ($method === 'GET')Http::json(['success' => true, 'limits' => $config->attachmentLimits()]);
                if ($method === 'PUT') {
                    $config->saveAttachmentLimits(Http::jsonBody(), Session::adminId());
                    Http::json(['success' => true]);
                }
            }
            if ($path === '/api/store' && $method === 'GET') {
                $policy = $store->policy();
                $feature = is_string($_GET['feature']??null)&&isset(FeaturePricing::CATALOGUE[$_GET['feature']])?$_GET['feature']:null;
                $userId = Session::userId();
                $empty = ['items'=>[],'total'=>0,'page'=>1,'pageSize'=>12];
                $sectionsOnly = ($_GET['view'] ?? '') === 'sections';
                $payload = [];
                if (!$sectionsOnly) {
                    $payload = $policy['enabled'] ? $store->packages(false,(int)($_GET['page']??1),false,$userId,null,$feature) : $empty;
                    $payload['wallet'] = ['wallet'=>(new BonusCreditService($this->db))->balance($userId)];
                }
                $grantCount = $this->db->prepare('SELECT COUNT(*) FROM package_grants WHERE user_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP())');
                $grantCount->execute([$userId]);
                Http::json(['success'=>true,...$payload,'feature'=>$feature,
                    'sections'=>$policy['enabled'] ? $store->sections(false,$userId,(int)($_GET['heroPage']??1),(int)($_GET['rowPage']??1),$feature) : ['hero'=>$empty,'row'=>$empty],
                    'policy'=>$policy,'checkoutAvailable'=>$policy['enabled'] && HitPay::available(),
                    'checkoutMode'=>HitPay::available() ? HitPay::mode() : null,
                    'balance'=>$store->balance($userId),'grants'=>(new PackageAccess($this->db))->grants($userId,(int)($_GET['grantPage']??1),10,false,true),
                    'grantTotal'=>(int)$grantCount->fetchColumn(),'prices'=>$pricing->all($userId)]);
            }
            if(preg_match('#^/api/store/packages/(\d+)/claim$#D',$path,$m)&&$method==='POST'){
                RateLimiter::enforce('package-claim',(string)Session::userId(),12,60);
                $version=filter_var(Http::jsonBody()['version']??null,FILTER_VALIDATE_INT);
                if($version===false)throw new \DomainException('Review the package before claiming.');
                Http::json(['success'=>true,...(new \ReGen\PackageClaims($this->db))->claim((int)$m[1],Session::userId(),$version)]);
            }
            if ($path === '/api/store/activity' && $method === 'GET') Http::json(['success'=>true,...$store->activity(Session::userId(),(int)($_GET['page'] ?? 1)),'balance'=>$store->balance(Session::userId()),'prices'=>$pricing->all(Session::userId()),'grants'=>(new PackageAccess($this->db))->grants(Session::userId())]);
            if ($path === '/api/store/prices' && $method === 'GET')Http::json(['success' => true, 'prices' => $pricing->all(Session::userId(),presentation:true), 'wallet' => (new BonusCreditService($this->db))->balance(Session::userId()),'balance'=>$store->balance(Session::userId())]);
            if ($path === '/api/store/access' && $method === 'POST') {
                RateLimiter::enforce('feature-access', (string)Session::userId(), 30, 60);
                $body = Http::jsonBody();
                Http::json(['success' => true, ...$pricing->purchase(Session::userId(), (string)($body['feature'] ?? ''), (int)($body['version'] ?? -1), (string)($body['reference'] ?? ''))]);
            }
            if (preg_match('#^/api/store/credits/(\d+)/refund$#D', $path, $m) && $method === 'POST') {
                $pricing->refund(Session::userId(), (int) $m[1]);
                Http::json(['success' => true]);
            }
        } catch (ConcurrentUpdate $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], 409);
        } catch (\OutOfBoundsException $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], 404);
        } catch (\DomainException $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], 422);
        }
    }

    private function templateAccessError(\ReGen\TemplateAccessDenied $error): never
    {
        Http::json(['success'=>false,'code'=>$error->price?'TOKEN_ACCESS_REQUIRED':'TEMPLATE_PACKAGE_REQUIRED','message'=>$error->getMessage(),'price'=>$error->price,'ignorePackageBenefits'=>$error->price!==null,'storeUrl'=>'/store'],$error->price?402:403);
    }

    private function packageAccessError(array $price,?string $path=null): never
    {
        $strict=$price['mode']==='package_only';$exhausted=!empty($price['packageIncluded']);
        $message=$strict?($exhausted?'Your package allowance for '.$price['name'].' is used up.':'Your active packages do not include '.$price['name'].'.'):'Review the Coin price to continue.';
        if($path!==null&&!str_starts_with($path,'/api/'))PageRenderer::render($this->projectRoot,'feature-access.html',['{{FEATURE_KEY}}'=>htmlspecialchars($price['key'],ENT_QUOTES,'UTF-8'),'{{FEATURE_NAME}}'=>htmlspecialchars($price['name'],ENT_QUOTES,'UTF-8'),'{{ACCESS_MESSAGE}}'=>htmlspecialchars($strict?'Explore a package with this feature to continue.':$message,ENT_QUOTES,'UTF-8'),'{{STORE_FEATURE}}'=>rawurlencode($price['key'])],$strict?403:402);
        Http::json(['success'=>false,'code'=>$strict?($exhausted?'PACKAGE_LIMIT_REACHED':'PACKAGE_ACCESS_REQUIRED'):'TOKEN_ACCESS_REQUIRED','message'=>$message,'price'=>$price,'storeUrl'=>'/store'],$strict?403:402);
    }

    private function enforceTokenAccess(string $path, string $method, ?array $explicitKeys = null): void
    {
        $keys = $explicitKeys ?? FeaturePricing::forRequest($path, $method);
        if (!$keys) return;
        if($method==='GET'&&in_array('pdf_download',$keys,true))Http::requireSameOriginForMutation(true);
        if (in_array('resume_create', $keys, true) && $this->resumes->getPrimaryByUser(Session::userId()) !== null) $keys = array_values(array_diff($keys, ['resume_create']));
        if (!$keys) return;
        $pricing = new FeaturePricing($this->db);
        $automaticPreview = $method === 'POST' && str_ends_with($path, '/document')
            && in_array('document_preview', $keys, true)
            && ($_SERVER['HTTP_X_REGEN_PREVIEW'] ?? '') === 'automatic';
        $access = $pricing->reserve(Session::userId(), $keys, $automaticPreview);
        if (!$access['allowed']) {
            $this->packageAccessError($access['price'],$path);
        }
        if ($access['reservations']) {
            Http::onSuccess(static function()use($pricing,$access):void{try{$pricing->settle($access['reservations'],true);}catch(\DomainException){Http::json(['success'=>false,'code'=>'ACCESS_CHANGED','message'=>'Your access changed before this action finished. Refresh and try again.'],403);}});
            register_shutdown_function(static function()use($pricing, $access): void {
            try {
                $pricing->settle($access['reservations'],false);
            } catch (\Throwable $error) {
                error_log('[Feature credit settlement] ' . $error::class);
            }
            });
        }
    }
}
