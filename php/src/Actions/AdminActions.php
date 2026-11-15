<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\Config;
use ReGen\AiQuotaService;
use ReGen\EmailVerificationService;
use ReGen\Http;
use ReGen\MochiPolicy;
use ReGen\RateLimiter;
use ReGen\Sanitizer;
use ReGen\Session;
use PDOException;

trait AdminActions
{
    private function adminBootstrapAccess(): never
    {
        $current = $this->admins->findById(Session::adminId());
        $body = Http::jsonBody();
        if (!is_bool($body['enabled'] ?? null)) Http::json(['success' => false, 'message' => 'Choose whether temporary access is enabled.'], 422);
        $enabled = $body['enabled'];
        if ((bool) ($current['is_bootstrap'] ?? false)) Http::json(['success' => false, 'message' => 'Sign in with a personal admin account to manage temporary access.'], 403);
        if ($enabled) $this->requireSuperAdmin();
        try { $this->admins->setBootstrapAccess($enabled, Session::adminId()); }
        catch (\DomainException $error) { Http::json(['success' => false, 'message' => $error->getMessage()], 422); }
        $this->audit->log('admin.bootstrap_access_updated', 'settings', 'bootstrap_admin_enabled', ['enabled' => $enabled]);
        Http::json(['success' => true, 'enabled' => $enabled]);
    }

    private function adminSystemSettings(): never
    {
        Http::json(['success' => true, 'settings' => $this->admins->settings()]);
    }

    private function adminMochi(): never
    {
        $policy = new MochiPolicy($this->db);
        $settings = $policy->settings();
        Http::json(['success'=>true, 'mochi'=>$settings, 'available'=>MochiPolicy::available($settings),'usedToday'=>$policy->usedToday()]);
    }

    private function adminMochiAccount(int $userId, string $method): never
    {
        if (!$this->users->findById($userId)) Http::json(['success'=>false, 'message'=>'Account not found.'],404);
        $policy = new MochiPolicy($this->db);
        if ($method === 'PUT') {
            try {
                $account = $policy->saveAccount($userId, Http::jsonBody(), Session::adminId());
            } catch (\DomainException $error) {
                Http::json(['success'=>false, 'message'=>$error->getMessage()],422);
            }
            $this->audit->log('admin.mochi_account_updated', 'user', $userId, $account);
        } else {
            $account = $policy->account($userId);
        }
        $limit = MochiPolicy::dailyLimit($policy->settings(), $account);
        Http::json(['success'=>true,'account'=>$account,'limit'=>$limit,'usedToday'=>$policy->usedToday($userId)]);
    }

    private function adminUpdateMochi(): never
    {
        try {
            $policy = new MochiPolicy($this->db);
            $settings = $policy->save(Http::jsonBody(), Session::adminId());
        } catch (\DomainException $error) {
            Http::json(['success'=>false, 'message'=>$error->getMessage()],422);
        }
        $this->audit->log('admin.mochi_settings_updated', 'settings', 'mochi', $settings);
        Http::json(['success'=>true, 'mochi'=>$settings, 'available'=>MochiPolicy::available($settings),'usedToday'=>$policy->usedToday()]);
    }

