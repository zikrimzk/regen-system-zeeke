<?php
declare(strict_types=1);

namespace ReGen;

use PDO;

final class Application
{
    use Actions\AuthActions;
    use Actions\ProfileActions;
    use Actions\AdminActions;
    use Actions\ResumeActions;
    use Actions\DocumentActions;
    use Actions\AiActions;
    use Actions\ControlCentreActions;
    use Actions\InsightActions;
    use Actions\AdminWorkspaceActions;
    use Actions\LiveActions;
    use Actions\CommerceActions;
    use Actions\PaymentActions;

    private const ATS_REVIEW_VERSION = '2026-10-30.2';
    private const AI_SECTION_MAX_BYTES = 40 * 1024;
    private const AI_PREVIOUS_MAX_BYTES = 12 * 1024;

    private UserRepository $users;
    private ResumeRepository $resumes;
    private LookupService $lookups;
    private PdfService $pdf;
    private GoogleIdentityService $google;
    private RecaptchaService $recaptcha;
    private EmailVerificationService $emailVerification;
    private OpenAIService $openai;
    private AiQuotaService $aiQuota;
    private AtsService $ats;
    private AccountRepository $accounts;
    private AdminRepository $admins;
    private AuditLogger $audit;
    private EmailDeliveryRepository $emailDeliveries;
    private bool $userAuthorized = false;
    private ?array $activeAdmin = null;

    public function __construct(
        private readonly PDO $db,
        private readonly string $projectRoot,
        private readonly ?MochiCoach $mochiCoach = null,
    ) {
        $this->users = new UserRepository($db);
        $this->resumes = new ResumeRepository($db);
        $this->lookups = new LookupService(Storage::directory('cache/lookups'));
        $this->pdf = new PdfService();
        $this->google = new GoogleIdentityService(
            (string) Config::get('google.client_id', '')
        );
        $appUrl = (string) Config::get('app.url', '');
        $this->recaptcha = new RecaptchaService(
            (string) Config::get('recaptcha.site_key', ''),
            (string) Config::get('recaptcha.secret_key', ''),
            (float) Config::get('recaptcha.min_score', 0.5),
            null,
            (string) parse_url($appUrl, PHP_URL_HOST)
        );
        $this->emailVerification = new EmailVerificationService(
            $appUrl,
            (string) Config::get('app.env', 'production'),
            (string) Config::get('mail.from_email', ''),
            (string) Config::get('mail.from_name', 'ReGen'),
            (string) Config::get('mail.reply_to', ''),
            (int) Config::get('email_verification.ttl', 3600),
            null,
            new SmtpMailer(
                (string) Config::get('mail.smtp_host', ''),
                (int) Config::get('mail.smtp_port', 587),
                (string) Config::get('mail.smtp_username', ''),
                (string) Config::get('mail.smtp_password', ''),
                (string) Config::get('mail.smtp_encryption', 'tls'),
                (int) Config::get('mail.smtp_timeout', 15)
            ),
            (string) Config::get('mail.transport', 'smtp')
        );
        $this->openai = new OpenAIService(
            (string) Config::get('openai.api_key', ''),
            (string) Config::get('openai.model', 'gpt-5.4-mini')
        );
        $this->aiQuota = new AiQuotaService(
            $db,
            (int) Config::get('openai.daily_limit', AiQuotaService::DAILY_LIMIT)
        );
        $this->ats = new AtsService();
        $this->accounts = new AccountRepository($db);
        $this->admins = new AdminRepository($db);
        $this->audit = new AuditLogger($db);
        $this->emailDeliveries = new EmailDeliveryRepository($db);
        new OperationsMonitor($db);
        RateLimiter::configure($db);
    }

    private function maxActiveSessions(): int
    {
        return max(1, min(20, (int) ($this->admins->settings()['maxActiveSessions'] ?? 5)));
    }

