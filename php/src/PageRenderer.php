<?php
declare(strict_types=1);

namespace ReGen;

final class PageRenderer
{
    public static function render(string $root, string $file, array $replacements = [], int $status = 200): never
    {
        foreach ([$root . '/php/views/', $root . '/_app/views/'] as $directory) {
            $path = $directory . $file;
            if (is_file($path)) {
                $html = (string) file_get_contents($path);
                $replacements += ['{{LANGUAGE}}'=>InterfaceText::language(), '{{LANGUAGE_LINK}}'=>InterfaceText::languageLink(),
                    '{{BRAND_NAME}}'=>Brand::NAME, '{{PRODUCT_WORDMARK}}'=>Brand::wordmark()];
                if ($file === 'admin.html') $replacements['{{ADMIN_NAVIGATION}}'] = Navigation::adminMarkup();
                if (!in_array($file,['offline.html','not-found.html'],true)) $html=str_replace('</head>','<script src="/js/realtime.js" defer></script></head>',$html);
                if (str_contains($html,'/js/pdf-pages.js'))$html=str_replace('</head>','<link rel="stylesheet" href="/css/pdf-pages.css"></head>',$html);
                if ($file==='landing.html') {
                    $html=str_replace('<link rel="stylesheet" href="/css/site.css','<link rel="stylesheet" href="/css/mochi.css"><link rel="stylesheet" href="/css/site.css',$html);
                    $replacements += ['{{MOCHI_HIDDEN}}'=>' hidden','{{MOCHI_PREVIEW}}'=>'null'];
                }
                if (str_contains($html,'{{WORKSPACE_HEADER}}')) {
                    $destination = Navigation::workspaceActive($file);
                    $workspace = $destination === 'resumes' && $file === 'dashboard.html' ? 'library' : 'overview';
                    $replacements += [
                        '{{WORKSPACE_VIEW}}'=>$workspace,
                        '{{WORKSPACE_H1}}'=>InterfaceText::html($workspace === 'library' ? 'nav.resumes' : 'dashboard.workTitle'),
                        '{{WORKSPACE_INTRO}}'=>InterfaceText::html($workspace === 'library' ? 'dashboard.libraryIntro' : 'dashboard.workIntro'),
                        '{{PROFILE_H1}}'=>InterfaceText::html($destination === 'settings' ? 'nav.settings' : 'nav.profile'),
                    ];
                    if (in_array($destination, Navigation::UPCOMING, true)) {
                        $replacements['{{UPCOMING_TITLE}}'] = InterfaceText::html(Navigation::WORKSPACE[$destination][1]);
                        $replacements['{{UPCOMING_DESCRIPTION}}'] = InterfaceText::html('upcoming.' . $destination);
                    }
                    $html=str_replace('{{WORKSPACE_HEADER}}',WorkspaceShell::header($file),$html);
                    $mobile=WorkspaceShell::mobileNavigation($file);
                    if ($mobile !== '') $html=preg_replace('/(<body\b[^>]*\bclass=")([^"]*)/i','$1has-mobile-nav $2',$html,1) ?? $html;
                    $html=preg_replace_callback('/(<meta name="viewport" content=")([^"]+)(")/i',static fn(array $m):string =>
                        $m[1].$m[2].(str_contains($m[2],'viewport-fit=')?'':',viewport-fit=cover').$m[3],$html,1) ?? $html;
                    $html=str_replace('</body>',$mobile.WorkspaceShell::mochiPanel().'</body>',$html);
                    foreach(['css/workspace.css','css/privacy.css','css/token-store.css','css/support-attachments.css','css/mochi.css','js/api.js','js/ui.js','js/privacy.js','js/pwa.js','js/mobile-viewport.js','js/commerce-ui.js','js/feature-access.js','js/support-attachments.js','js/live-notifications.js','js/mochi-avatar.js','js/mochi-activities.js','js/mochi-play.js','js/mochi-assist.js','js/mochi.js'] as $asset) {
                        if(str_contains($html,'/'.$asset))continue;
                        $url='/'.$asset.'?v='.self::assetVersion($root,$asset);
                        $tag=str_ends_with($asset,'.css')?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';
                        $html=str_replace('</head>',$tag.'</head>',$html);
                    }
                    $html=str_replace('</head>','<link rel="stylesheet" href="/css/workspace-shell.css?v='.self::assetVersion($root,'css/workspace-shell.css').'">'.'</head>',$html);
                    if(in_array($file,['builder.html','templates.html'],true))$html=str_replace('</head>','<link rel="stylesheet" href="/css/template-picker.css?v='.self::assetVersion($root,'css/template-picker.css').'">'.'</head>',$html);
                    if(!str_contains($html,'rel="manifest"'))$html=str_replace('</head>','<link rel="manifest" href="/manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png"></head>',$html);
                }
                if(in_array($file,['dashboard.html','notifications.html'],true)) {
                    $html=str_replace('</head>','<link rel="stylesheet" href="/css/campaigns.css"><script src="/js/campaigns.js" defer></script></head>',$html);
                }
                if (!str_starts_with($file, 'admin') && !in_array($file, ['pricing.html','design-system.html','offline.html','not-found.html','unavailable.html','maintenance.html'], true)) {
                    $html = str_replace('</head>', '<link rel="stylesheet" href="/css/service-centre.css?v=' . self::assetVersion($root,'css/service-centre.css') . '"><link rel="stylesheet" href="/css/feedback.css?v='.self::assetVersion($root,'css/feedback.css').'"><script src="/js/feedback.js?v='.self::assetVersion($root,'js/feedback.js').'" defer></script><script src="/js/service-centre.js?v=' . self::assetVersion($root,'js/service-centre.js') . '" defer></script></head>', $html);
                }
                if (str_contains($html, '{{PREVIEW_VERSION}}')) {
                    $fingerprint = '';
                    foreach (['DocumentFonts.php', 'TemplateCatalog.php', 'DocumentStyle.php', 'Sanitizer.php', 'ResumeWriting.php', 'PdfService.php', 'ResumeTemplate.php', 'CoverLetterTemplate.php', 'PublicSite.php'] as $source) $fingerprint .= $source.':'.filemtime(__DIR__.'/'.$source).':'.filesize(__DIR__.'/'.$source);
                    foreach (glob($root . '/public/img/templates/*.webp') ?: glob($root . '/img/templates/*.webp') ?: [] as $image) $fingerprint .= basename($image).':'.filemtime($image).':'.filesize($image);
                    $replacements['{{PREVIEW_VERSION}}'] = substr(hash('sha256', $fingerprint), 0, 12);
                }
                if (str_contains($html, '{{LANGUAGE}}')) {
                    InterfaceText::applyPreference();
                    if (!str_contains($html, '/css/site.css')) {
                        $html = str_replace('</head>', '<link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/interface.css"></head>', $html);
                    }
                    $html = str_replace('</head>', '<script type="application/json" id="regen-interface-text">'
                        . InterfaceText::dictionary() . '</script><script src="/js/interface.js" defer></script></head>', $html);
                }
                $html = preg_replace_callback('/\{\{i18n\.([A-Za-z0-9.]+)\}\}/', static fn(array $match): string => InterfaceText::html($match[1]), $html) ?? $html;
                Http::html(self::versionAssets($root, strtr($html, $replacements)), $status);
            }
        }
        Http::html('<h1>Service unavailable</h1><p>Please try again later.</p>', 500);
    }

    private static function assetVersion(string $root,string $asset): string
    {
        static $versions = [];
        $key = $root.'/'.$asset;
        if (isset($versions[$key])) return $versions[$key];
        foreach ([$root.'/public/',$root.'/'] as $base) {
            if (is_file($base.$asset)) return $versions[$key] = substr(hash_file('sha256',$base.$asset),0,12);
        }
        return $versions[$key] = 'missing';
    }

    private static function versionAssets(string $root,string $html): string
    {
        $versions=[];
        return preg_replace_callback('~\b(src|href)="(/(?:css|js)/[^"?]+)(?:\?[^" ]*)?"~',static function(array $match)use($root,&$versions):string{
            $asset=ltrim($match[2],'/');
            $versions[$asset]??=self::assetVersion($root,$asset);
            return $match[1].'="'.$match[2].'?v='.$versions[$asset].'"';
        },$html)??$html;
    }
}
