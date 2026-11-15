<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\AtsService;
use ReGen\Config;
use ReGen\EmailVerificationService;
use ReGen\Http;
use ReGen\RateLimiter;
use ReGen\Sanitizer;
use ReGen\Session;
use ReGen\TemplateCatalog;
use PDOException;

trait ProfileActions
{
    private function profilePhoto(): never
    {
        $source = $this->resumes->accountPhoto(Session::userId());
        $bytes = $source !== '' ? base64_decode(substr($source, strpos($source, ',') + 1), true) : false;
        $info = is_string($bytes) ? @getimagesizefromstring($bytes) : false;
        if (!is_array($info) || !in_array($info['mime'] ?? '', ['image/jpeg', 'image/png'], true)) {
            http_response_code(404);
            exit;
        }
        // Never expose another account's image through a shared browser or service-worker cache.
        header('Cache-Control: private, no-store');
        header('Content-Type: ' . $info['mime']);
        header('Content-Length: ' . strlen($bytes));
        echo $bytes;
        exit;
    }

    private function profile(): never
    {
        $profile = $this->accounts->profile(Session::userId());
        if ($profile === []) Http::json(['success' => false, 'message' => 'Account not found.'], 404);
        Http::json([
            'success' => true,
            'profile' => $profile,
            'avatarUrl' => $this->resumes->accountPhoto(Session::userId()) !== '' ? '/api/profile/photo' : '',
            ...$this->accounts->sessionPage(Session::userId()),
            'google' => [
                'enabled' => $this->google->enabled() && $this->googleLoginUri() !== ''
                    && (bool) ($this->admins->settings()['googleLoginEnabled'] ?? true),
                'clientId' => (string) Config::get('google.client_id', ''),
                'loginUri' => $this->googleLoginUri(),
            ],
            'features' => [
                'emailChange' => (bool) ($this->admins->settings()['profileEmailChangeEnabled'] ?? true),
                'selfDelete' => (bool) ($this->admins->settings()['userSelfDeleteEnabled'] ?? true),
            ],
            'csrfToken' => Session::csrfToken(),
        ]);
    }

    private function updateProfile(): never
    {
        $body = Http::jsonBody();
        $data = [
            'firstName' => Sanitizer::cleanText($body['firstName'] ?? '', false, 100),
            'lastName' => Sanitizer::cleanText($body['lastName'] ?? '', false, 100),
            'phone' => Sanitizer::cleanText($body['phone'] ?? '', false, 30),
            'address' => Sanitizer::cleanText($body['address'] ?? '', false, 500),
        ];
        if (mb_strlen($data['firstName']) < 2 || mb_strlen($data['lastName']) < 2) {
            Http::json(['success' => false, 'message' => 'First and last name must be at least 2 characters.'], 422);
        }
        $this->accounts->updateProfile(Session::userId(), $data);
        $_SESSION['userName'] = $data['firstName'] . ' ' . $data['lastName'];
        $this->audit->log('profile.updated', 'user', Session::userId());
        Http::json(['success' => true, 'message' => 'Profile updated.', 'profile' => $this->accounts->profile(Session::userId())]);
    }

    private function changePassword(): never
    {
        $body = Http::jsonBody();
        $current = (string) ($body['currentPassword'] ?? '');
        $password = (string) ($body['newPassword'] ?? '');
        $confirm = (string) ($body['confirmPassword'] ?? '');
        $profile = $this->accounts->profile(Session::userId());
        $user = $this->users->findByEmail((string) ($profile['email'] ?? ''));
        if ($user === null) Http::json(['success' => false, 'message' => 'Account not found.'], 404);
        if ((bool) ($profile['has_password'] ?? false) && !$this->users->verifyPassword($current, $user)) {
            Http::json(['success' => false, 'message' => 'Current password is incorrect.'], 403);
        }
        if (strlen($password) < 10 || strlen($password) > 128 || $password !== $confirm) {
            Http::json(['success' => false, 'message' => 'New passwords must match and contain 10 to 128 characters.'], 422);
        }
        $this->accounts->changePassword(Session::userId(), $password);
        $this->audit->log('profile.password_changed', 'user', Session::userId());
        Http::json(['success' => true, 'message' => 'Password updated.']);
    }

