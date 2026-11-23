<?php
declare(strict_types=1);

namespace ReGen;

final class PublicSite
{
    public static function dispatch(string $root): void
    {
        $path = Http::path();
        if (!in_array(Http::method(), ['GET', 'HEAD'], true)) return;
        $base = rtrim((string) Config::get('app.url', ''), '/');
        $validBase = filter_var($base, FILTER_VALIDATE_URL)
            && in_array(parse_url($base, PHP_URL_SCHEME), ['http', 'https'], true);
        $base = $validBase ? $base : '';

        if ($path === '/packages') {
            $language = $_GET['lang'] ?? null;
            Http::redirect('/pricing' . (in_array($language, ['en', 'ms'], true) ? '?lang=' . $language : ''), 302);
        }
        if ($path === '/resume-templates') {
            try { $templates = (new TemplateManagement(Database::connection()))->catalogue(); }
            catch (\Throwable) { $templates = []; }
            $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $cards = '';
            foreach ($templates as $template) {
                $id = $escape($template['id']);
                $name = $escape($template['name']);
                $premium = $template['tier'] === 'premium';
                $cards .= '<article class="public-template" data-tier="' . ($premium ? 'premium' : 'basic') . '">'
                    . '<img src="/img/templates/' . $id . '-320.webp" srcset="/img/templates/' . $id . '-320.webp 320w, /img/templates/' . $id . '-640.webp 640w" sizes="(min-width: 900px) 265px, (min-width: 600px) 42vw, 80vw" width="320" height="453" alt="" loading="lazy">'
                    . '<div><h2>' . $name . '</h2>' . ($premium ? '<p class="public-premium">' . InterfaceText::html('public.designPremium') . '</p>' : '')
                    . '<a class="text-link" href="/demo/templates/' . $id . '" aria-label="' . InterfaceText::html('common.preview') . ' ' . $name . '">' . InterfaceText::html('common.preview') . '</a>'
                    . ' <a class="text-link" href="/samples/' . $id . '.pdf" aria-label="PDF: ' . $name . '">PDF</a></div></article>';
            }
            PageRenderer::render($root, 'templates-gallery.html', [
                '{{PUBLIC_TEMPLATE_CARDS}}' => $cards ?: '<p role="status">' . InterfaceText::html('public.heroUnavailable') . '</p>',
                '{{PUBLIC_TEMPLATE_FILTER_STATE}}' => $cards === '' ? ' hidden' : '',
            ]);
        }
        if ($path === '/' || $path === '/pricing') {
            $encode = static fn(mixed $data): string => json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
            $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $settings = [];
            try { $settings = (new AdminRepository(Database::connection()))->settings(); }
            catch (\Throwable) { /* Keep public information available without database access. */ }
            $brand = $settings['appName'] ?? 'ReGen';
            $brand = trim((string) $brand);
            if ($brand === '' || $brand === 'ReGen') $brand = Brand::NAME;
            $brandMarkup = $brand === Brand::NAME ? Brand::wordmark() : '<span class="site-brand-name">' . $escape($brand) . '</span>';
            header('Vary: Cookie', false);
            header('Cache-Control: ' . (isset($_GET['lang']) ? 'private, no-store' : 'public, max-age=0, must-revalidate'));
            header_remove('Pragma');
            $view = [
                '{{BRAND_NAME}}' => $escape($brand),
                '{{PUBLIC_BRAND}}' => $brandMarkup,
                '{{CANONICAL}}' => $base !== '' ? '<link rel="canonical" href="' . $escape($base . $path) . '">' : '',
                '{{ROBOTS}}' => Config::get('app.env') === 'production' ? 'index,follow,max-image-preview:large' : 'noindex,nofollow',
            ];
            if ($path === '/pricing') {
                $pricing = self::pricing();
                if (!$pricing['success'] || !($pricing['policy']['showOnLanding'] ?? false) || $pricing['total'] < 1) {
                    $view['{{ROBOTS}}'] = 'noindex,nofollow';
                }
                PageRenderer::render($root, 'pricing.html', $view + ['{{PRICING_CATALOGUE}}' => $encode($pricing)]);
            }
            $publicPackages = [];
            try {
                $store = new TokenStore(Database::connection());
                $policy = $store->policy();
                if ($policy['enabled'] && $policy['showOnLanding']) $publicPackages = $store->packages(false, 1, true)['items'];
            } catch (\Throwable) { /* Use the factual evergreen promotion. */ }
            PageRenderer::render($root, 'landing.html', $view + [
                '{{COMMERCIAL_PROMOTION}}' => PublicProduct::promotion($publicPackages),
                '{{SITE_URL}}' => $escape($base . '/'),
                '{{SOCIAL_IMAGE}}' => $escape($base . '/img/social-preview.png'),
            ]);
        }
        if ($path === '/design-system' && in_array(Config::get('app.env'), ['development','test','testing'], true)) {
            header('Cache-Control: no-store');
            PageRenderer::render($root, 'design-system.html');
        }
        if ($path === '/offline') {
            PageRenderer::render($root, 'offline.html');
        }
        if ($path === '/site/pricing.json') {
            header('Cache-Control: no-store');
            Http::json(self::pricing((int)($_GET['page'] ?? 1),(int)($_GET['heroPage']??1),(int)($_GET['rowPage']??1)));
        }
        if ($path === '/site/mochi.json') {
            header('Cache-Control: no-store');
            try {
                Http::json(self::mochiPreview());
            } catch (\Throwable) {
                Http::json(['available'=>false], 503);
            }
        }
        if ($path === '/site/templates.json') {
            header('Cache-Control: no-store');
            header('X-Robots-Tag: noindex');
            Http::json(['templates' => (new TemplateManagement(Database::connection()))->catalogue(), 'sample' => TemplateCatalog::sample('modern')]);
        }
        if (preg_match('#^/demo/(templates|letters)/([a-z]+)$#D', $path, $matches)) {
            header('X-Robots-Tag: noindex, nofollow');
            if (!TemplateCatalog::valid($matches[2]) || !(new TemplateManagement(Database::connection()))->selectable($matches[2])) Http::html('Template not found.', 404);
            $sample = TemplateCatalog::sample($matches[2]);
            header('Cache-Control: public, max-age=3600');
            $html = $matches[1] === 'letters'
                ? CoverLetterTemplate::buildHtml($sample, TemplateCatalog::sampleLetter())
                : ResumeTemplate::buildHtml($sample);
            Http::html(TemplateCatalog::browserHtml($html));
        }
        if ($path === '/robots.txt') {
            header('Content-Type: text/plain; charset=utf-8');
            header('Cache-Control: public, max-age=3600');
            if (Config::get('app.env') !== 'production') {
                echo "User-agent: *\nDisallow: /\n";
            } else {
                echo "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /builder\nDisallow: /dashboard\nDisallow: /profile\nDisallow: /templates\nDisallow: /cover-letters\nDisallow: /demo/\nDisallow: /site/\nDisallow: /offline\n";
                if ($base !== '') echo 'Sitemap: ' . $base . "/sitemap.xml\n";
            }
            exit;
        }
        if ($path === '/sitemap.xml') {
            header('Content-Type: application/xml; charset=utf-8');
            header('Cache-Control: public, max-age=3600');
            $location = htmlspecialchars($base . '/', ENT_XML1 | ENT_QUOTES, 'UTF-8');
            echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
            echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
            if ($base !== '') echo '<url><loc>' . $location . '</loc></url>';
            echo '</urlset>';
            exit;
        }
    }