    public function run(): never
    {
        $method = Http::method();
        $path = Http::path();
        $webhookMode = Routes::webhookMode($path, $method);
        if ($webhookMode !== null) {
            PaymentWebhookController::serve($this->db, $webhookMode);
        }
        RequestAudit::start($this->db);
        (new OperationsMonitor($this->db))->enforceBlock();
        $this->liveRoutes($path, $method);
        (new MaintenanceController(new MaintenanceService($this->db)))->enforce($this->projectRoot, $path, $method);
        $legacyPage = Routes::legacyPage($path, $method);
        if ($legacyPage !== null) {
            Http::redirect(Routes::pageUrl($legacyPage, (string) ($_SERVER['REQUEST_URI'] ?? $path)));
        }

        // GOOGLE IDENTITY SERVICES SUBMITS THE REDIRECT CREDENTIAL TO THIS
        // ENDPOINT. GOOGLELOGIN() APPLIES GOOGLE'S REQUIRED DOUBLE-SUBMIT
        // COOKIE CSRF CHECK BEFORE VERIFYING THE SIGNED ID TOKEN.
        if (!($method === 'POST' && $path === '/api/auth/google')) {
            Http::requireSameOriginForMutation();
        }
        if (
            !Routes::publicAuthMutation($path, $method)
            && !in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)
            && (Session::authenticated() || Session::adminAuthenticated())
        ) {
            Http::requireCsrfToken(Session::csrfToken());
        }

        if (in_array($method, ['GET', 'HEAD'], true) && $path === '/favicon.ico') {
            Http::redirect('/img/favicon-logo.png', 308);
        }

        if ($method === 'GET' && $path === '/api/health') {
            ReadinessController::serve($this->db);
        }
        if ($path === '/api/capabilities' && $method === 'GET') $this->controlCentreRoutes($path, $method);
        if ($path === '/api/auth/password-reset' && $method === 'POST') $this->controlCentreRoutes($path, $method);
        if (!Routes::adminApi($path)) $this->enforceFeatureRoute($path, $method);
        if ($path === '/api/auth/login' && $method === 'POST') {
            $this->login();
        }
        if ($path === '/api/auth/register' && $method === 'POST') {
            $this->register();
        }
        if ($path === '/api/auth/email-verification/verify' && $method === 'POST') {
            $this->verifyEmail();
        }
        if ($path === '/api/auth/email-verification/resend' && $method === 'POST') {
            $this->resendEmailVerification();
        }
        if ($path === '/api/auth/recaptcha/config' && $method === 'GET') {
            $this->recaptchaConfig();
        }
        if ($path === '/api/auth/google/config' && $method === 'GET') {
            $this->googleConfig();
        }
        if ($path === '/api/auth/google' && $method === 'POST') {
            $this->googleLogin();
        }
        if ($path === '/api/auth/logout' && $method === 'POST') {
            $this->audit->log('auth.logout');
            if (Session::authenticated()) $this->accounts->revokeCurrentSession(Session::userId());
            Session::destroy();
            Http::json(['success' => true]);
        }
        if ($path === '/api/auth/me' && $method === 'GET') {
            $this->me();
        }
        if ($path === '/api/auth/activity' && $method === 'POST') {
            $this->requireAuth();
            Session::recordUserActivity();
            Http::json(['success'=>true]);
        }

