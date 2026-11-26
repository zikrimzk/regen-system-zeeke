<?php
declare(strict_types=1);
namespace ReGen;

final class WorkspaceShell
{
    private const ICONS = [
        'mochi'=>'<path d="M4 13V6l5 3a11 11 0 0 1 6 0l5-3v7a8 6 0 0 1-16 0Z"/><path d="M9 13h.01M15 13h.01M11 16l1 1 1-1"/>',
        'resume'=>'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
        'letters'=>'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
        'support'=>'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><path d="M7 8h10M7 12h6"/>',
        'notifications'=>'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
        'account'=>'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
        'feedback'=>'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
        'logout'=>'<path d="M10 17l5-5-5-5M15 12H3M21 3v18"/>',
        'store'=>'<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 5 3 6 0 1 3 5 3 6 0 1 3 6 3 6 0M10 20v-5h4v5"/>',
        'coin'=>'<circle cx="12" cy="12" r="9"/><path d="M9 16V8m0 5 6-5m-4 4 4 4"/>',
        'back'=>'<path d="M20 12H4m7-7-7 7 7 7"/>',
        'next'=>'<path d="M4 12h16m-7-7 7 7-7 7"/>',
        'sections'=>'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
        'edit'=>'<path d="m16 3 5 5-12 12H4v-5zM14 5l5 5"/>',
        'eye'=>'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>',
        'save'=>'<path d="M4 4h13l3 3v13H4zM8 4v5h8V4m-8 16v-6h8v6"/>',
        'check'=>'<path d="m5 12 4 4 10-10"/>',
        'download'=>'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
        'add'=>'<path d="M12 5v14M5 12h14"/>',
        'close'=>'<path d="m6 6 12 12M6 18 18 6"/>',
        'retry'=>'<path d="M20 6v5h-5m4 0a7 7 0 1 0 1 5"/>',
        'trash'=>'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6"/>',
        'minus'=>'<path d="M5 12h14"/>',
        'expand'=>'<path d="M8 4H4v4m12-4h4v4m0 8v4h-4m-8 0H4v-4"/>',
        'focus'=>'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M9 9h6m-6 3h6m-6 3h4"/>',
        'templates'=>'<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/>',
        'search'=>'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
        'folder'=>'<path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm0 2h18"/>',
        'library'=>'<rect x="7" y="3" width="13" height="15" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10m-6-13h7m-7 4h5"/>',
        'sparkles'=>'<path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8L10 3Zm8 10 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
        'design'=>'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-12 0v11"/>',
        'payments'=>'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3"/>',
        'home'=>'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/>',
        'target'=>'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 8-8"/>',
        'bookmark'=>'<path d="M6 4h12v17l-6-4-6 4z"/>',
        'briefcase'=>'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18"/>',
        'conversation'=>'<path d="M20 5H4v11h5l3 4 3-4h5V5ZM8 10h8m-8 3h5"/>',
        'settings'=>'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
        'more'=>'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
        'sidebar'=>'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m7-11-3 3 3 3"/>',
    ];

    public static function icon(string $name): string
    {
        return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">'.self::ICONS[$name].'</svg>';
    }

    public static function header(string $file): string
    {
        $active = Navigation::workspaceActive($file);
        $bell = '<a class="workspace-notification-bell" href="/notifications" aria-label="' . InterfaceText::html('nav.notifications')
            . '"' . ($active === 'notifications' ? ' aria-current="page"' : '') . '>' . self::icon('notifications')
            . '<span class="workspace-notification-count" data-notification-count hidden></span></a>';
        $account = '';
        foreach (['profile', 'billing', 'support'] as $key) {
            $account .= self::link($key, $active, 'account-menu-item', menu: true);
        }
        return self::sidebar($active) . '<header class="topbar workspace-header">' . self::brand()
            . '<div class="topbar-spacer"></div>'
            . '<div class="workspace-tools"><a class="workspace-token-balance" href="/store" aria-label="'
            . InterfaceText::html('nav.balance') . '">' . self::icon('coin') . '<span data-token-total>…</span></a>'
            . $bell . self::mochiHeaderControls(false, $active !== 'mochi') . '<div class="topbar-user account-menu"><button type="button" class="account-menu-toggle" id="account-menu-toggle" aria-label="'
            . InterfaceText::html('nav.account') . '" aria-expanded="false" aria-haspopup="menu"><span class="topbar-avatar" id="topbar-avatar">U</span></button>'
            . '<div class="account-menu-panel hidden" id="account-menu-panel" role="menu"><div class="account-menu-identity" role="presentation"><strong class="topbar-user-name" id="topbar-user-name">'
            . InterfaceText::html('nav.account') . '</strong></div>' . $account . InterfaceText::languageLink('account-menu-item', 'menuitem')
            . '<button type="button" class="account-menu-item" data-feedback-open role="menuitem">' . self::icon('feedback') . InterfaceText::html('nav.feedback') . '</button>'
            . '<button type="button" class="account-menu-item" id="account-menu-logout" role="menuitem">' . self::icon('logout') . InterfaceText::html('common.signOut')
            . '</button></div></div></div></header>';
    }