    private static function mochiPreview(): array
    {
        $settings = (new MochiPolicy(Database::connection()))->settings();
        return ['available'=>$settings['preview'] && MochiPolicy::available($settings),'health'=>$settings['health'],
            'autoplay'=>$settings['autoplay'],'sound'=>$settings['sound'],'pace'=>$settings['pace'],'naps'=>$settings['naps']];
    }

    private static function pricing(int $page=1,int $heroPage=1,int $rowPage=1): array
    {
        try {
            $db=Database::connection();$store=new TokenStore($db);$policy=$store->policy();
            $show=$policy['enabled']&&$policy['showOnLanding'];$empty=['items'=>[],'total'=>0,'page'=>1,'pageSize'=>12];
            return ['success'=>true,'policy'=>$policy,'prices'=>(new FeaturePricing($db))->all(),'sections'=>$show?$store->sections(true,null,$heroPage,$rowPage):['hero'=>$empty,'row'=>$empty],...($show?$store->packages(false,$page,true):$empty)];
        } catch (\Throwable) {
            return ['success'=>false,'policy'=>['enabled'=>false,'title'=>'ReGen packages','description'=>'Plans for your next application.','notice'=>'Packages are currently unavailable.'],'items'=>[],'prices'=>[],'total'=>0,'page'=>1];
        }
    }
}
