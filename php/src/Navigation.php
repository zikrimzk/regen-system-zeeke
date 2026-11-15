<?php
declare(strict_types=1);

namespace ReGen;

/** Navigation destinations and display permissions. API authorisation stays in AdminRoutes. */
final class Navigation
{
    public const WORKSPACE = [
        'overview' => ['/dashboard', 'nav.overview', 'home'],
        'resumes' => ['/resumes', 'nav.resumes', 'resume'],
        'letters' => ['/cover-letters', 'nav.letters', 'letters'],
        'tailor' => ['/tailor', 'nav.tailor', 'target'],
        'jobs' => ['/jobs/saved', 'nav.jobs', 'bookmark'],
        'applications' => ['/applications', 'nav.applications', 'briefcase'],
        'interview' => ['/interview', 'nav.interview', 'conversation'],
        'profile' => ['/profile', 'nav.profile', 'account'],
        'billing' => ['/store', 'nav.billing', 'store'],
        'settings' => ['/settings', 'nav.settings', 'settings'],
        'templates' => ['/templates', 'nav.templates', 'resume'],
        'payments' => ['/payments', 'nav.payments', 'payments'],
        'tokens' => ['/token-activity', 'nav.tokens', 'store'],
        'support' => ['/support', 'nav.support', 'support'],
        'mochi' => ['/mochi', 'nav.mochi', 'mochi'],
    ];

    public const WORKSPACE_GROUPS = [
        'nav.workspace' => ['overview', 'resumes', 'letters'],
        'nav.account' => ['profile', 'billing', 'settings', 'support', 'mochi'],
    ];

    public const UPCOMING = ['tailor', 'jobs', 'applications', 'interview'];

    private const ADMIN = [
        'admin.operations' => [
            'insights' => ['admin.insights', 'analytics', ['overview'=>['nav.overview','overview'], 'reports'=>['admin.reports','reports'], 'analytics'=>['admin.traffic','analytics']]],
        ],
        'admin.people' => [
            'accounts' => ['admin.accounts', 'users', ['users'=>['admin.users','users'], 'operations'=>['admin.sessions','operations']]],
            'support' => ['nav.support', 'support', 'support'],
            'feedback' => ['admin.feedback', 'feedback', 'feedback'],
            'campaigns' => ['admin.campaigns', 'campaigns', 'campaigns'],
        ],
        'admin.product' => [
            'templates' => ['nav.templates', 'templates', 'templates'],
            'pricing' => ['admin.pricing', 'pricing', 'pricing'],
            'ai' => ['admin.ai', 'ai', 'ai'],
            'mochi' => ['admin.mochi', 'profile', 'system'],
        ],
        'admin.controls' => [
            'configuration' => ['admin.system', 'system', ['features'=>['admin.visibility','features'], 'system'=>['admin.sessionSettings','system'], 'maintenance'=>['admin.maintenance','system'], 'uploads'=>['admin.uploads','system']]],
            'mail' => ['admin.mail', 'email', ['email'=>['admin.testMail','email'], 'notifications'=>['admin.broadcast','notifications']]],
            'security' => ['admin.security', 'security', 'security'],
            'health' => ['admin.health', 'health', 'operations'],
            'recovery' => ['admin.recovery', 'recovery', 'recovery'],
            'admins' => ['admin.admins', 'admins', 'admins'],
            'audit' => ['admin.audit', 'audit', 'audit'],
            'profile' => ['nav.profile', 'profile', null],
        ],
    ];

    public static function workspaceActive(string $view): string
    {
        $path = Http::path();
        if (in_array($path, ['/builder', '/templates'], true)) return 'resumes';
        if ($path === '/payments/result') return 'payments';
        foreach (self::WORKSPACE as $key => [$url]) {
            if ($path === $url) return $key;
        }
        $path = '/' . basename($view, '.html');
        if (in_array($path, ['/builder', '/templates'], true)) return 'resumes';
        foreach (self::WORKSPACE as $key => [$url]) {
            if ($path === $url) return $key;
        }
        return match ($view) {
            'notifications.html' => 'notifications',
            'feedback.html' => 'feedback',
            default => 'overview',
        };
    }

    public static function adminMarkup(): string
    {
        $markup = '';
        $manifest = [];
        foreach (self::ADMIN as $heading => $items) {
            $markup .= '<div class="admin-nav-group"><p>' . InterfaceText::html($heading) . '</p>';
            foreach ($items as $id => [$label, $icon, $access]) {
                $labelText = InterfaceText::text($label);
                $modules = is_array($access) ? array_values(array_unique(array_column($access, 1))) : ($access === null ? [] : [$access]);
                $manifest[$id] = ['label'=>$labelText, 'modules'=>$modules, 'members'=>[]];
                foreach (is_array($access) ? $access : [] as $member => [$memberLabel, $module]) {
                    $manifest[$id]['members'][$member] = ['label'=>InterfaceText::text($memberLabel), 'module'=>$module];
                }
                $markup .= '<button type="button" data-view="' . $id . '" hidden><span class="admin-nav-icon" data-icon="' . $icon
                    . '"></span><span>' . InterfaceText::html($label) . '</span></button>';
            }
            $markup .= '</div>';
        }
        return $markup . '<script type="application/json" id="regen-admin-navigation">'
            . json_encode($manifest, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) . '</script>';
    }
}
