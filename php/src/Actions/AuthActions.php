<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\Config;
use ReGen\EmailVerificationService;
use ReGen\GoogleIdentityService;
use ReGen\Http;
use ReGen\RateLimiter;
use ReGen\RecaptchaService;
use ReGen\Sanitizer;
use ReGen\Session;
use PDOException;

trait AuthActions
{
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
            $this->audit->log('auth.login_failed', 'account', null, ['emailHash' => hash('sha256', $email)]);
            Http::json(['success' => false, 'message' => 'Invalid email or password.'], 401);
        }
        if (($user['account_status'] ?? 'active') !== 'active') {
            $this->audit->log('auth.login_blocked', 'user', (int) $user['id'], ['status' => $user['account_status']]);
            Http::json(['success' => false, 'message' => 'This account is not active. Contact support.'], 403);
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

        Session::establish($user, ($body['rememberMe'] ?? false) === true);
        $this->accounts->trackSession((int) $user['id'], $this->maxActiveSessions());
        $this->audit->log('auth.login_success', 'user', (int) $user['id']);
        Http::json([
            'success' => true,
            'authenticated' => true,
            'googleLinked' => $googleLinked,
            'redirect' => Session::afterLoginPath(),
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
        if (!(bool) ($this->admins->settings()['registrationEnabled'] ?? true)) {
            Http::json(['success' => false, 'message' => 'New account registration is currently closed.'], 403);
        }
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
        $delivered = $this->emailVerification->send(
            (string) $user['email'],
            (string) $user['first_name'],
            $token
        );
        $this->emailDeliveries->record('registration_verification', (string) $user['email'], (string) Config::get('mail.transport', 'smtp'), $delivered);
        if (!$delivered) {
            error_log('[Email Verification] Initial delivery was not accepted by the mail transport.');
            $this->audit->log('auth.registration_email_failed', 'user', (int) $user['id']);
            Http::json([
                'success' => true,
                'authenticated' => false,
                'verificationRequired' => true,
                'deliveryFailed' => true,
                'message' => 'Your account was created, but the verification email could not be delivered. Contact support or try Resend after email delivery is restored.',
            ], 202);
        }
        $this->registrationAccepted();
    }

    private function registrationAccepted(): never
    {
        $this->audit->log('auth.registration_accepted');
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
        $this->audit->log('auth.email_verified');
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
            $delivered = $this->emailVerification->send(
                (string) $user['email'],
                (string) $user['first_name'],
                $token
            );
            $this->emailDeliveries->record('verification_resend', (string) $user['email'], (string) Config::get('mail.transport', 'smtp'), $delivered);
        } else {
            // KEEP THE WORK PROFILE CLOSER TO THE ACCOUNT-PRESENT PATH WITHOUT
            // RETAINING OR LOGGING ANY SYNTHETIC TOKEN DATA.
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
        $allowed = (bool) ($this->admins->settings()['googleLoginEnabled'] ?? true);
        Http::json([
            'success' => true,
            'enabled' => $allowed && $this->google->enabled() && $loginUri !== '',
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

        if (!(bool) ($this->admins->settings()['googleLoginEnabled'] ?? true)
            || !$this->google->enabled() || $this->googleLoginUri() === '') {
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
        $remember = $returnPage === '/login' && ($_COOKIE['regen_remember_google'] ?? '') === '1';
        if (isset($_COOKIE['regen_remember_google'])) {
            setcookie('regen_remember_google', '', ['expires'=>1, 'path'=>'/api/auth/google', 'secure'=>true, 'samesite'=>'None']);
        }

        try {
            if (Session::authenticated()) {
                $current = $this->users->findById(Session::userId());
                if ($current === null || mb_strtolower((string) $current['email']) !== mb_strtolower($identity['email'])) {
                    Http::redirect('/profile?google=account_mismatch', 303);
                }
                $this->users->linkGoogleIdentity(Session::userId(), $identity['subject'], $identity['email']);
                $this->audit->log('profile.google_linked', 'user', Session::userId());
                Http::redirect('/profile?google=linked', 303);
            }
            $user = $this->users->findByIdentity('google', $identity['subject']);
            if ($user !== null) {
                if (($user['account_status'] ?? 'active') !== 'active') {
                    $this->googleFailureRedirect($returnPage, 'blocked');
                }
                // GOOGLEIDENTITYSERVICE ACCEPTS ONLY AN EMAIL_VERIFIED CLAIM.
                $this->users->markEmailVerified((int) $user['id']);
                Session::clearPendingGoogleIdentity();
                Session::establish($user, $remember);
                $this->accounts->trackSession((int) $user['id'], $this->maxActiveSessions());
                $this->audit->log('auth.google_login_success', 'user', (int) $user['id']);
                Http::redirect(Session::afterLoginPath(), 303);
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

                // A SIMULTANEOUS SIGN-IN MAY HAVE CREATED THE SAME ACCOUNT.
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
            Session::establish($user, $remember);
            $this->accounts->trackSession((int) $user['id'], $this->maxActiveSessions());
            $this->audit->log('auth.google_login_success', 'user', (int) $user['id']);
            Http::redirect(Session::afterLoginPath(), 303);
        } catch (\Throwable $error) {
            \ReGen\ErrorReporter::report($error, 'google.account');
            $this->googleFailureRedirect($returnPage, 'server');
        }
    }

    private function me(): never
    {
        $this->requireAuth();
        $user = $this->users->findById(Session::userId());
        $settings = $this->admins->settings();
        if ($user === null) {
            Session::destroy();
            Http::json(['success' => false, 'message' => 'Session expired.'], 401);
        }
        Http::json([
            'success' => true,
            'user' => $user,
            'userName' => (string) ($_SESSION['userName'] ?? ''),
            'avatarUrl' => $this->resumes->accountPhoto(Session::userId()) !== '' ? '/api/profile/photo' : '',
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
}