        if ($path === '/api/admin/auth/login' && $method === 'POST') {
            $this->adminLogin();
        }
        if ($path === '/api/admin/auth/logout' && $method === 'POST') {
            $this->requireAdmin();
            $this->audit->log('admin.logout');
            Session::destroy();
            Http::json(['success' => true]);
        }
        if (Routes::adminApi($path)) {
            $activeAdmin = $this->requireAdmin();
            $passwordSetupRoutes = ['/api/admin/me', '/api/admin/password', '/api/admin/auth/logout'];
            if (
                (int) ($activeAdmin['must_change_password'] ?? 0) === 1
                && !in_array($path, $passwordSetupRoutes, true)
            ) {
                Http::json([
                    'success' => false,
                    'code' => 'ADMIN_PASSWORD_CHANGE_REQUIRED',
                    'message' => 'Change the bootstrap password before using the control centre.',
                ], 428);
            }
            if (!(new AdminAccess($this->db))->allows($activeAdmin, $path, $method)) {
                $this->audit->log('security.admin_permission_denied', 'route', $path);
                Http::json(['success'=>false, 'message'=>'Your administrator account does not have access to this module.'], 403);
            }
            $this->paymentRoutes($path,$method);
            $this->commerceRoutes($path,$method);
            $this->workspaceRoutes($path,$method);
            $this->adminLiveRoutes($path,$method);
            $this->insightRoutes($path, $method);
            $this->controlCentreRoutes($path, $method);
            if ($path === '/api/admin/settings/bootstrap-access' && $method === 'PUT') $this->adminBootstrapAccess();
            if ($path === '/api/admin/me' && $method === 'GET') $this->adminMe();
            if ($path === '/api/admin/dashboard' && $method === 'GET') $this->adminDashboard();
            if ($path === '/api/admin/users' && $method === 'GET') $this->adminUsers();
            if ($path === '/api/admin/users' && $method === 'POST') $this->adminCreateUserAccount();
            if (preg_match('#^/api/admin/users/(\d+)$#', $path, $matches) && $method === 'PATCH') {
                $this->adminUpdateUser((int) $matches[1]);
            }
            if (preg_match('#^/api/admin/users/(\d+)/reset-quota$#', $path, $matches) && $method === 'POST') {
                $this->adminResetQuota((int) $matches[1]);
            }
            if ($path === '/api/admin/settings/ai' && $method === 'GET') $this->adminAiSettings();
            if ($path === '/api/admin/settings/ai' && $method === 'PUT') $this->adminUpdateAiSettings();
            if ($path === '/api/admin/settings/system' && $method === 'GET') $this->adminSystemSettings();
            if ($path === '/api/admin/settings/system' && $method === 'PUT') $this->adminUpdateSystemSettings();
            if ($path === '/api/admin/settings/mochi' && $method === 'PUT') $this->adminUpdateMochi();
            if ($path === '/api/admin/settings/mochi' && $method === 'GET') $this->adminMochi();
            if (preg_match('#^/api/admin/settings/mochi/user/([1-9][0-9]{0,9})$#D', $path, $match)
                && in_array($method,['GET','PUT'],true)) $this->adminMochiAccount((int)$match[1], $method);
            if ($path === '/api/admin/email' && $method === 'GET') $this->adminEmailStatus();
            if ($path === '/api/admin/email/test' && $method === 'POST') $this->adminEmailTest();
            if (preg_match('#^/api/admin/users/(\d+)/revoke-sessions$#', $path, $matches) && $method === 'POST') {
                $this->adminRevokeUserSessions((int) $matches[1]);
            }
            if ($path === '/api/admin/operations/revoke-all-sessions' && $method === 'POST') $this->adminRevokeAllSessions();
            if ($path === '/api/admin/admins' && $method === 'GET') $this->adminListAdmins();
            if ($path === '/api/admin/admins' && $method === 'POST') $this->adminCreateAdmin();
            if (preg_match('#^/api/admin/admins/(\d+)/status$#', $path, $matches) && $method === 'PATCH') {
                $this->adminUpdateAdminStatus((int) $matches[1]);
            }
            if ($path === '/api/admin/password' && $method === 'PUT') $this->adminChangePassword();
            if ($path === '/api/admin/audit' && $method === 'GET') $this->adminAuditLogs();
            Http::json(['success' => false, 'message' => 'Admin endpoint not found.'], 404);
        }

        if (str_starts_with($path, '/api/')) {
            $this->requireAuth();
            if (str_starts_with($path, '/api/mochi/')) $this->mochiRoutes($path, $method);
            $this->paymentRoutes($path,$method);
            $this->commerceRoutes($path,$method);
            $this->enforceTokenAccess($path,$method);
        }
        if (str_starts_with($path, '/api/notifications') || str_starts_with($path, '/api/support/')) $this->controlCentreRoutes($path, $method);
        if (str_starts_with($path, '/api/campaigns')) $this->workspaceRoutes($path,$method);
        if (str_starts_with($path, '/api/feedback')) $this->insightRoutes($path, $method);

