<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use PDOException;

final class Application
{
    private const ATS_REVIEW_VERSION = '2026-07-30.1';
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

    public function __construct(
        private readonly PDO $db,
        private readonly string $projectRoot,
    ) {
        $this->users = new UserRepository($db);
        $this->resumes = new ResumeRepository($db);
        $this->lookups = new LookupService(sys_get_temp_dir() . '/regen-lookups');
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
            (int) Config::get('email_verification.ttl', 3600)
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
        RateLimiter::configure($db);
    }

    public function run(): never
    {
        $method = Http::method();
        $path = Http::path();

        // Google Identity Services submits the redirect credential to this
        // endpoint. googleLogin() applies Google's required double-submit
        // cookie CSRF check before verifying the signed ID token.
        if (!($method === 'POST' && $path === '/api/auth/google')) {
            Http::requireSameOriginForMutation();
        }
        $publicAuthMutation = $method === 'POST' && in_array($path, [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/google',
            '/api/auth/email-verification/verify',
            '/api/auth/email-verification/resend',
        ], true);
        if (
            !$publicAuthMutation
            && !in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)
            && Session::authenticated()
        ) {
            Http::requireCsrfToken(Session::csrfToken());
        }

        if (in_array($method, ['GET', 'HEAD'], true) && $path === '/favicon.ico') {
            Http::redirect('/favicon.svg', 308);
        }

