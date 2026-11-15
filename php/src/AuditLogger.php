<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use Throwable;

final class AuditLogger
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @param array<string, mixed> $metadata */
    public function log(
        string $event,
        ?string $targetType = null,
        int|string|null $targetId = null,
        array $metadata = [],
        ?string $actorType = null,
        ?int $actorId = null,
    ): void {
        try {
            if ($actorType === null) {
                $actorType = Session::adminAuthenticated()
                    ? 'admin'
                    : (Session::authenticated() ? 'user' : 'guest');
            }
            if ($actorId === null) {
                $actorId = $actorType === 'admin'
                    ? Session::adminId()
                    : ($actorType === 'user' ? Session::userId() : null);
            }
            $safeMetadata = $this->redact([...$metadata,'client'=>DeviceContext::capture()]);
            $encoded = $safeMetadata === [] ? null : json_encode(
                $safeMetadata,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
            );
            $statement = $this->db->prepare(
                'INSERT INTO audit_logs
                    (actor_type, actor_id, event_type, target_type, target_id, ip_hash, user_agent, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                mb_substr($actorType, 0, 20),
                $actorId > 0 ? $actorId : null,
                mb_substr($event, 0, 100),
                $targetType !== null ? mb_substr($targetType, 0, 50) : null,
                $targetId !== null ? mb_substr((string) $targetId, 0, 100) : null,
                hash('sha256', RateLimiter::clientIdentity()),
                mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'), 0, 255),
                is_string($encoded) ? $encoded : null,
            ]);
            if (in_array($event, ['support.ticket_created','feedback.submitted'], true)) {
                $module = $event === 'feedback.submitted' ? 'feedback' : 'support';
                (new AdminAlertService($this->db))->publish($module, $module === 'feedback' ? 'New user feedback' : 'New support request',
                    $module === 'feedback' ? 'Feedback #'.$targetId.' is ready to review. Every rating helps identify what to improve.' : 'Ticket #'.$targetId.' is waiting in the support inbox.', $event.':'.$targetId);
            }
            (new RealtimeEvents($this->db))->fromAudit($event,$targetType,$targetId,$actorType,$actorId);
            $alerts = [
                'auth.login_success'=>['security','New sign-in','Your account was signed in to. Review your devices in Profile if this was unexpected.'],
                'auth.google_login_success'=>['security','Google sign-in','Your account was signed in to using Google.'],
                'profile.password_changed'=>['security','Password changed','Your account password was changed. Contact Support immediately if you did not make this change.'],
                'profile.google_linked'=>['security','Google account linked','A Google identity was linked to your ReGen account.'],
                'profile.email_changed'=>['security','Email address changed','Your account email address was changed and requires verification.'],
                'profile.session_revoked'=>['security','Device signed out','A device session was revoked from your account.'],
                'profile.updated'=>['account','Profile updated','Your account profile details were updated.'],
                'profile.session_history_cleared'=>['account','Device history cleared','Your previous device history was cleared.'],
                'admin.user_updated'=>['security','Account settings updated','An administrator updated your account details, access status or AI allowance. Contact Support if you need help.'],
                'admin.user_quota_reset'=>['account','AI allowance renewed','An administrator reset your current AI usage window.'],
                'admin.user_sessions_revoked'=>['security','All devices signed out','An administrator revoked your active sign-in sessions.'],
            ];
            $notificationUser = $targetType === 'user' ? (int)$targetId : ($actorType === 'user' ? (int)$actorId : 0);
            if (isset($alerts[$event]) && $notificationUser > 0) {
                [$category,$title,$body] = $alerts[$event];
                (new NotificationService($this->db))->notify($notificationUser,$category,$title,$body);
            }
        } catch (Throwable $error) {
            error_log('[Audit Log Error] ' . $error::class);
            try {
                file_put_contents(Storage::directory('audit').'/fallback.ndjson',json_encode(['event'=>$event,'targetType'=>$targetType,'targetId'=>$targetId,'actorType'=>$actorType,'actorId'=>$actorId,'requestId'=>$_SERVER['REGEN_REQUEST_ID']??null,'at'=>gmdate(DATE_ATOM)],JSON_THROW_ON_ERROR)."\n",FILE_APPEND|LOCK_EX);
            } catch (Throwable) { error_log('[Audit Fallback Error] Unable to persist audit record.'); }
        }
    }

    /** @param array<string, mixed> $value
     *  @return array<string, mixed>
     */
    private function redact(array $value): array
    {
        $blocked = ['password', 'password_hash', 'token', 'csrf', 'secret', 'credential'];
        $safe = [];
        foreach ($value as $key => $item) {
            $lower = mb_strtolower((string) $key);
            $businessAmount = is_int($item) && in_array($lower, ['tokens','bonustokens','paidtokens','tokencost'], true);
            if ($lower !== 'aitokenlimit' && !$businessAmount && array_filter($blocked, static fn (string $word): bool => str_contains($lower, $word))) {
                continue;
            }
            if (is_array($item)) {
                $safe[$key] = $this->redact($item);
            } elseif (is_scalar($item) || $item === null) {
                $safe[$key] = is_string($item) ? mb_substr($item, 0, 500) : $item;
            }
        }
        return $safe;
    }
}