        if ($path === '/api/profile' && $method === 'GET') $this->profile();
        if ($path === '/api/profile/photo' && $method === 'GET') $this->profilePhoto();
        if ($path === '/api/profile' && $method === 'PATCH') $this->updateProfile();
        if ($path === '/api/profile/password' && $method === 'PUT') $this->changePassword();
        if ($path === '/api/profile/email' && $method === 'PUT') $this->changeProfileEmail();
        if ($path === '/api/profile/sessions' && $method === 'GET') $this->profileSessions();
        if ($path === '/api/profile/sessions/history' && $method === 'DELETE') $this->clearProfileSessionHistory();
        if (preg_match('#^/api/profile/sessions/(\d+)$#', $path, $matches) && $method === 'DELETE') {
            $this->revokeProfileSession((int) $matches[1]);
        }
        if ($path === '/api/profile/account' && $method === 'DELETE') $this->deleteProfileAccount();

        if ($path === '/api/dashboard' && $method === 'GET') {
            $this->listDashboard();
        }
        if ($path === '/api/dashboard' && $method === 'POST') {
            $this->createResume();
        }
        if (preg_match('#^/api/dashboard/(\d+)/title$#', $path, $matches) && $method === 'PATCH') {
            $this->renameResume((int) $matches[1]);
        }
        if (preg_match('#^/api/dashboard/(\d+)$#', $path) && $method === 'DELETE') {
            Http::json([
                'success' => false,
                'message' => 'Each account keeps one resume. Edit the existing resume instead of deleting it.',
            ], 405);
        }