        if ($method === 'GET' && $path === '/api/health') {
            $this->health();
        }
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
            Session::destroy();
            Http::json(['success' => true]);
        }
        if ($path === '/api/auth/me' && $method === 'GET') {
            $this->me();
        }

        if (str_starts_with($path, '/api/')) {
            $this->requireAuth();
        }

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

        $this->servePage($path);
    }

    private function health(): never
    {
        try {
            foreach ([
                'users',
                'user_identities',
                'email_verification_tokens',
                'resumes',
                'app_rate_limits',
                'ai_usage_windows',
                'ai_usage_reservations',
            ] as $table) {
                $this->db->query('SELECT 1 FROM ' . $table . ' LIMIT 1');
            }
            if ((string) Config::get('session.driver', 'files') === 'database') {
                $this->db->query('SELECT 1 FROM app_sessions LIMIT 1');
            }
            Http::json(['success' => true, 'message' => 'ReGen API ready']);
        } catch (\Throwable) {
            Http::json(['success' => false, 'message' => 'Service unavailable'], 503);
        }
    }

    private function login(): never
    {
        $body = Http::jsonBody();
        $email = mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200));
        $password = (string) ($body['password'] ?? '');
        RateLimiter::enforce('login-ip', RateLimiter::clientIdentity(), 20, 900);
        RateLimiter::enforce('login-account', hash('sha256', $email), 8, 900);
        if ($email === '' || $password === '') {
            Http::json(['success' => false, 'message' => 'Email and password are required.'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::json(['success' => false, 'message' => 'Please enter a valid email address.'], 400);
        }
        $this->verifyRecaptchaFromBody($body, 'login', 'login');
        $user = $this->users->findByEmail($email);
        $validPassword = $user !== null
            ? $this->users->verifyPassword($password, $user)
            : $this->users->consumePasswordCheck($password);
        if ($user === null || !$validPassword) {
            Http::json(['success' => false, 'message' => 'Invalid email or password.'], 401);
        }
        if ($user['email_verified_at'] === null) {
            Http::json([
                'success' => false,
                'code' => 'EMAIL_NOT_VERIFIED',
                'verificationRequired' => true,
                'message' => 'Verify your email address before logging in.',
            ], 403);
        }

        $googleLinked = false;
        $pendingGoogle = Session::pendingGoogleIdentity();
        if ($pendingGoogle !== null) {
            if (hash_equals($email, mb_strtolower($pendingGoogle['email']))) {
                try {
                    $this->users->linkGoogleIdentity(
                        (int) $user['id'],
                        $pendingGoogle['subject'],
                        $pendingGoogle['email']
                    );
                    $googleLinked = true;
                } catch (PDOException $error) {
                    Session::clearPendingGoogleIdentity();
                    if ((string) $error->getCode() === '23000') {
                        Http::json([
                            'success' => false,
                            'message' => 'This ReGen account or Google account is already linked elsewhere.',
                        ], 409);
                    }
                    throw $error;
                }
            }
            Session::clearPendingGoogleIdentity();
        }

        Session::establish($user);
        Http::json([
            'success' => true,
            'authenticated' => true,
            'googleLinked' => $googleLinked,
            'csrfToken' => Session::csrfToken(),
            'user' => [
                'id' => (int) $user['id'],
                'firstName' => (string) $user['first_name'],
                'lastName' => (string) $user['last_name'],
                'email' => (string) $user['email'],
            ],
        ]);
    }

    private function register(): never
    {
        RateLimiter::enforce('register', RateLimiter::clientIdentity(), 10, 3600);
        $body = Http::jsonBody();
        $data = [
            'firstName' => Sanitizer::cleanText($body['firstName'] ?? '', false, 100),
            'lastName' => Sanitizer::cleanText($body['lastName'] ?? '', false, 100),
            'email' => mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200)),
            'phone' => Sanitizer::cleanText($body['phone'] ?? '', false, 30),
            'address' => Sanitizer::cleanText($body['address'] ?? '', false, 500),
            'password' => (string) ($body['password'] ?? ''),
        ];
        $confirm = (string) ($body['confirmPassword'] ?? '');
        $errors = [];
        if (mb_strlen(trim($data['firstName'])) < 2) {
            $errors[] = 'First name must be at least 2 characters.';
        }
        if (mb_strlen(trim($data['lastName'])) < 2) {
            $errors[] = 'Last name must be at least 2 characters.';
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Please enter a valid email address.';
        }
        if (strlen($data['password']) < 10) {
            $errors[] = 'Password must be at least 10 characters.';
        }
        if (strlen($data['password']) > 128) {
            $errors[] = 'Password must be 128 characters or fewer.';
        }
        if ($data['password'] !== $confirm) {
            $errors[] = 'Passwords do not match.';
        }
        if ($errors !== []) {
            Http::json(['success' => false, 'errors' => $errors], 400);
        }
        $recaptchaToken = is_string($body['recaptchaToken'] ?? null)
            ? $body['recaptchaToken']
            : '';
        $recaptchaAction = is_string($body['recaptchaAction'] ?? null)
            ? trim($body['recaptchaAction'])
            : '';
        $this->verifyRegistrationRecaptcha($recaptchaToken, $recaptchaAction);
        if (!$this->emailVerification->configured()) {
            Http::json([
                'success' => false,
                'message' => 'Email verification is temporarily unavailable. Please try again later.',
            ], 503);
        }
        if ($this->users->emailExists($data['email'])) {
            $this->users->consumePasswordCheck($data['password']);
            $this->registrationAccepted();
        }
        $token = EmailVerificationService::createToken();
        try {
            $user = $this->users->createUnverified(
                $data,
                EmailVerificationService::hashToken($token),
                $this->emailVerification->expiresAt()
            );
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') {
                $this->users->consumePasswordCheck($data['password']);
                $this->registrationAccepted();
            }
            throw $error;
        }
        if (!$this->emailVerification->send(
            (string) $user['email'],
            (string) $user['first_name'],
            $token
        )) {
            error_log('[Email Verification] Initial delivery was not accepted by the mail transport.');
        }
        $this->registrationAccepted();
    }

    private function registrationAccepted(): never
    {
        Http::json([
            'success' => true,
            'authenticated' => false,
            'verificationRequired' => true,
            'message' => 'Check your inbox for a verification link before logging in.',
        ], 202);
    }

    private function recaptchaConfig(): never
    {
        Http::json([
            'success' => true,
            'enabled' => $this->recaptcha->enabled(),
            'siteKey' => $this->recaptcha->publicSiteKey(),
        ]);
    }

    private function verifyRegistrationRecaptcha(string $token, string $action): void
    {
        $this->verifyRecaptcha($token, $action, 'register', 'registration');
    }

    /** @param array<string, mixed> $body */
    private function verifyRecaptchaFromBody(
        array $body,
        string $expectedAction,
        string $context,
    ): void {
        $token = is_string($body['recaptchaToken'] ?? null)
            ? $body['recaptchaToken']
            : '';
        $action = is_string($body['recaptchaAction'] ?? null)
            ? trim($body['recaptchaAction'])
            : '';
        $this->verifyRecaptcha($token, $action, $expectedAction, $context);
    }

    private function verifyRecaptcha(
        string $token,
        string $action,
        string $expectedAction,
        string $context,
    ): void {
        $required = RecaptchaService::requiredForEnvironment(
            (string) Config::get('app.env', 'production')
        );
        if (!$this->recaptcha->enabled()) {
            if ($required) {
                Http::json([
                    'success' => false,
                    'message' => ucfirst($context) . ' protection is temporarily unavailable. Please try again later.',
                ], 503);
            }
            return;
        }

        if ($action !== $expectedAction) {
            Http::json([
                'success' => false,
                'message' => 'We could not verify this ' . $context . ' request. Please refresh and try again.',
            ], 403);
        }
        $status = $this->recaptcha->verificationStatus($token, $expectedAction);
        if ($status === RecaptchaService::RESULT_UNAVAILABLE) {
            Http::json([
                'success' => false,
                'message' => ucfirst($context) . ' protection is temporarily unavailable. Please try again later.',
            ], 503);
        }
        if ($status !== RecaptchaService::RESULT_VALID) {
            Http::json([
                'success' => false,
                'message' => 'We could not verify this ' . $context . ' request. Please refresh and try again.',
            ], 403);
        }
    }

    private function verifyEmail(): never
    {
        RateLimiter::enforce('email-verify-ip', RateLimiter::clientIdentity(), 30, 900);
        $token = trim((string) (Http::jsonBody()['token'] ?? ''));
        if (!EmailVerificationService::validToken($token)) {
            Http::json([
                'success' => false,
                'code' => 'EMAIL_VERIFICATION_INVALID',
                'message' => 'This verification link is invalid.',
            ], 400);
        }
        $verified = $this->users->consumeVerificationToken(
            EmailVerificationService::hashToken($token)
        );
        if (!$verified) {
            Http::json([
                'success' => false,
                'code' => 'EMAIL_VERIFICATION_INVALID',
                'message' => 'This verification link is invalid, expired, or has already been used.',
            ], 410);
        }
        Http::json([
            'success' => true,
            'message' => 'Your email has been verified. You can now log in.',
        ]);
    }

    private function resendEmailVerification(): never
    {
        $body = Http::jsonBody();
        $email = mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::json([
                'success' => false,
                'message' => 'Please enter a valid email address.',
            ], 400);
        }
        RateLimiter::enforce('email-resend-ip', RateLimiter::clientIdentity(), 5, 3600);
        RateLimiter::enforce('email-resend-account', hash('sha256', $email), 3, 3600);
        $this->verifyRecaptchaFromBody(
            $body,
            'resend_verification',
            'email verification'
        );

        if (!$this->emailVerification->configured()) {
            Http::json([
                'success' => false,
                'message' => 'Email verification is temporarily unavailable. Please try again later.',
            ], 503);
        }

        $token = EmailVerificationService::createToken();
        $user = $this->users->issueVerificationTokenForEmail(
            $email,
            EmailVerificationService::hashToken($token),
            $this->emailVerification->expiresAt()
        );
        if (is_array($user)) {
            $this->emailVerification->send(
                (string) $user['email'],
                (string) $user['first_name'],
                $token
            );
        } else {
            // Keep the work profile closer to the account-present path without
            // retaining or logging any synthetic token data.
            hash('sha256', $token, true);
        }
        Http::json([
            'success' => true,
            'message' => 'If the account needs verification, a new link will be sent shortly.',
        ], 202);
    }

    private function googleConfig(): never
    {
        $loginUri = $this->googleLoginUri();
        Http::json([
            'success' => true,
            'enabled' => $this->google->enabled() && $loginUri !== '',
            'clientId' => $this->google->enabled()
                ? (string) Config::get('google.client_id', '')
                : '',
            'loginUri' => $loginUri,
        ]);
    }

    private function googleLogin(): never
    {
        RateLimiter::enforce('google-login', RateLimiter::clientIdentity(), 60, 900);
        $returnPage = (string) ($_POST['state'] ?? '') === 'register'
            ? '/register'
            : '/login';

        if (!$this->google->enabled() || $this->googleLoginUri() === '') {
            $this->googleFailureRedirect($returnPage, 'unavailable');
        }

        if (!GoogleIdentityService::validCsrfToken(
            (string) ($_COOKIE['g_csrf_token'] ?? ''),
            (string) ($_POST['g_csrf_token'] ?? '')
        )) {
            $this->googleFailureRedirect($returnPage, 'request');
        }

        $identity = $this->google->verify((string) ($_POST['credential'] ?? ''));
        if ($identity === null) {
            $this->googleFailureRedirect($returnPage, 'invalid');
        }

        try {
            $user = $this->users->findByIdentity('google', $identity['subject']);
            if ($user !== null) {
                // GoogleIdentityService accepts only an email_verified claim.
                $this->users->markEmailVerified((int) $user['id']);
                Session::clearPendingGoogleIdentity();
                Session::establish($user);
                Http::redirect('/dashboard', 303);
            }

            $existingUser = $this->users->findByEmail($identity['email']);
            if ($existingUser !== null) {
                Session::rememberPendingGoogleIdentity($identity);
                Http::redirect('/login?google_link=1', 303);
            }

            try {
                $user = $this->users->createFromGoogle($identity);
            } catch (PDOException $error) {
                if ((string) $error->getCode() !== '23000') {
                    throw $error;
                }

                // A simultaneous sign-in may have created the same account.
                $user = $this->users->findByIdentity('google', $identity['subject']);
                if ($user === null) {
                    $existingUser = $this->users->findByEmail($identity['email']);
                    if ($existingUser !== null) {
                        Session::rememberPendingGoogleIdentity($identity);
                        Http::redirect('/login?google_link=1', 303);
                    }
                    throw $error;
                }
            }

            Session::clearPendingGoogleIdentity();
            Session::establish($user);
            Http::redirect('/dashboard', 303);
        } catch (\Throwable $error) {
            error_log('[Google Auth Error] ' . $error::class . ': ' . $error->getMessage());
            $this->googleFailureRedirect($returnPage, 'server');
        }
    }

    private function me(): never
    {
        $this->requireAuth();
        $user = $this->users->findById(Session::userId());
        if ($user === null) {
            Session::destroy();
            Http::json(['success' => false, 'message' => 'Session expired.'], 401);
        }
        Http::json([
            'success' => true,
            'user' => $user,
            'userName' => (string) ($_SESSION['userName'] ?? ''),
            'csrfToken' => Session::csrfToken(),
        ]);
    }

    private function googleLoginUri(): string
    {
        $appUrl = rtrim((string) Config::get('app.url', ''), '/');
        if (
            $appUrl === ''
            || !filter_var($appUrl, FILTER_VALIDATE_URL)
            || !in_array((string) parse_url($appUrl, PHP_URL_SCHEME), ['http', 'https'], true)
        ) {
            return '';
        }
        return $appUrl . '/api/auth/google';
    }

    private function googleFailureRedirect(string $returnPage, string $code): never
    {
        $page = in_array($returnPage, ['/login', '/register'], true)
            ? $returnPage
            : '/login';
        Http::redirect($page . '?google_error=' . rawurlencode($code), 303);
    }

    private function listDashboard(): never
    {
        $primary = $this->resumes->getPrimaryByUser(Session::userId());
        Http::json([
            'success' => true,
            'data' => $this->resumes->getSummariesByUser(Session::userId()),
            'profile' => $primary === null ? null : $this->buildProfile($primary),
            'ai' => $this->aiStatusPayload(),
        ]);
    }

    private function createResume(): never
    {
        $user = $this->users->findById(Session::userId());
        if ($user === null) {
            Session::destroy();
            Http::json(['success' => false, 'message' => 'Session expired.'], 401);
        }
        $title = Sanitizer::cleanText(Http::jsonBody()['title'] ?? '', false, 200) ?: 'Untitled Resume';
        $resume = $this->resumes->getOrCreatePrimary(Session::userId(), $user, $title);
        Http::json(
            ['success' => true, 'data' => $resume],
            !empty($resume['existing']) ? 200 : 201
        );
    }

    private function renameResume(int $id): never
    {
        if ($id < 1) {
            Http::json(['success' => false, 'message' => 'Invalid resume ID.'], 400);
        }
        $title = Sanitizer::cleanText(Http::jsonBody()['title'] ?? '', false, 200);
        if ($title === '') {
            Http::json(['success' => false, 'message' => 'Title is required.'], 400);
        }
        if ($this->resumes->getById($id, Session::userId()) === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        $this->resumes->updateTitle($id, Session::userId(), $title);
        Http::json(['success' => true]);
    }

    private function getResume(int $id): never
    {
        $row = $this->resumeOr404($id);
        Http::json([
            'success' => true,
            'data' => $row['resume_data'],
            'title' => (string) $row['title'],
        ]);
    }

    private function saveSection(int $id): never
    {
        RateLimiter::enforce('resume-save', (string) Session::userId(), 180, 60);
        $this->resumeOr404($id);
        $body = Http::jsonBody();
        $section = (string) ($body['section'] ?? '');
        if (!Sanitizer::isAllowedSection($section)) {
            Http::json(['success' => false, 'message' => 'Invalid section.'], 400);
        }
        $rawData = $body['data'] ?? null;
        $encoded = json_encode($rawData);
        if (is_string($encoded) && strlen($encoded) > 512 * 1024) {
            Http::json(['success' => false, 'message' => 'Resume section is too large.'], 413);
        }
        $data = Sanitizer::sanitizeSection($section, $rawData);
        if ($section === 'personal' && is_array($data)) {
            unset($data['photoPath'], $data['photoBase64']);
            $ok = $this->resumes->savePersonal($id, Session::userId(), $data);
        } else {
            $ok = $this->resumes->saveSection($id, Session::userId(), $section, $data);
        }
        if (!$ok && $this->resumes->getById($id, Session::userId()) === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        Http::json(['success' => true]);
    }

    private function uploadPhoto(int $id): never
    {
        RateLimiter::enforce('photo-upload-user-minute', (string) Session::userId(), 6, 60);
        RateLimiter::enforce('photo-upload-ip-minute', RateLimiter::clientIdentity(), 20, 60);
        $this->resumeOr404($id);
        $upload = $_FILES['photo'] ?? null;
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            Http::json(['success' => false, 'message' => 'No file uploaded.'], 400);
        }
        $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            Http::json(['success' => false, 'message' => 'Photo must be smaller than 1.5MB.'], 413);
        }
        if ($error !== UPLOAD_ERR_OK) {
            Http::json(['success' => false, 'message' => 'Photo upload could not be processed.'], 400);
        }
        $size = (int) ($upload['size'] ?? 0);
        $tmp = (string) ($upload['tmp_name'] ?? '');
        if ($size < 12 || $size > 1536 * 1024 || !is_uploaded_file($tmp)) {
            Http::json([
                'success' => false,
                'message' => $size > 1536 * 1024
                    ? 'Photo must be smaller than 1.5MB.'
                    : 'Only valid JPG and PNG photos are accepted.',
            ], $size > 1536 * 1024 ? 413 : 400);
        }
        $bytes = file_get_contents($tmp);
        if (!is_string($bytes)) {
            Http::json(['success' => false, 'message' => 'Photo upload failed.'], 500);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $validJpeg = $mime === 'image/jpeg' && str_starts_with($bytes, "\xFF\xD8");
        $validPng = $mime === 'image/png' && str_starts_with($bytes, "\x89PNG\r\n\x1A\n");
        if (!$validJpeg && !$validPng) {
            Http::json(['success' => false, 'message' => 'Only valid JPG and PNG photos are accepted.'], 400);
        }
        $dimensions = @getimagesizefromstring($bytes);
        if (
            !is_array($dimensions)
            || (int) ($dimensions[0] ?? 0) < 1
            || (int) ($dimensions[1] ?? 0) < 1
            || (int) ($dimensions[0] ?? 0) > 6000
            || (int) ($dimensions[1] ?? 0) > 6000
            || ((int) $dimensions[0] * (int) $dimensions[1]) > 20000000
        ) {
            Http::json([
                'success' => false,
                'message' => 'Photo dimensions are invalid or too large.',
            ], 400);
        }
        $base64 = 'data:' . $mime . ';base64,' . base64_encode($bytes);
        $this->resumes->updatePhoto($id, Session::userId(), $base64);
        Http::json(['success' => true, 'photoBase64' => $base64]);
    }

    private function deletePhoto(int $id): never
    {
        $this->resumeOr404($id);
        $this->resumes->updatePhoto($id, Session::userId(), '');
        Http::json(['success' => true]);
    }

    private function aiStatus(): never
    {
        Http::json(['success' => true, ...$this->aiStatusPayload()]);
    }

    private function suggestResumeSection(int $id): never
    {
        RateLimiter::enforce(
            'ai-suggest-user-minute',
            (string) Session::userId(),
            max(1, (int) Config::get('openai.suggest_user_minute_limit', 8)),
            60
        );
        RateLimiter::enforce(
            'ai-suggest-ip-minute',
            RateLimiter::clientIdentity(),
            max(1, (int) Config::get('openai.suggest_ip_minute_limit', 24)),
            60
        );
        $row = $this->resumeOr404($id);

        $body = Http::jsonBody();
        $section = Sanitizer::cleanText($body['section'] ?? '', false, 40);
        $supported = [
            'summary' => true,
            'experience' => true,
            'projects' => true,
            'extracurricular' => true,
            'skills' => true,
            'achievements' => true,
            'certifications' => true,
        ];

        if (!isset($supported[$section])) {
            Http::json([
                'success' => false,
                'message' => 'This resume section cannot use AI assistance.',
            ], 400);
        }
        $resumeData = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $sectionData = $this->sanitizeAiSectionData($section, $body['data'] ?? null);
        $encodedSection = json_encode(
            $sectionData,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
        );
        if (!is_string($encodedSection) || strlen($encodedSection) > self::AI_SECTION_MAX_BYTES) {
            Http::json([
                'success' => false,
                'message' => 'This section contains too much text for one AI request.',
            ], 413);
        }
        if ($this->containsSensitiveAiText($encodedSection, $resumeData)) {
            Http::json([
                'success' => false,
                'message' => 'Remove contact or personal details before asking ReGen AI.',
            ], 422);
        }
        $professionalContext = $this->ats->safeAiContext($resumeData);
        if (!$this->hasAiSectionEvidence($section, $sectionData, $professionalContext)) {
            Http::json([
                'success' => false,
                'message' => match ($section) {
                    'summary', 'skills' => 'Add professional experience, project details, achievements, certifications, or a few skills first so ReGen has evidence to use.',
                    default => 'Add a short rough note first so ReGen can improve your facts without guessing.',
                },
            ], 422);
        }
        if (!$this->openai->enabled()) {
            Http::json([
                'success' => false,
                'message' => 'ReGen AI is not configured yet.',
                'quota' => $this->aiQuota->status(Session::userId()),
            ], 503);
        }

        $previous = [];
        if (is_array($body['previousSuggestion'] ?? null)) {
            $previous = $this->sanitizePreviousAiSuggestion(
                $section,
                $body['previousSuggestion']
            );
            $previousJson = json_encode(
                $previous,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            if (
                !is_string($previousJson)
                || strlen($previousJson) > self::AI_PREVIOUS_MAX_BYTES
                || $this->containsSensitiveAiText($previousJson, $resumeData)
            ) {
                $previous = [];
            }
        }

        $reservation = $this->aiQuota->consume(Session::userId());
        if (!$reservation['allowed']) {
            Http::json([
                'success' => false,
                'message' => $this->aiQuotaMessage($reservation),
                'quota' => $this->publicAiQuota($reservation),
            ], 429);
        }

        try {
            $suggestion = $this->openai->suggestSection(
                $section,
                $sectionData,
                $professionalContext,
                $previous,
                Session::userId()
            );
        } catch (OpenAIServiceException $error) {
            $this->refundAiRequest($reservation);
            $quota = $this->aiQuota->status(Session::userId());
            Http::json([
                'success' => false,
                'message' => $error->getMessage(),
                'quota' => $quota,
            ], $error->httpStatus());
        } catch (\Throwable $error) {
            $this->refundAiRequest($reservation);
            error_log('[ReGen AI] Unexpected section failure: ' . $error::class);
            Http::json([
                'success' => false,
                'message' => 'ReGen AI is temporarily unavailable. Please try again.',
                'quota' => $this->aiQuota->status(Session::userId()),
            ], 503);
        }

        $this->finalizeAiRequest($reservation);
        Http::json([
            'success' => true,
            'suggestion' => $suggestion,
            'quota' => $this->publicAiQuota($reservation),
        ]);
    }

    private function atsReviewState(int $id): never
    {
        $row = $this->resumeOr404($id);
        $resume = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $review = $this->ats->analyze($resume);
        $stored = is_array($resume['_regenReview'] ?? null) ? $resume['_regenReview'] : [];
        $sourceHash = AtsService::fingerprint($resume);
        $isCurrent = isset($stored['sourceHash'], $stored['reviewVersion'])
            && (string) $stored['reviewVersion'] === self::ATS_REVIEW_VERSION
            && hash_equals((string) $stored['sourceHash'], $sourceHash);
        $savedComment = $isCurrent && (bool) ($stored['aiEnhanced'] ?? false)
            ? Sanitizer::cleanText($stored['comment'] ?? '', true, 420)
            : '';

        $review['comment'] = $review['summary'];
        $review['aiEnhanced'] = false;
        $review['isCurrent'] = $isCurrent;
        $review['hasPriorReview'] = $stored !== [];
        $review['hasSavedAiComment'] = $savedComment !== '';
        $review['savedComment'] = $savedComment;
        $review['reviewedAt'] = $isCurrent ? (string) ($stored['reviewedAt'] ?? '') : '';
        $review['reviewVersion'] = self::ATS_REVIEW_VERSION;

        Http::json([
            'success' => true,
            'review' => $review,
            'aiEnabled' => $this->openai->enabled(),
            'quota' => $this->aiQuota->status(Session::userId()),
        ]);
    }

    private function atsReview(int $id): never
    {
        $row = $this->resumeOr404($id);
        $resume = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $review = $this->ats->analyze($resume);
        $sourceHash = AtsService::fingerprint($resume);
        $stored = is_array($resume['_regenReview'] ?? null) ? $resume['_regenReview'] : [];
        $storedComment = Sanitizer::cleanText($stored['comment'] ?? '', true, 420);
        $storedIsCurrent = $storedComment !== ''
            && (bool) ($stored['aiEnhanced'] ?? false)
            && (string) ($stored['reviewVersion'] ?? '') === self::ATS_REVIEW_VERSION
            && isset($stored['sourceHash'])
            && hash_equals((string) $stored['sourceHash'], $sourceHash);

        if ($storedIsCurrent) {
            $review['comment'] = $storedComment;
            $review['aiEnhanced'] = true;
            $review['sourceHash'] = $sourceHash;
            $review['reviewedAt'] = (string) ($stored['reviewedAt'] ?? '');
            $review['reviewVersion'] = self::ATS_REVIEW_VERSION;
            Http::json([
                'success' => true,
                'review' => $review,
                'cached' => true,
                'usedAiRequest' => false,
                'aiEnabled' => $this->openai->enabled(),
                'generationFailed' => false,
                'quotaExceeded' => false,
                'quota' => $this->aiQuota->status(Session::userId()),
            ]);
        }

        RateLimiter::enforce('ats-review-minute', (string) Session::userId(), 4, 60);
        RateLimiter::enforce('ats-review-hour', (string) Session::userId(), 20, 3600);
        $cacheKey = hash(
            'sha256',
            $id . '|' . $sourceHash . '|' . self::ATS_REVIEW_VERSION
        );
        $cached = Session::cachedAtsComment($cacheKey);
        $aiEnhanced = false;
        $usedAiRequest = false;
        $generationFailed = false;
        $quotaExceeded = false;
        $quota = $this->aiQuota->status(Session::userId());
        $reservation = null;

        if ($cached !== null) {
            $review['comment'] = $cached;
            $aiEnhanced = true;
        } elseif ($this->openai->enabled()) {
            $reservation = $this->aiQuota->consume(Session::userId());
            $quota = $this->publicAiQuota($reservation);
            if (!$reservation['allowed']) {
                $review['comment'] = $review['summary'];
                $generationFailed = true;
                $quotaExceeded = true;
            } else {
                $usedAiRequest = true;
                try {
                    $comment = $this->openai->atsComment(
                        $this->ats->safeAiContext($resume),
                        $review,
                        Session::userId()
                    );
                    Session::cacheAtsComment($cacheKey, $comment);
                    $review['comment'] = $comment;
                    $aiEnhanced = true;
                    $this->finalizeAiRequest($reservation);
                } catch (OpenAIServiceException) {
                    $this->refundAiRequest($reservation);
                    $quota = $this->aiQuota->status(Session::userId());
                    $usedAiRequest = false;
                    $review['comment'] = $review['summary'];
                    $generationFailed = true;
                } catch (\Throwable $error) {
                    $this->refundAiRequest($reservation);
                    $quota = $this->aiQuota->status(Session::userId());
                    $usedAiRequest = false;
                    $review['comment'] = $review['summary'];
                    $generationFailed = true;
                    error_log('[ReGen AI] Unexpected ATS failure: ' . $error::class);
                }
            }
        } else {
            $review['comment'] = $review['summary'];
        }

        $review['aiEnhanced'] = $aiEnhanced;
        $storedReview = $review;
        $storedReview['sourceHash'] = $sourceHash;
        $storedReview['reviewedAt'] = gmdate(DATE_ATOM);
        $storedReview['reviewVersion'] = self::ATS_REVIEW_VERSION;
        $this->resumes->saveAtsReview($id, Session::userId(), $storedReview);
        Http::json([
            'success' => true,
            'review' => $storedReview,
            'cached' => $cached !== null,
            'usedAiRequest' => $usedAiRequest,
            'aiEnabled' => $this->openai->enabled(),
            'generationFailed' => $generationFailed,
            'quotaExceeded' => $quotaExceeded,
            'message' => $quotaExceeded ? $this->aiQuotaMessage($quota) : '',
            'quota' => $quota,
        ]);
    }

    private function generatePdf(int $id): never
    {
        RateLimiter::enforce('pdf', (string) Session::userId(), 20, 60);
        $row = $this->resumeOr404($id);
        $resume = Sanitizer::sanitizeResume($row['resume_data']);
        $output = $this->pdf->generate($resume);
        $name = preg_replace('/[^a-z0-9_\- ]/i', '', (string) ($resume['personal']['fullName'] ?? $row['title']));
        $name = trim((string) preg_replace('/\s+/', '_', (string) $name)) ?: 'Resume';
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $name . '_Resume.pdf"');
        header('Content-Length: ' . strlen($output));
        echo $output;
        exit;
    }

    private function preview(int $id): never
    {
        $row = $this->resumeOr404($id);
        Http::html(ResumeTemplate::buildHtml($row['resume_data']));
    }

    private function previewDraft(int $id): never
    {
        $row = $this->resumeOr404($id);
        $incoming = Http::jsonBody()['resumeData'] ?? null;
        if (!is_array($incoming)) {
            Http::html('<p>Preview data is invalid.</p>', 400);
        }
        $stored = is_array($row['resume_data']) ? $row['resume_data'] : [];
        $merged = array_replace($stored, $incoming);
        $storedPersonal = is_array($stored['personal'] ?? null) ? $stored['personal'] : [];
        $incomingPersonal = is_array($incoming['personal'] ?? null) ? $incoming['personal'] : [];
        $merged['personal'] = array_replace($storedPersonal, $incomingPersonal);
        Http::html(ResumeTemplate::buildHtml($merged));
    }

    private function requireAuth(): void
    {
        if (!Session::authenticated()) {
            Http::json(['success' => false, 'message' => 'Not authenticated.'], 401);
        }
        $user = $this->users->findById(Session::userId());
        if ($user === null || $user['email_verified_at'] === null) {
            Session::destroy();
            Http::json([
                'success' => false,
                'message' => 'Your session is no longer valid. Please log in again.',
            ], 401);
        }
    }

    /**
     * @param array<string, mixed> $resume
     */
    private function containsSensitiveAiText(string $text, array $resume): bool
    {
        if (
            preg_match('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u', $text)
            || preg_match('/(?<!\d)(?:\+?\d[\s().-]*){8,15}(?!\d)/u', $text)
        ) {
            return true;
        }

        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        foreach (['fullName', 'email', 'phone', 'linkedin', 'address'] as $key) {
            $value = trim((string) ($personal[$key] ?? ''));
            if (mb_strlen($value) >= 5 && mb_stripos($text, $value) !== false) {
                return true;
            }
        }
        return false;
    }

    /** @return array<string, mixed> */
    private function aiStatusPayload(): array
    {
        return [
            'enabled' => $this->openai->enabled(),
            'provider' => 'OpenAI',
            'privacy' => 'Contact details, locations, photos, and references are excluded. Professional resume content is sent to OpenAI only after an explicit AI request.',
            'requestUnit' => 'Each section suggestion or new AI review uses one ReGen AI Token.',
            'quota' => $this->aiQuota->status(Session::userId()),
        ];
    }

    /** @param array<string, mixed> $quota */
    private function aiQuotaMessage(array $quota): string
    {
        $resetAt = trim((string) ($quota['resetAt'] ?? ''));
        $limit = max(1, (int) ($quota['limit'] ?? $this->aiQuota->limit()));
        return 'You have used all ' . $limit
            . ' ReGen AI Tokens for this 24-hour period. More tokens will be available on '
            . ($resetAt !== '' ? $resetAt : 'the next reset')
            . '.';
    }

    /** @param array<string, mixed> $quota */
    private function refundAiRequest(array $quota): void
    {
        try {
            $this->aiQuota->refund(
                Session::userId(),
                is_string($quota['windowStartedAt'] ?? null)
                    ? $quota['windowStartedAt']
                    : null,
                is_string($quota['reservationToken'] ?? null)
                    ? $quota['reservationToken']
                    : null
            );
        } catch (\Throwable $error) {
            error_log('[AI Quota] Request refund failed: ' . $error::class);
        }
    }

    /** @param array<string, mixed> $reservation */
    private function finalizeAiRequest(array $reservation): void
    {
        try {
            $this->aiQuota->finalize(
                Session::userId(),
                is_string($reservation['windowStartedAt'] ?? null)
                    ? $reservation['windowStartedAt']
                    : null,
                is_string($reservation['reservationToken'] ?? null)
                    ? $reservation['reservationToken']
                    : null
            );
        } catch (\Throwable $error) {
            error_log('[AI Quota] Request finalization failed: ' . $error::class);
        }
    }

    /**
     * @param array<string, mixed> $quota
     * @return array<string, mixed>
     */
    private function publicAiQuota(array $quota): array
    {
        return [
            'limit' => max(0, (int) ($quota['limit'] ?? 0)),
            'used' => max(0, (int) ($quota['used'] ?? 0)),
            'remaining' => max(0, (int) ($quota['remaining'] ?? 0)),
            'windowStartedAt' => is_string($quota['windowStartedAt'] ?? null)
                ? $quota['windowStartedAt']
                : null,
            'resetAt' => is_string($quota['resetAt'] ?? null)
                ? $quota['resetAt']
                : null,
            'exhausted' => (bool) ($quota['exhausted'] ?? false),
        ];
    }

    /** @param array<string, mixed> $value
     *  @return array<string, mixed>
     */
    private function sanitizePreviousAiSuggestion(string $section, array $value): array
    {
        $claimedSection = Sanitizer::cleanText($value['section'] ?? $section, false, 40);
        if ($claimedSection !== $section) {
            return [];
        }
        if ($section === 'summary') {
            return [
                'section' => $section,
                'summary' => Sanitizer::cleanText($value['summary'] ?? '', true, 1200),
            ];
        }
        if ($section === 'skills') {
            return [
                'section' => $section,
                'skills' => $this->sanitizeAiSectionData(
                    $section,
                    is_array($value['skills'] ?? null) ? $value['skills'] : []
                ),
            ];
        }
        $safe = $this->sanitizeAiSectionData($section, $value);
        return ['section' => $section, ...$safe];
    }

    /** @return array<string, mixed> */
    private function sanitizeAiSectionData(string $section, mixed $value): array
    {
        $data = is_array($value) ? $value : [];
        if ($section === 'summary') {
            return [
                'summary' => Sanitizer::cleanText($data['summary'] ?? '', true, 1200),
            ];
        }

        if (in_array($section, ['experience', 'projects', 'extracurricular'], true)) {
            $entries = [];
            $seenEntries = [];
            foreach (array_slice(is_array($data['entries'] ?? null) ? $data['entries'] : [], 0, 8) as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $index = max(0, min(50, (int) ($entry['index'] ?? count($entries))));
                if (isset($seenEntries[$index])) {
                    continue;
                }
                $seenEntries[$index] = true;
                $safe = ['index' => $index, 'bullets' => []];
                if ($section === 'experience') {
                    $safe['role'] = Sanitizer::cleanText($entry['role'] ?? '', false, 140);
                    $safe['company'] = Sanitizer::cleanText(
                        $entry['company'] ?? '',
                        false,
                        180
                    );
                    $safe['employmentType'] = Sanitizer::cleanText(
                        $entry['employmentType'] ?? '',
                        false,
                        80
                    );
                } elseif ($section === 'projects') {
                    $safe['title'] = Sanitizer::cleanText($entry['title'] ?? '', false, 160);
                    $safe['type'] = Sanitizer::cleanText($entry['type'] ?? '', false, 100);
                    $safe['description'] = Sanitizer::cleanText(
                        $entry['description'] ?? '',
                        true,
                        260
                    );
                } else {
                    $safe['role'] = Sanitizer::cleanText($entry['role'] ?? '', false, 140);
                    $safe['organization'] = Sanitizer::cleanText(
                        $entry['organization'] ?? '',
                        false,
                        180
                    );
                }

                $seenBullets = [];
                foreach (array_slice(is_array($entry['bullets'] ?? null) ? $entry['bullets'] : [], 0, 10) as $bullet) {
                    if (!is_array($bullet)) {
                        continue;
                    }
                    $bulletIndex = max(0, min(50, (int) ($bullet['index'] ?? count($safe['bullets']))));
                    $text = Sanitizer::cleanText($bullet['text'] ?? '', true, 320);
                    if ($text === '' || isset($seenBullets[$bulletIndex])) {
                        continue;
                    }
                    $seenBullets[$bulletIndex] = true;
                    $safe['bullets'][] = ['index' => $bulletIndex, 'text' => $text];
                }
                $hasProjectContext = $section === 'projects' && (
                    trim((string) ($safe['title'] ?? '')) !== ''
                    || trim((string) ($safe['type'] ?? '')) !== ''
                    || trim((string) ($safe['description'] ?? '')) !== ''
                );
                if ($safe['bullets'] !== [] || $hasProjectContext) {
                    $entries[] = $safe;
                }
            }
            return ['entries' => $entries];
        }

        if ($section === 'skills') {
            $custom = [];
            $seen = [];
            foreach (array_slice(is_array($data['custom'] ?? null) ? $data['custom'] : [], 0, 8) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $index = max(0, min(50, (int) ($item['index'] ?? count($custom))));
                if (isset($seen[$index])) {
                    continue;
                }
                $seen[$index] = true;
                $label = Sanitizer::cleanText($item['label'] ?? '', false, 80);
                $skillValue = Sanitizer::cleanText($item['value'] ?? '', false, 500);
                if ($label !== '' || $skillValue !== '') {
                    $custom[] = ['index' => $index, 'label' => $label, 'value' => $skillValue];
                }
            }
            return [
                'technical' => Sanitizer::cleanText($data['technical'] ?? '', false, 500),
                'software' => Sanitizer::cleanText($data['software'] ?? '', false, 500),
                'interpersonal' => Sanitizer::cleanText($data['interpersonal'] ?? '', false, 500),
                'language' => Sanitizer::cleanText($data['language'] ?? '', false, 500),
                'custom' => $custom,
            ];
        }

        $items = [];
        $seen = [];
        foreach (array_slice(is_array($data['items'] ?? null) ? $data['items'] : [], 0, 12) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $index = max(0, min(50, (int) ($item['index'] ?? count($items))));
            $text = Sanitizer::cleanText($item['text'] ?? '', true, 320);
            if ($text === '' || isset($seen[$index])) {
                continue;
            }
            $seen[$index] = true;
            $items[] = ['index' => $index, 'text' => $text];
        }
        return ['items' => $items];
    }

    /** @param array<string, mixed> $sectionData */
    private function hasAiSectionEvidence(
        string $section,
        array $sectionData,
        string $professionalContext,
    ): bool {
        if ($this->hasMeaningfulAiValue($sectionData)) {
            return true;
        }
        if (!in_array($section, ['summary', 'skills'], true)) {
            return false;
        }
        $decodedContext = json_decode($professionalContext, true);
        return $this->hasMeaningfulAiValue($decodedContext);
    }

    private function hasMeaningfulAiValue(mixed $value): bool
    {
        if (is_string($value)) {
            return mb_strlen(trim($value)) >= 2;
        }
        if (!is_array($value)) {
            return false;
        }
        foreach ($value as $item) {
            if ($this->hasMeaningfulAiValue($item)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param array<string, mixed> $resume
     */
    private function buildWritingContext(string $fieldType, mixed $localContext, array $resume): string
    {
        $allowedByField = [
            'summary' => [],
            'experience_bullet' => ['jobTitle', 'employmentType'],
            'project_description' => ['projectTitle', 'projectType'],
            'project_bullet' => ['projectTitle', 'projectType'],
            'extracurricular_bullet' => ['role'],
            'achievement' => [],
            'certification' => [],
            'skills_list' => ['skillCategory'],
        ];
        $local = is_array($localContext) ? $localContext : [];
        $safeLocal = [];
        foreach ($allowedByField[$fieldType] ?? [] as $key) {
            $value = Sanitizer::cleanText($local[$key] ?? '', false, 180);
            if ($value !== '') {
                $safeLocal[$key] = $value;
            }
        }

        $parts = [
            'Resume context (contact details, locations, personal information, and references excluded):',
            $this->ats->safeAiContext($resume),
        ];
        if ($safeLocal !== []) {
            $encoded = json_encode(
                $safeLocal,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            $parts[] = 'Current item context:';
            $parts[] = is_string($encoded) ? $encoded : '{}';
        }
        return mb_substr(implode("\n", $parts), 0, 14000);
    }

    /** @param array<string, mixed> $resume */
    private function hasSkillSuggestionEvidence(array $resume, string $draft): bool
    {
        if (mb_strlen(trim($draft)) >= 2) {
            return true;
        }
        $safe = Sanitizer::sanitizeResume($resume);
        $skills = is_array($safe['skills'] ?? null) ? $safe['skills'] : [];
        $sources = [
            $safe['summary'] ?? '',
            array_map(
                static fn (mixed $item): array => is_array($item)
                    ? ['bullets' => $item['bullets'] ?? []]
                    : [],
                is_array($safe['experience'] ?? null) ? $safe['experience'] : []
            ),
            array_map(
                static fn (mixed $item): array => is_array($item)
                    ? [
                        'description' => $item['description'] ?? '',
                        'bullets' => $item['bullets'] ?? [],
                    ]
                    : [],
                is_array($safe['projects'] ?? null) ? $safe['projects'] : []
            ),
            array_map(
                static fn (mixed $item): array => is_array($item)
                    ? ['bullets' => $item['bullets'] ?? []]
                    : [],
                is_array($safe['extracurricular'] ?? null) ? $safe['extracurricular'] : []
            ),
            $skills,
            $safe['achievements'] ?? [],
            $safe['certifications'] ?? [],
        ];
        $hasEvidence = false;
        array_walk_recursive($sources, static function (mixed $value) use (&$hasEvidence): void {
            if (!$hasEvidence && is_string($value) && mb_strlen(trim($value)) >= 2) {
                $hasEvidence = true;
            }
        });
        return $hasEvidence;
    }

    /** @return array<string, mixed> */
    private function resumeOr404(int $id): array
    {
        if ($id < 1) {
            Http::json(['success' => false, 'message' => 'Invalid resume ID.'], 400);
        }
        $row = $this->resumes->getById($id, Session::userId());
        if ($row === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        return $row;
    }

    private function servePage(string $path): never
    {
        if ($path === '/') {
            Http::redirect($this->hasVerifiedSession() ? '/dashboard' : '/login');
        }
        $pages = [
            '/login' => ['login.html', false],
            '/register' => ['register.html', false],
            '/verify-email' => ['verify-email.html', false],
            '/dashboard' => ['dashboard.html', true],
            '/builder' => ['builder.html', true],
        ];
        if (!isset($pages[$path])) {
            if (str_starts_with($path, '/api/')) {
                Http::json(['success' => false, 'message' => 'Not found'], 404);
            }
            Http::html('<h1>404</h1><p>Page not found.</p>', 404);
        }
        [$file, $protected] = $pages[$path];
        $authenticated = $this->hasVerifiedSession();
        if ($protected && !$authenticated) {
            Http::redirect('/login');
        }
        if (!$protected && $authenticated && $path !== '/verify-email') {
            Http::redirect('/dashboard');
        }
        $pathToFile = $this->projectRoot . '/public/' . $file;
        if (!is_file($pathToFile)) {
            $pathToFile = $this->projectRoot . '/' . $file;
        }
        if (!is_file($pathToFile)) {
            Http::html('<h1>500</h1><p>Page template is missing.</p>', 500);
        }
        Http::html((string) file_get_contents($pathToFile));
    }

    private function hasVerifiedSession(): bool
    {
        if (!Session::authenticated()) {
            return false;
        }
        $user = $this->users->findById(Session::userId());
        if ($user !== null && $user['email_verified_at'] !== null) {
            return true;
        }
        Session::destroy();
        return false;
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private function buildProfile(array $row): array
    {
        $data = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $personal = is_array($data['personal'] ?? null) ? $data['personal'] : [];
        $contactFields = ['fullName', 'jobTitle', 'email', 'phone', 'address'];
        $contactCount = count(array_filter(
            $contactFields,
            static fn (string $key): bool => trim((string) ($personal[$key] ?? '')) !== ''
        ));
        $hasSummary = trim((string) ($data['summary'] ?? '')) !== '';
        $hasEducation = is_array($data['education'] ?? null) && $data['education'] !== [];
        $hasExperience = is_array($data['experience'] ?? null) && $data['experience'] !== [];
        $hasProjects = is_array($data['projects'] ?? null) && $data['projects'] !== [];
        $skills = is_array($data['skills'] ?? null) ? $data['skills'] : [];
        $hasSkills = false;
        foreach (['technical', 'software', 'interpersonal', 'language'] as $key) {
            $hasSkills = $hasSkills || trim((string) ($skills[$key] ?? '')) !== '';
        }
        if (!$hasSkills && is_array($skills['custom'] ?? null)) {
            foreach ($skills['custom'] as $item) {
                if (is_array($item) && (
                    trim((string) ($item['label'] ?? '')) !== ''
                    || trim((string) ($item['value'] ?? '')) !== ''
                )) {
                    $hasSkills = true;
                    break;
                }
            }
        }
        $completion = (int) round(
            ($contactCount / count($contactFields)) * 40
            + ($hasSummary ? 15 : 0)
            + ($hasEducation ? 15 : 0)
            + (($hasExperience || $hasProjects) ? 15 : 0)
            + ($hasSkills ? 15 : 0)
        );
        $definitions = [
            ['personal', 'Personal information', $contactCount === count($contactFields), false],
            ['summary', 'Professional summary', $hasSummary, false],
            ['education', 'Education', $hasEducation, false],
            ['experience', 'Work experience', $hasExperience, true],
            ['projects', 'Projects', $hasProjects, true],
            ['extracurricular', 'Activities', is_array($data['extracurricular'] ?? null) && $data['extracurricular'] !== [], true],
            ['skills', 'Skills', $hasSkills, false],
            ['achievements', 'Achievements', is_array($data['achievements'] ?? null) && $data['achievements'] !== [], true],
            ['certifications', 'Certifications', is_array($data['certifications'] ?? null) && $data['certifications'] !== [], true],
            ['references', 'References', is_array($data['references'] ?? null) && $data['references'] !== [], true],
        ];
        $sections = [];
        $nextSection = 'personal';
        $foundNext = false;
        foreach ($definitions as [$id, $label, $complete, $optional]) {
            $sections[] = compact('id', 'label', 'complete', 'optional');
            if (!$foundNext && !$optional && !$complete) {
                $nextSection = $id;
                $foundNext = true;
            }
        }
        $localReview = $this->ats->analyze($data);
        $storedReview = is_array($data['_regenReview'] ?? null)
            ? $data['_regenReview']
            : [];
        $reviewIsCurrent = isset($storedReview['sourceHash'])
            && (string) ($storedReview['reviewVersion'] ?? '') === self::ATS_REVIEW_VERSION
            && hash_equals(
                (string) $storedReview['sourceHash'],
                AtsService::fingerprint($data)
            );
        if ($reviewIsCurrent) {
            $localReview['comment'] = Sanitizer::cleanText(
                $storedReview['comment'] ?? $storedReview['summary'] ?? $localReview['summary'],
                true,
                420
            );
            $localReview['aiEnhanced'] = (bool) ($storedReview['aiEnhanced'] ?? false);
            $localReview['reviewedAt'] = (string) ($storedReview['reviewedAt'] ?? '');
        } else {
            $localReview['comment'] = $localReview['summary'];
            $localReview['aiEnhanced'] = false;
            $localReview['reviewedAt'] = (string) ($storedReview['reviewedAt'] ?? '');
        }
        $localReview['isCurrent'] = $reviewIsCurrent;
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'updatedAt' => $row['updated_at'],
            'completion' => $completion,
            'nextSection' => $nextSection,
            'sections' => $sections,
            'atsReview' => $localReview,
            'personal' => [
                'fullName' => (string) ($personal['fullName'] ?? ''),
                'jobTitle' => (string) ($personal['jobTitle'] ?? ''),
                'email' => (string) ($personal['email'] ?? ''),
                'phone' => (string) ($personal['phone'] ?? ''),
                'address' => (string) ($personal['address'] ?? ''),
            ],
        ];
    }
}