    public static function studioBack(): string
    {
        $label = InterfaceText::html('studio.exit');
        return '<a class="studio-icon studio-exit" href="/dashboard" aria-label="' . $label . '" title="' . $label . '">'
            . self::icon('back') . '</a>';
    }

    public static function mochiHeaderControls(bool $studio, bool $visibility = true): string
    {
        $label = InterfaceText::html('mochi.show');
        $toggle = $visibility ? '<button type="button" class="' . ($studio ? 'studio-icon ' : '') . 'mochi-header-toggle" data-mochi-visibility hidden aria-controls="mochi-floating-mascot" aria-expanded="false" aria-label="'
            . $label . '" title="' . $label . '"><img src="/img/mochi-coach.webp" width="28" height="28" alt="" decoding="async"></button>' : '';
        return $toggle . self::mochiChatButton($studio ? 'studio-icon mochi-header-chat studio-mochi-chat' : 'mochi-header-chat');
    }

    private static function mochiChatButton(string $class, string $icon = 'conversation'): string
    {
        $label = InterfaceText::html('mochi.chat');
        return '<button type="button" class="' . $class . '" data-mochi-open hidden aria-label="' . $label . '" title="' . $label
            . '" aria-haspopup="dialog" aria-controls="mochi-panel" aria-expanded="false">'
            . self::icon($icon) . '</button>';
    }

    public static function storeNavigation(): string
    {
        $active = Navigation::workspaceActive('store.html');
        return '<nav class="store-navigation" aria-label="' . InterfaceText::html('nav.billing') . '">'
             . '<a href="/store"' . ($active === 'billing' ? ' aria-current="page"' : '') . '>' . self::icon('store')
            . '<span>' . InterfaceText::html('store.packages') . '</span></a>'
            . self::link('tokens', $active)
            . self::link('payments', $active) . '</nav>';
    }

    private static function brand(): string
    {
        return '<a href="/dashboard" class="topbar-brand" aria-label="' . InterfaceText::html('nav.overview')
            . '">' . Brand::wordmark() . '</a>';
    }

    private static function link(string $key, string $active, string $class = '', bool $menu = false, ?string $shortLabel = null): string
    {
        [$path, $label, $icon] = Navigation::WORKSPACE[$key];
        return '<a href="' . $path . '"' . ($class ? ' class="' . $class . '"' : '') . ($key === $active ? ' aria-current="page"' : ($key === 'billing' && in_array($active, ['tokens', 'payments'], true) ? ' data-current="true"' : ''))
            . ($menu ? ' role="menuitem"' : '') . ($key === 'mochi' ? ' data-mochi-room-link' : '')
            . ' aria-label="' . InterfaceText::html($label) . '" title="' . InterfaceText::html($label) . '">' . self::icon($icon) . '<span>' . InterfaceText::html($shortLabel ?? $label) . '</span></a>';
    }

    private static function primaryNavigation(string $active): string
    {
        return self::link('overview', $active) . self::link('studio', $active, shortLabel: 'nav.shortResume')
            . self::link('letters', $active, shortLabel: 'nav.shortLetters')
            . self::link('billing', $active)
            . '<button type="button" data-workspace-more aria-haspopup="dialog" aria-controls="workspace-more" aria-label="' . InterfaceText::html('common.more') . '"'
            . (!in_array($active, ['overview', 'studio', 'letters', 'billing', 'tokens', 'payments'], true) ? ' data-current="true"' : '')
            . '>' . self::icon('more') . '<span>' . InterfaceText::html('common.more') . '</span></button>';
    }

    private static function sidebar(string $active): string
    {
        $label = InterfaceText::html('nav.toggleSidebar');
        return '<aside class="workspace-sidebar"><div class="workspace-sidebar-head">' . self::brand()
            . '<button type="button" data-workspace-collapse aria-controls="workspace-sidebar-nav" aria-expanded="true" aria-label="'
            . $label . '" title="' . $label . '">' . self::icon('sidebar') . '</button></div>'
            . self::groupedNavigation($active, false) . '</aside>';
    }