        if (preg_match('#^/api/resume/(\d+)$#', $path, $matches) && $method === 'GET') {
            $this->getResume((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/section$#', $path, $matches) && $method === 'POST') {
            $this->saveSection((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/photo$#', $path, $matches) && $method === 'POST') {
            $this->uploadPhoto((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/photo$#', $path, $matches) && $method === 'DELETE') {
            $this->deletePhoto((int) $matches[1]);
        }
        if ($path === '/api/ai/status' && $method === 'GET') {
            $this->aiStatus();
        }
        if (preg_match('#^/api/resume/(\d+)/ai-assist$#', $path, $matches) && $method === 'POST') $this->assistResumeSection((int) $matches[1]);
        if (preg_match('#^/api/resume/(\d+)/ai-suggest$#', $path, $matches) && $method === 'POST') {
            $this->suggestResumeSection((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/ats-review$#', $path, $matches) && $method === 'GET') {
            $this->atsReviewState((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/ats-review$#', $path, $matches) && $method === 'POST') {
            $this->atsReview((int) $matches[1]);
        }

        if (preg_match('#^/api/pdf/(\d+)/generate$#', $path, $matches) && $method === 'GET') {
            $this->generatePdf((int) $matches[1]);
        }
        if (preg_match('#^/api/pdf/(\d+)/document$#', $path, $matches) && in_array($method, ['GET','POST'], true)) {
            $this->previewDocument((int) $matches[1], $method === 'POST');
        }
        if (preg_match('#^/api/pdf/(\d+)/preview$#', $path, $matches) && $method === 'GET') {
            $this->preview((int) $matches[1]);
        }
        if (preg_match('#^/api/pdf/(\d+)/preview-data$#', $path, $matches) && $method === 'POST') {
            $this->previewDraft((int) $matches[1]);
        }

        if ($path === '/api/lookups/institutions' && $method === 'GET') {
            RateLimiter::enforce('lookup-user-minute', (string) Session::userId(), 30, 60);
            RateLimiter::enforce('lookup-ip-minute', RateLimiter::clientIdentity(), 80, 60);
            Http::json([
                'success' => true,
                'results' => $this->lookups->institutions(
                    (string) ($_GET['q'] ?? ''),
                    (string) ($_GET['country'] ?? 'Malaysia')
                ),
            ]);
        }
        if ($path === '/api/lookups/locations' && $method === 'GET') {
            RateLimiter::enforce('lookup-user-minute', (string) Session::userId(), 30, 60);
            RateLimiter::enforce('lookup-ip-minute', RateLimiter::clientIdentity(), 80, 60);
            Http::json([
                'success' => true,
                'results' => $this->lookups->locations(
                    (string) ($_GET['q'] ?? ''),
                    (string) ($_GET['country'] ?? 'Worldwide')
                ),
            ]);
        }

        if ($path === '/api/templates' && $method === 'GET') {
            $userId = Session::userId();
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            $current = $this->resumes->primaryDesign($userId);
            $prices = (new FeaturePricing($this->db))->all($userId);
            Http::json([
                'success'=>true,'data'=>(new TemplateManagement($this->db))->catalogue(),
                'primaryResumeId'=>isset($current['id']) ? (int)$current['id'] : null,
                'access'=>(new TemplateAccess($this->db))->catalogue($userId,$current['template_id']??null,$prices['templates']),
                'prices'=>$prices,
            ]);
        }
        if ($method === 'GET' && preg_match('#^/api/templates/([a-z]+)/preview$#', $path, $templateMatch)) {
            if (!(new TemplateManagement($this->db))->selectable($templateMatch[1])) Http::html('Template not found.', 404);
            Http::html(TemplateCatalog::browserHtml(ResumeTemplate::buildHtml(TemplateCatalog::sample($templateMatch[1]))));
        }
        if ($path === '/api/cover-letters' || preg_match('#^/api/cover-letters/(\d+)(?:/(ai-suggest|preview|pdf|document))?$#', $path)) $this->coverLetters($path, $method);

        $this->servePage($path);
    }

    private function mochiRoutes(string $path, string $method): never
    {
        $userId = (int)Session::userId();
        $policy = new MochiPolicy($this->db);
        $settings = $policy->settings();
        $account = $policy->account($userId);
        $available = MochiPolicy::available($settings) && $account['mode'] !== 'off';
        $dailyTokens = MochiPolicy::dailyLimit($settings, $account);
        $packages = new PackageAccess($this->db);
        $benefits = $available ? $packages->benefits($userId, [MochiCoach::FEATURE, MochiPolicy::PLAY, MochiPolicy::CHAT]) : [];
        $legacy = ($benefits[MochiCoach::FEATURE]['unlocked'] ?? false) === true;
        $chatBenefit = $benefits[MochiPolicy::CHAT] ?? null;
        $unlimited = $legacy || ($chatBenefit['unlocked'] ?? false);
        $chatAllowed = $account['mode'] !== 'play-only' && ($unlimited || ($chatBenefit['uses'] ?? 0) > 0);
        $access = $legacy || isset($benefits[MochiPolicy::PLAY]) || $chatBenefit !== null;
        $profiles = new MochiProfile($this->db);
        $coach = $this->mochiCoach ?? new MochiCoach(new OpenAIService(
            (string) Config::get('openai.api_key', ''),
            (string) Config::get('mochi.model', MochiCoach::DEFAULT_MODEL),
        ));
        if ($path === '/api/mochi/status' && $method === 'GET') {
            Http::json(['success'=>true, 'access'=>$access, 'available'=>$available, 'chatAllowed'=>$chatAllowed,
                'health'=>$settings['health'], 'autoplay'=>$settings['autoplay'], 'sound'=>$settings['sound'],
                'editorReactions'=>$settings['editorReactions'], 'playOnly'=>$account['mode']==='play-only',
                'pace'=>$settings['pace'],'naps'=>$settings['naps'],'liveFeedback'=>$settings['liveFeedback'],'feedbackSeconds'=>$settings['feedbackSeconds'],
                'liveAvailable'=>$chatAllowed && $dailyTokens > 0 && $settings['dailyBudget'] > 0 && $coach->enabled(),
                'profile'=>$access ? $profiles->get($userId) : null, 'csrfToken'=>Session::csrfToken()]);
        }
        if (!$available) Http::json(['success'=>false, 'reason'=>'unavailable'], 503);
        if (!$access) Http::json(['success'=>false, 'reason'=>'package'], 403);
        $bodyLimit = $path === '/api/mochi/chat' ? 125000 : 28000;
        if (Http::contentLength() > $bodyLimit) Http::json(['success'=>false], 413);
        if ($path === '/api/mochi/preferences' && $method === 'PUT') {
            RateLimiter::enforce('mochi-preferences-minute', (string)$userId, 30, 60);
            $body = Http::jsonBody();
            if (!$chatAllowed && ($body['action'] ?? null) === 'live') Http::json(['success'=>false, 'reason'=>'chat_package'],403);
            if (($body['action'] ?? null) === 'nap' && !$settings['naps']) Http::json(['success'=>true,'profile'=>$profiles->get($userId)]);
            if (($body['action'] ?? null) === 'live' && ($body['enabled'] ?? false) && !$settings['liveFeedback']) Http::json(['success'=>false,'reason'=>'off'],409);
            try {
                $profile = $profiles->save($userId,$body);
            } catch (\DomainException $error) {
                Http::json(['success'=>false, 'message'=>$error->getMessage()],422);
            }
            Http::json(['success'=>true, 'profile'=>$profile]);
        }
        if ($method !== 'POST' || !in_array($path,['/api/mochi/comment','/api/mochi/chat'],true)) Http::json(['success'=>false], 404);
        if (!$chatAllowed) Http::json(['success'=>false, 'reason'=>'chat_package'], 403);
        $isChat = $path === '/api/mochi/chat';
        $responseKey = $isChat ? 'reply' : 'comment';
        $profile = $profiles->get($userId);
        if ((int)($profile['napUntil'] ?? 0)>time()) {
            Http::json(['success'=>false, 'reason'=>'nap'],409);
        }
        if ($profile['asleep'] || (!$isChat && (!$profile['live'] || !$settings['liveFeedback']))) {
            Http::json(['success'=>false, 'reason'=>$profile['asleep'] ? 'asleep' : 'off'],409);
        }
        if (!$coach->enabled()) Http::json(['success'=>true, $responseKey=>null, 'reason'=>'unavailable']);
        if ($dailyTokens === 0 || $settings['dailyBudget'] === 0) Http::json(['success'=>true, $responseKey=>null, 'reason'=>'daily']);
        $input = $isChat ? MochiCoach::chatInput(Http::jsonBody()) : MochiCoach::input(Http::jsonBody());
        if ($input === null) Http::json(['success'=>false], 422);
        if ($isChat && !MochiCoach::writingRequest($input)) Http::json(['success'=>true,'reply'=>null,'reason'=>'local']);
        RateLimiter::enforce($isChat ? 'mochi-chat-minute' : 'mochi-user-minute', (string)$userId, $isChat ? 10 : 1, $isChat ? 60 : $settings['feedbackSeconds']);
        // A slow model must not hold the session lock and delay editor saves.
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        $lock = "CONCAT('regen:mochi:', LEFT(SHA2(DATABASE(),256),16), ':', $userId)";
        if ((int)$this->db->query("SELECT GET_LOCK($lock,0)")->fetchColumn() !== 1) {
            Http::json(['success'=>true, $responseKey=>null, 'reason'=>'busy']);
        }
        $reservation = null;
        try {
            if (!$unlimited && !($reservation = $packages->reserve($userId, MochiPolicy::CHAT))) {
                $result = [$responseKey=>null, 'reason'=>'chat_package'];
            } elseif (!$policy->takeToken($userId, $dailyTokens, $settings['dailyBudget'])) {
                $result = [$responseKey=>null, 'reason'=>'daily'];
            } else {
                if ($isChat && $input['useSavedResume']) {
                    $resume = $this->resumes->getPrimaryByUser($userId);
                    $input['savedResume'] = $resume
                        ? json_decode($this->ats->safeAiContext($resume['resume_data']),true) : null;
                }
                $result = $isChat ? $coach->chat($input, $profile, $userId) : $coach->respond($input, $profile, $userId);
            }
        } catch (OpenAIServiceException $error) {
            $result = [$responseKey=>null, 'reason'=>$error->httpStatus() === 429 ? 'busy' : 'unavailable'];
        } finally {
            try {
                $completed = isset($result[$responseKey])
                    && (!$isChat || !in_array($result['kind'] ?? null,['question','outside'],true));
                if ($reservation) $packages->settle($reservation, $completed);
            } finally {
                $this->db->query("SELECT RELEASE_LOCK($lock)")->fetchColumn();
            }
        }
        Http::json(['success'=>true, ...($result ?? [$responseKey=>null, 'reason'=>'unavailable'])]);
    }



    private function requireAdmin(): array
    {
        $hadSession = Session::adminAuthenticated();
        $admin = $this->verifiedAdmin();
        if ($admin === null) {
            Http::json(['success' => false,
                'message' => $hadSession ? 'Admin session is no longer valid.' : 'Admin authentication required.'], 401);
        }
        return $admin;
    }

    private function verifiedAdmin(): ?array
    {
        if ($this->activeAdmin !== null) return $this->activeAdmin;
        if (!Session::adminAuthenticated()) return null;
        $admin = $this->admins->findById(Session::adminId());
        if ($admin === null || ($admin['status'] ?? '') !== 'active'
            || ((bool) ($admin['is_bootstrap'] ?? false) && !$this->admins->settings()['bootstrapAdminEnabled'])) {
            Session::destroy();
            return null;
        }
        return $this->activeAdmin = $admin;
    }

    private function requireAuth(): void
    {
        $hadSession = Session::authenticated();
        if (!$this->hasVerifiedSession()) {
            Http::json([
                'success' => false,
                'message' => $hadSession ? 'Your session is no longer valid. Please log in again.' : 'Not authenticated.',
            ], 401);
        }
    }

    private function servePage(string $path): never
    {
        if ($path === '/') PublicSite::dispatch($this->projectRoot);
        if (!isset(Routes::PAGES[$path])) {
            if (str_starts_with($path, '/api/')) Http::json(['success'=>false, 'message'=>'Not found'], 404);
            PageRenderer::render($this->projectRoot, 'not-found.html', [], 404);
        }

        [$file, $group] = Routes::PAGES[$path];
        if ($group === 'admin' || $group === 'admin-auth') {
            $admin = $this->verifiedAdmin();
            if ($group === 'admin' && $admin === null) Http::redirect('/admin/login', 303);
            if ($group === 'admin-auth' && $admin !== null) Http::redirect('/admin', 303);
            PageRenderer::render($this->projectRoot, $file);
        }

        $authenticated = $this->hasVerifiedSession();
        if ($group === 'candidate') {
            if (!$authenticated) {
                if (session_status() !== PHP_SESSION_ACTIVE) {
                    Session::start(Config::get('session.driver', 'files') === 'database' ? $this->db : null);
                }
                Session::rememberCandidateReturn((string) ($_SERVER['REQUEST_URI'] ?? $path));
                Http::redirect('/login');
            }
            $this->enforceTokenAccess($path, Http::method());
        } elseif ($authenticated && in_array($path, ['/login', '/register'], true)) {
            Http::redirect('/dashboard');
        }
        PageRenderer::render($this->projectRoot, $file);
    }

    private function hasVerifiedSession(): bool
    {
        if ($this->userAuthorized) return true;
        if (!Session::authenticated()) return false;
        $user = $this->users->findById(Session::userId());
        if ($user === null || $user['email_verified_at'] === null || ($user['account_status'] ?? 'active') !== 'active'
            || !$this->accounts->currentSessionActive(Session::userId(), $this->maxActiveSessions())) {
            Session::destroy();
            return false;
        }
        return $this->userAuthorized = true;
    }
}
