<?php
declare(strict_types=1);

namespace ReGen;

/** Explicit permissions for existing admin API actions. The session gate runs separately. */
final class AdminRoutes
{
    private const RULES = [
        // [path pattern below /api/admin, HTTP methods, required capabilities]
        ['/me|/alerts|/preferences|/work-queues', 'GET', []],
        ['/alerts/read|/auth/logout|/session/active', 'POST', []],
        ['/alerts/\d+', 'DELETE', []],
        ['/password|/profile|/preferences', 'PUT', []],
        ['/dashboard', 'GET', ['overview.view']],
        ['/reports', 'GET', ['reports.view']],
        ['/reports/export', 'GET', ['reports.export']],
        ['/analytics', 'GET', ['analytics.view']],
        ['/users|/users/\d+(?:/sessions|/bonus|/packages)?', 'GET', ['users.view']],
        ['/users/\d+/export', 'GET POST', ['users.export']],
        ['/users|/users/\d+/(?:verification|password-reset|delete|revoke-sessions|reset-quota)', 'POST', ['users.manage']],
        ['/users/\d+', 'PATCH', ['users.manage']],
        ['/users/\d+/bonus', 'POST', ['users.manage', 'ai.manage']],
        ['/users/\d+/packages/catalogue', 'GET', ['users.view', 'users.packages']],
        ['/users/\d+/packages(?:/\d+/(?:adjust|replace|revoke))?', 'POST', ['users.view', 'users.packages']],
        ['/campaigns', 'GET', ['campaigns.view']],
        ['/campaigns', 'POST', ['campaigns.manage']],
        ['/campaigns/\d+', 'PUT', ['campaigns.manage']],
        ['/templates(?:/[a-z]+/preview)?', 'GET', ['templates.view']],
        ['/templates/[a-z]+', 'PATCH', ['templates.manage']],
        ['/templates/[a-z]+/resumes(?:/\d+/(?:preview|pdf))?', 'GET', ['templates.view', 'templates.resumes']],
        ['/settings/ai', 'GET', ['ai.view']],
        ['/settings/ai', 'PUT', ['ai.manage']],
        ['/features', 'GET', ['features.view']],
        ['/features/[a-z_]+', 'PUT', ['features.manage']],
        ['/settings/(?:system|mochi(?:/user/[1-9][0-9]{0,9})?|support-attachments)|/maintenance(?:/preview)?', 'GET', ['system.view']],
        ['/settings/(?:system|mochi(?:/user/[1-9][0-9]{0,9})?|support-attachments|bootstrap-access)|/maintenance', 'PUT', ['system.manage']],
        ['/email(?:/config)?', 'GET', ['email.view']],
        ['/email/config', 'PUT', ['email.manage']],
        ['/email/test', 'POST', ['email.manage']],
        ['/notifications', 'GET', ['notifications.view']],
        ['/notifications/policy', 'PUT', ['notifications.manage']],
        ['/notifications/(?:campaigns|retry)', 'POST', ['notifications.manage']],
        ['/tickets(?:/configuration|/\d+(?:/attachments/\d+)?)?', 'GET', ['support.view']],
        ['/tickets/configuration', 'PUT', ['support.manage']],
        ['/tickets/\d+', 'PATCH POST', ['support.manage']],
        ['/tickets/\d+/reopen', 'POST', ['support.manage']],
        ['/feedback(?:/summary|/\d+/reviews)?', 'GET', ['feedback.view']],
        ['/feedback/export', 'GET', ['feedback.export']],
        ['/feedback/\d+', 'PATCH', ['feedback.manage']],
        ['/feedback/policy', 'PUT', ['feedback.manage']],
        ['/security', 'GET', ['security.view']],
        ['/security/blocks', 'POST', ['security.manage']],
        ['/security/blocks/[a-f0-9]{64}', 'DELETE', ['security.manage']],
        ['/security/incidents/\d+', 'PATCH', ['security.manage']],
        ['/operations/health', 'GET', ['operations.view']],
        ['/operations/revoke-all-sessions', 'POST', ['operations.manage']],
        ['/recovery(?:/\d+)?', 'GET', ['recovery.view']],
        ['/recovery|/recovery/\d+/restore', 'POST', ['recovery.manage']],
        ['/recovery/policy', 'PUT', ['recovery.manage']],
        ['/audit|/audit/search', 'GET', ['audit.view']],
        ['/audit/export', 'GET', ['audit.export']],
        ['/admins(?:/\d+/permissions)?', 'GET', ['admins.view']],
        ['/admins', 'POST', ['admins.manage']],
        ['/admins/\d+/permissions', 'PUT', ['admins.manage']],
        ['/admins/\d+/status', 'PATCH', ['admins.manage']],
        ['/pricing|/store(?:/accounts|/payments|/payment-analytics)?', 'GET', ['pricing.view']],
        ['/pricing/[a-z_]+|/store/policy|/store/packages/\d+', 'PUT', ['pricing.manage']],
        ['/store/packages(?:/\d+/grant)?', 'POST', ['pricing.manage']],
    ];

    public static function capabilities(string $path, ?string $method = null): ?array
    {
        foreach (self::RULES as [$pattern, $methods, $capabilities]) {
            if ($method !== null && !in_array($method, explode(' ', $methods), true)) continue;
            if (preg_match('#^/api/admin(?:' . $pattern . ')$#D', $path)) return $capabilities;
        }
        return null;
    }
}