    private static function groupedNavigation(string $active, bool $secondaryOnly = true): string
    {
        $markup = '<nav class="workspace-destinations"' . ($secondaryOnly ? '' : ' id="workspace-sidebar-nav"')
            . ' aria-label="' . InterfaceText::html($secondaryOnly ? 'common.more' : 'nav.workspace') . '">';
        foreach (Navigation::WORKSPACE_GROUPS as $label => $links) {
            if ($secondaryOnly) $links = array_diff($links, ['overview', 'studio', 'letters', 'billing']);
            if ($links === []) continue;
            $markup .= '<section><h2>' . InterfaceText::html($label) . '</h2>';
            foreach ($links as $key) $markup .= self::link($key, $active);
            $markup .= '</section>';
        }
        return $markup . '</nav>';
    }

    public static function mochiPanel(): string
    {
        $html = <<<'HTML'
<aside class="mochi-float" data-mochi-float aria-label="Mochi">
  <div class="mochi-bubble" data-mochi-bubble hidden>
    <p data-mochi-bubble-text role="status"></p>
    <a href="/store?feature=mochi_play" data-mochi-bubble-adopt hidden>Adopt Mochi ↗</a>
  </div>
  <div class="mochi-float-stage" id="mochi-floating-mascot" data-mochi-float-stage hidden>
    <button type="button" class="mochi-pet" data-mochi-pet aria-label="Pet Mochi" aria-describedby="mochi-move-help">
      <span class="mochi-pet-shadow" aria-hidden="true"></span>
      <canvas aria-hidden="true"></canvas>
      <img src="/img/mochi-coach.webp" width="124" height="124" alt="" decoding="async" aria-hidden="true">
      <span class="mochi-fx" aria-hidden="true" data-mochi-fx></span>
    </button>
    {{FLOATING_MOCHI_CHAT}}
  </div>
</aside>
<section id="mochi-panel" class="mochi-panel" role="dialog" aria-modal="false" aria-labelledby="mochi-panel-title" hidden>
  <header class="mochi-panel-head">
    <div class="mochi-panel-portrait" aria-hidden="true">
      <img src="/img/mochi-coach.webp" width="42" height="42" alt="" decoding="async" loading="lazy">
    </div>
    <div class="mochi-panel-identity">
      <div class="mochi-panel-name"><h2 id="mochi-panel-title" tabindex="-1">Mochi</h2><span data-mochi-expression>Personal coach</span></div>
      <p class="mochi-kicker" data-mochi-location>Workspace</p>
    </div>
    <div class="mochi-panel-actions">
      <button type="button" class="mochi-close mochi-options-button" data-mochi-options-button aria-label="Options" title="Options" aria-controls="mochi-options" aria-expanded="false" hidden>
        <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
      </button>
      <button type="button" class="mochi-close mochi-sleep-button" data-mochi-sleep aria-label="Let Mochi sleep" title="Let Mochi sleep" hidden>
        <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a8 8 0 0 1-11-11A8.1 8.1 0 1 0 20 15Z"/></svg>
      </button>
      <button type="button" class="mochi-close" data-mochi-close aria-label="Close Mochi">
        <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
      </button>
    </div>
  </header>
  <div class="mochi-empty" data-mochi-locked>
    <p role="status" data-mochi-access-message>Checking your Mochi access…</p>
    <a class="btn btn-primary" href="/store?feature=mochi_play" data-mochi-packages hidden>See packages with Mochi</a>
  </div>
  <div class="mochi-empty" data-mochi-play-only hidden>
    <p>Jom main! For resume and cover letter help, pick a package with Mochi chat.</p>
    <a class="btn btn-primary" href="/store?feature=mochi_chat">See Mochi chat packages</a>
    <button type="button" class="btn btn-secondary" data-mochi-support>{{i18n.mochi.productHelp}}</button>
  </div>
  <div class="mochi-empty" data-mochi-sleep-view hidden>
    <p data-mochi-sleep-copy>Mochi is asleep. He’ll stay quiet until you wake him.</p>
    <button class="btn btn-primary" type="button" data-mochi-wake>Wake Mochi</button>
    <button type="button" class="btn btn-secondary" data-mochi-support>{{i18n.mochi.productHelp}}</button>
  </div>
  <form class="mochi-intro" data-mochi-intro hidden>
    <div><h3>Can I know you better?</h3><p>Let’s kenal! Share only what you want me to remember.</p></div>
    <label>What should I call you? <input class="form-input" name="nickname" maxlength="40" placeholder="Optional nickname"></label>
    <label>What are you working toward? <input class="form-input" name="goal" maxlength="150" placeholder="e.g. My first UX design internship"></label>
    <label>Career stage <select class="form-select" name="stage"><option value="">Prefer not to say</option><option value="student">Studying</option><option value="first-job">Finding my first job</option><option value="working">Building my career</option><option value="career-change">Changing careers</option></select></label>
    <div class="mochi-intro-pair">
      <label>Coaching style <select class="form-select" name="tone"><option value="playful">Playful</option><option value="gentle">Gentle</option><option value="direct">Direct</option></select></label>
      <label>Language <select class="form-select" name="language"><option value="auto">Match me</option><option value="en">English</option><option value="ms">Bahasa Melayu</option></select></label>
    </div>
    <div class="mochi-controls"><button class="btn btn-primary" type="submit">Remember this</button><button class="btn btn-secondary" type="button" data-mochi-skip>Not now</button></div>
  </form>
  <div id="mochi-options" class="mochi-options" data-mochi-options hidden>
    <h3>Make Mochi yours</h3>
    <p data-mochi-saved-goal hidden></p>
    <div class="mochi-controls">
      <button type="button" class="btn btn-secondary" data-mochi-kenal>Tell Mochi about you</button>
      <button type="button" class="btn btn-secondary" data-mochi-sound aria-pressed="false" hidden>Mochi sounds</button>
      <button type="button" class="btn btn-secondary" data-mochi-live aria-pressed="false" hidden>Live field feedback</button>
      <a class="btn btn-secondary" href="/mochi" data-mochi-room-link>Visit Mochi’s room</a>
      <button type="button" class="btn btn-secondary" data-mochi-forget hidden>Forget my details</button>
    </div>
    <p class="mochi-fine">Live replies send your conversation to OpenAI. For writing help, you can share a field or choose to include professional details from your saved resume. Sharing a cover letter field also includes the role, employer and job description. Chat clears when you leave this page.</p>
  </div>
  <div class="mochi-chat" data-mochi-chat hidden>
    <div class="mochi-history" data-mochi-history role="log" aria-label="Mochi conversation" aria-live="polite" aria-relevant="additions"></div>
    <div class="mochi-chat-dock">
      <p class="mochi-field-note" data-mochi-field-note hidden></p>
      <div class="mochi-quick">
        <button type="button" data-mochi-help>Help me here</button>
        <button type="button" data-mochi-share hidden>Share this field</button>
        <button type="button" data-mochi-resume aria-pressed="false" title="Include your saved experience, education, projects and skills" hidden>Use saved resume</button>
        <button type="button" data-mochi-retry hidden>Try again</button>
        <button type="button" data-mochi-support>{{i18n.mochi.productHelp}}</button>
        <button type="button" data-mochi-back-chat hidden>Back to coaching</button>
      </div>
      <form class="mochi-composer" data-mochi-compose>
        <label class="sr-only" for="mochi-message">Message Mochi</label>
        <textarea id="mochi-message" name="message" maxlength="2400" rows="1" placeholder="Message Mochi…" enterkeyhint="send"></textarea>
        <button type="submit" aria-label="Send" class="btn btn-primary">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>
        </button>
      </form>
      <p class="mochi-fine" data-mochi-model hidden></p>
    </div>
  </div>
  <p class="mochi-panel-status" data-mochi-status role="status" hidden></p>
</section>
<p class="sr-only" id="mochi-move-help">{{i18n.mochi.move}}</p>
HTML;
        return str_replace('{{FLOATING_MOCHI_CHAT}}', self::mochiChatButton('mochi-float-chat', 'more'), $html);
    }

    public static function mobileNavigation(string $file): string
    {
        $active = Navigation::workspaceActive($file);
        return '<nav class="mobile-product-nav" aria-label="' . InterfaceText::html('nav.workspace') . '">' . self::primaryNavigation($active) . '</nav>'
            . '<dialog class="workspace-more" id="workspace-more" aria-labelledby="workspace-more-title"><header><h2 id="workspace-more-title">'
            . InterfaceText::html('common.more') . '</h2><button type="button" class="btn btn-secondary" data-workspace-more-close autofocus>'
            . InterfaceText::html('common.close') . '</button></header>' . self::groupedNavigation($active) . '</dialog>';
    }
}