    private function adminUpdateSystemSettings(): never
    {
        $body = Http::jsonBody();
        $supportEmail = mb_strtolower(Sanitizer::cleanText($body['supportEmail'] ?? '', false, 200));
        if ($supportEmail !== '' && !filter_var($supportEmail, FILTER_VALIDATE_EMAIL)) {
            Http::json(['success' => false, 'message' => 'Support email is invalid.'], 422);
        }
        $settings = [
            'appName' => Sanitizer::cleanText($body['appName'] ?? 'ReGen', false, 60) ?: 'ReGen',
            'supportEmail' => $supportEmail,
            'registrationEnabled' => filter_var($body['registrationEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'googleLoginEnabled' => filter_var($body['googleLoginEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'userSelfDeleteEnabled' => filter_var($body['userSelfDeleteEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'profileEmailChangeEnabled' => filter_var($body['profileEmailChangeEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'maxActiveSessions' => max(1, min(20, (int) ($body['maxActiveSessions'] ?? 5))),
            'auditRetentionDays' => max(30, min(730, (int) ($body['auditRetentionDays'] ?? 180))),
        ];
        $before = $this->admins->settings();
        $this->admins->updateSystemSettings($settings, Session::adminId());
        $beforeSystem = [];
        foreach (array_keys($settings) as $key) {
            $beforeSystem[$key] = $before[$key] ?? null;
        }
        $this->audit->log('admin.system_settings_updated', 'settings', 'system', [
            'before' => $beforeSystem,
            'after' => $settings,
        ]);
        Http::json(['success' => true, 'settings' => $settings]);
    }

    private function adminEmailStatus(): never
    {
        Http::json([
            'success' => true,
            'status' => $this->emailVerification->status(),
            'recent' => $this->emailDeliveries->recent(50),
        ]);
    }

    private function adminEmailTest(): never
    {
        RateLimiter::enforce('admin-email-test', (string) Session::adminId(), 5, 3600);
        $email = mb_strtolower(Sanitizer::cleanText(Http::jsonBody()['email'] ?? '', false, 200));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::json(['success' => false, 'message' => 'Enter a valid destination email.'], 422);
        }
        $delivered = $this->emailVerification->sendTest($email);
        $this->emailDeliveries->record('admin_delivery_test', $email, (string) Config::get('mail.transport', 'smtp'), $delivered);
        $this->audit->log('admin.email_delivery_tested', 'email', hash('sha256', $email), ['accepted' => $delivered]);
        Http::json([
            'success' => $delivered,
            'message' => $delivered
                ? 'The SMTP server accepted the test message. Check the inbox and spam folder.'
                : ($this->emailVerification->status()['smtpConfigurationHint']
                    ?? 'Delivery failed. Check the SMTP stage in the server error log.'),
        ], $delivered ? 200 : 502);
    }

    private function adminRevokeUserSessions(int $userId): never
    {
        if ($this->admins->userById($userId) === null) Http::json(['success' => false, 'message' => 'User not found.'], 404);
        $count = $this->accounts->revokeAllForUser($userId);
        $this->audit->log('admin.user_sessions_revoked', 'user', $userId, ['sessionsRevoked' => $count]);
        Http::json(['success' => true, 'sessionsRevoked' => $count]);
    }

    private function adminRevokeAllSessions(): never
    {
        $this->requireSuperAdmin();
        $body = Http::jsonBody();
        if ((string) ($body['confirmation'] ?? '') !== 'SIGN OUT ALL USERS') {
            Http::json(['success' => false, 'message' => 'Confirmation phrase does not match.'], 422);
        }
        $count = $this->accounts->revokeAllUsers();
        $this->audit->log('admin.all_user_sessions_revoked', 'system', 'sessions', ['sessionsRevoked' => $count]);
        Http::json(['success' => true, 'sessionsRevoked' => $count]);
    }

    private function adminLogin(): never
    {
        RateLimiter::enforce('admin-login-ip', RateLimiter::clientIdentity(), 8, 900);
        $body = Http::jsonBody();
        $email = mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200));
        $password = (string) ($body['password'] ?? '');
        $admin = $this->admins->findByEmail($email);
        if ($admin === null || !$this->admins->verifyPassword($password, $admin)) {
            $this->audit->log('admin.login_failed', 'admin_account', null, ['emailHash' => hash('sha256', $email)]);
            Http::json(['success' => false, 'message' => 'Invalid admin email or password.'], 401);
        }
        if (($admin['status'] ?? '') !== 'active' || ((bool) ($admin['is_bootstrap'] ?? false) && !$this->admins->settings()['bootstrapAdminEnabled'])) {
            Http::json(['success' => false, 'message' => 'This admin account is disabled.'], 403);
        }
        Session::establishAdmin($admin);
        $this->admins->recordLogin((int) $admin['id']);
        $this->audit->log('admin.login_success', 'admin', (int) $admin['id']);
        Http::json(['success' => true, 'csrfToken' => Session::csrfToken()]);
    }

    private function adminMe(): never
    {
        Http::json([
            'success' => true,
            'admin' => $this->admins->findById(Session::adminId()),
            'permissions' => (new \ReGen\AdminAccess($this->db))->permissions($this->admins->findById(Session::adminId())),
            'capabilities' => (new \ReGen\AdminAccess($this->db))->capabilities($this->admins->findById(Session::adminId())),
            'csrfToken' => Session::csrfToken(),
        ]);
    }

    private function adminDashboard(): never
    {
        Http::json([
            'success' => true,
            'metrics' => $this->admins->metrics(),
            'settings' => $this->admins->settings(),
        ]);
    }

    private function adminUsers(): never
    {
        $search = Sanitizer::cleanText($_GET['search'] ?? '', false, 120);
        $page = max(1, (int) ($_GET['page'] ?? 1));
        Http::json(['success' => true, ...$this->admins->users($search, $page, 25)]);
    }

    private function adminCreateUserAccount(): never
    {
        RateLimiter::enforce('admin-user-create', (string) Session::adminId(), 20, 3600);
        if (!$this->emailVerification->configured()) {
            Http::json([
                'success' => false,
                'message' => 'Email delivery must be configured before an administrator can create a user.',
            ], 503);
        }
        $body = Http::jsonBody();
        $data = [
            'firstName' => Sanitizer::cleanText($body['firstName'] ?? '', false, 100),
            'lastName' => Sanitizer::cleanText($body['lastName'] ?? '', false, 100),
            'email' => mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200)),
            'phone' => Sanitizer::cleanText($body['phone'] ?? '', false, 30),
            'address' => '',
            'password' => (string) ($body['password'] ?? ''),
        ];
        if (
            mb_strlen($data['firstName']) < 2
            || mb_strlen($data['lastName']) < 2
            || filter_var($data['email'], FILTER_VALIDATE_EMAIL) === false
            || strlen($data['password']) < 10
            || strlen($data['password']) > 128
        ) {
            Http::json([
                'success' => false,
                'message' => 'Enter a valid name, email and temporary password of 10 to 128 characters.',
            ], 422);
        }
        if ($this->users->emailExists($data['email'])) {
            Http::json(['success' => false, 'message' => 'That email address is already registered.'], 409);
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
                Http::json(['success' => false, 'message' => 'That email address is already registered.'], 409);
            }
            throw $error;
        }
        $delivered = $this->emailVerification->send(
            (string) $user['email'],
            (string) $user['first_name'],
            $token
        );
        $this->emailDeliveries->record(
            'admin_user_invitation',
            (string) $user['email'],
            (string) Config::get('mail.transport', 'smtp'),
            $delivered
        );
        $this->audit->log('admin.user_created', 'user', (int) $user['id'], [
            'emailHash' => hash('sha256', (string) $user['email']),
            'verificationDeliveryAccepted' => $delivered,
        ]);
        Http::json([
            'success' => true,
            'id' => (int) $user['id'],
            'deliveryAccepted' => $delivered,
            'message' => $delivered
                ? 'User created. The verification email was accepted by the mail server.'
                : 'User created, but the verification email was not accepted. Use resend after fixing email delivery.',
        ], 201);
    }

    private function adminUpdateUser(int $userId): never
    {
        $before = $this->admins->userById($userId);
        if ($before === null) Http::json(['success' => false, 'message' => 'User not found.'], 404);
        $body = Http::jsonBody();
        if(!in_array($body['status']??'', ['active','suspended','disabled'],true))Http::json(['success'=>false,'message'=>'Choose a valid account access state.'],422);
        $status = (string)$body['status'];
        $limit = $body['aiTokenLimit'] ?? null;
        if ($limit !== null && $limit !== '' && (filter_var($limit, FILTER_VALIDATE_INT) === false || (int)$limit < 0 || (int)$limit > 1000)) Http::json(['success'=>false,'message'=>'AI allowance must be a whole number between 0 and 1,000.'],422);
        $limit = $limit === null || $limit === '' ? null : (int)$limit;
        $data = [
            'firstName' => Sanitizer::cleanText($body['firstName'] ?? '', false, 100),
            'lastName' => Sanitizer::cleanText($body['lastName'] ?? '', false, 100),
            'phone' => Sanitizer::cleanText($body['phone'] ?? '', false, 30),
            'status' => $status,
            'aiTokenLimit' => $limit,
        ];
        if ($data['firstName'] === '' || $data['lastName'] === '') {
            Http::json(['success' => false, 'message' => 'User name is required.'], 422);
        }
        try { $this->admins->updateUser($userId, $data, (string)($body['version']??'')); }
        catch (\ReGen\ConcurrentUpdate $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],409); }
        if ($data['status'] !== 'active') $this->accounts->revokeAllForUser($userId);
        $this->audit->log('admin.user_updated', 'user', $userId, [
            'before' => ['firstName' => $before['first_name'], 'lastName' => $before['last_name'], 'phone' => $before['phone'], 'status' => $before['account_status'], 'aiTokenLimit' => $before['ai_token_limit']],
            'after' => $data,
        ]);
        Http::json(['success' => true]);
    }

    private function adminResetQuota(int $userId): never
    {
        if ($this->admins->userById($userId) === null) Http::json(['success'=>false,'message'=>'User not found.'],404);
        $this->admins->resetUserQuota($userId);
        $this->audit->log('admin.user_quota_reset', 'user', $userId);
        Http::json(['success' => true]);
    }

    private function adminAiSettings(): never
    {
        Http::json(['success' => true, 'settings' => $this->admins->settings()]);
    }

    private function adminUpdateAiSettings(): never
    {
        $before = $this->admins->settings();
        $body = Http::jsonBody();
        $settings = [
            'aiEnabled' => filter_var($body['aiEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'aiRenewable' => filter_var($body['aiRenewable'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'aiDefaultLimit' => max(1, min(1000, (int) ($body['aiDefaultLimit'] ?? 10))),
            'aiRenewalHours' => max(1, min(720, (int) ($body['aiRenewalHours'] ?? 24))),
        ];
        $settings['aiCosts'] = [];
        foreach (AiQuotaService::OPERATIONS as $operation) {
            $value = is_array($body['aiCosts'] ?? null) ? ($body['aiCosts'][$operation] ?? null) : null;
            if (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value < 0 || (int) $value > 1000) Http::json(['success' => false, 'message' => 'Each AI price must be a whole number from 0 to 1,000.'], 422);
            $settings['aiCosts'][$operation] = (int) $value;
        }
        $this->admins->updateSettings($settings, Session::adminId());
        $this->audit->log('admin.ai_settings_updated', 'settings', 'ai', ['before' => [
            'aiRenewable'=>$before['aiRenewable'], 'aiEnabled' => $before['aiEnabled'], 'aiDefaultLimit' => $before['aiDefaultLimit'], 'aiRenewalHours' => $before['aiRenewalHours'], 'aiCosts' => $before['aiCosts'],
        ], 'after' => $settings]);
        Http::json(['success' => true, 'settings' => $settings]);
    }

    private function adminListAdmins(): never
    {
        $this->requireSuperAdmin();
        Http::json(['success' => true, 'admins' => $this->admins->admins()]);
    }

    private function adminCreateAdmin(): never
    {
        $this->requireSuperAdmin();
        $body = Http::jsonBody();
        $data = [
            'firstName' => Sanitizer::cleanText($body['firstName'] ?? '', false, 100),
            'lastName' => Sanitizer::cleanText($body['lastName'] ?? '', false, 100),
            'email' => mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200)),
            'password' => (string) ($body['password'] ?? ''),
            'role' => ($body['role'] ?? '') === 'super_admin' ? 'super_admin' : 'admin',
        ];
        if ($data['firstName'] === '' || $data['lastName'] === '' || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)
            || strlen($data['password']) < 10 || strlen($data['password']) > 128) {
            Http::json(['success' => false, 'message' => 'Enter valid details and a password of at least 10 characters.'], 422);
        }
        try {
            $id = $this->admins->createAdmin($data);
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') Http::json(['success' => false, 'message' => 'That admin email already exists.'], 409);
            throw $error;
        }
        $this->audit->log('admin.account_created', 'admin', $id, ['role' => $data['role']]);
        Http::json(['success' => true, 'id' => $id], 201);
    }

    private function adminUpdateAdminStatus(int $adminId): never
    {
        $this->requireSuperAdmin();
        if ($adminId === Session::adminId()) Http::json(['success' => false, 'message' => 'You cannot disable your own admin account.'], 422);
        $status = (string) (Http::jsonBody()['status'] ?? '');
        if (!in_array($status, ['active', 'disabled'], true)) Http::json(['success' => false, 'message' => 'Invalid status.'], 422);
        $before = $this->admins->adminById($adminId);
        if ($before === null) Http::json(['success' => false, 'message' => 'Administrator not found.'], 404);
        if ($status === 'disabled' && ($before['role'] ?? '') === 'super_admin' && $this->admins->activeSuperAdminCount() <= 1) {
            Http::json(['success' => false, 'message' => 'The last active super administrator cannot be disabled.'], 422);
        }
        if ((bool) ($before['is_bootstrap'] ?? false)) Http::json(['success' => false, 'message' => 'Manage temporary access in System settings.'], 422);
        try { $this->admins->updateAdminStatus($adminId, $status); }
        catch (\DomainException $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],422); }
        $this->audit->log('admin.status_updated', 'admin', $adminId, ['before' => ['status' => $before['status']], 'after' => ['status' => $status]]);
        Http::json(['success' => true]);
    }

    private function adminChangePassword(): never
    {
        $body = Http::jsonBody();
        $admin = $this->admins->findByEmail((string) ($_SESSION['adminEmail'] ?? ''));
        if ((bool) ($admin['is_bootstrap'] ?? false)) Http::json(['success' => false, 'message' => 'Create a personal admin account, then disable temporary access in System settings.'], 422);
        $password = (string) ($body['newPassword'] ?? '');
        if ($admin === null || !$this->admins->verifyPassword((string) ($body['currentPassword'] ?? ''), $admin)) {
            Http::json(['success' => false, 'message' => 'Current password is incorrect.'], 403);
        }
        if (strlen($password) < 10 || strlen($password) > 128 || $password !== (string) ($body['confirmPassword'] ?? '')) {
            Http::json(['success' => false, 'message' => 'New passwords must match and contain 10 to 128 characters.'], 422);
        }
        $this->admins->changeOwnPassword(Session::adminId(), $password);
        $this->audit->log('admin.password_changed', 'admin', Session::adminId());
        Http::json(['success' => true]);
    }

    private function adminAuditLogs(): never
    {
        Http::json(['success' => true, 'logs' => $this->admins->auditLogs((int) ($_GET['limit'] ?? 100))]);
    }

    private function requireSuperAdmin(): void
    {
        $admin = $this->admins->findById(Session::adminId());
        if (($admin['role'] ?? '') !== 'super_admin') {
            Http::json(['success' => false, 'message' => 'Super admin access is required.'], 403);
        }
    }
}