    private function changeProfileEmail(): never
    {
        if (!(bool) ($this->admins->settings()['profileEmailChangeEnabled'] ?? true)) {
            Http::json(['success' => false, 'message' => 'Email changes are currently disabled.'], 403);
        }
        $body = Http::jsonBody();
        $email = mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200));
        $profile = $this->accounts->profile(Session::userId());
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::json(['success' => false, 'message' => 'Enter a valid email address.'], 422);
        }
        if ((bool) ($profile['google_linked'] ?? false)) {
            Http::json(['success' => false, 'message' => 'The email for a Google-linked account is managed by Google.'], 422);
        }
        $user = $this->users->findByEmail((string) ($profile['email'] ?? ''));
        if ($user === null || !$this->users->verifyPassword((string) ($body['password'] ?? ''), $user)) {
            Http::json(['success' => false, 'message' => 'Current password is incorrect.'], 403);
        }
        if (mb_strtolower((string) $profile['email']) === $email) {
            Http::json(['success' => true, 'message' => 'Your email address is unchanged.']);
        }
        if ($this->users->emailExists($email)) {
            Http::json(['success' => false, 'message' => 'That email address is already in use.'], 409);
        }
        if (!$this->emailVerification->configured()) {
            Http::json(['success' => false, 'message' => 'Email verification is temporarily unavailable.'], 503);
        }
        $token = EmailVerificationService::createToken();
        try {
            $this->users->changeEmailUnverified(
                Session::userId(), $email, EmailVerificationService::hashToken($token),
                $this->emailVerification->expiresAt()
            );
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') {
                Http::json(['success' => false, 'message' => 'That email address is already in use.'], 409);
            }
            throw $error;
        }
        $delivered = $this->emailVerification->send($email, (string) $profile['first_name'], $token);
        $this->emailDeliveries->record('email_change_verification', $email, (string) Config::get('mail.transport', 'smtp'), $delivered);
        if (!$delivered) {
            $this->audit->log('profile.email_changed_delivery_failed', 'user', Session::userId(), ['emailHash' => hash('sha256', $email)]);
            $this->accounts->revokeCurrentSession(Session::userId());
            Session::destroy();
            Http::json(['success' => false, 'signedOut' => true, 'message' => 'The address was changed, but delivery failed. Ask an administrator to fix email delivery, then resend verification.'], 503);
        }
        $this->audit->log('profile.email_changed', 'user', Session::userId(), ['emailHash' => hash('sha256', $email)]);
        $this->accounts->revokeCurrentSession(Session::userId());
        Session::destroy();
        Http::json(['success' => true, 'signedOut' => true, 'message' => 'Check your new inbox to verify the address, then sign in again.']);
    }

    private function profileSessions(): never
    {
        $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT) ?: 1;
        Http::json(['success' => true, ...$this->accounts->sessionPage(Session::userId(), $page)]);
    }

    private function clearProfileSessionHistory(): never
    {
        RateLimiter::enforce('profile-session-history', (string) Session::userId(), 10, 300);
        $cleared = $this->accounts->clearSessionHistory(Session::userId());
        $this->audit->log('profile.session_history_cleared', 'user', Session::userId(), ['count' => $cleared]);
        Http::json(['success' => true, 'cleared' => $cleared, ...$this->accounts->sessionPage(Session::userId())]);
    }

    private function revokeProfileSession(int $sessionId): never
    {
        $current = $this->accounts->isCurrentSession(Session::userId(), $sessionId);
        if ($sessionId < 1 || !$this->accounts->revokeSession(Session::userId(), $sessionId)) {
            Http::json(['success' => false, 'message' => 'Session not found or already signed out.'], 404);
        }
        $this->audit->log('profile.session_revoked', 'account_session', $sessionId);
        if ($current) {
            Session::destroy();
            Http::json(['success' => true, 'signedOut' => true]);
        }
        Http::json(['success' => true, 'signedOut' => false]);
    }

    private function deleteProfileAccount(): never
    {
        if (!(bool) ($this->admins->settings()['userSelfDeleteEnabled'] ?? true)) {
            Http::json(['success' => false, 'message' => 'Self-service account deletion is currently disabled. Contact support.'], 403);
        }
        $body = Http::jsonBody();
        if ((string) ($body['confirmation'] ?? '') !== 'DELETE') {
            Http::json(['success' => false, 'message' => 'Type DELETE to confirm permanent account deletion.'], 422);
        }
        $profile = $this->accounts->profile(Session::userId());
        $user = $this->users->findByEmail((string) ($profile['email'] ?? ''));
        if ($user === null) Http::json(['success' => false, 'message' => 'Account not found.'], 404);
        if ((bool) ($profile['has_password'] ?? false)
            && !$this->users->verifyPassword((string) ($body['password'] ?? ''), $user)) {
            Http::json(['success' => false, 'message' => 'Password is incorrect.'], 403);
        }
        $id = Session::userId();
        $this->audit->log('profile.account_deleted', 'user', $id, ['emailHash' => hash('sha256', (string) $profile['email'])]);
        $this->accounts->deleteAccount($id);
        Session::destroy();
        Http::json(['success' => true, 'message' => 'Your account and associated data were deleted.']);
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
            'template' => TemplateCatalog::get($data['templateId'] ?? 'classic'),
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
