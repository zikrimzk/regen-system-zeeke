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

        if ($path === '/' || $path === '/pricing') {
            $pricing = self::pricing();
            $publicOffers = $pricing['success'] && ($pricing['policy']['enabled'] ?? false)
                && ($pricing['policy']['showOnLanding'] ?? false) && $pricing['total'] > 0;
            $encode = static fn(mixed $data): string => json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
            $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            try { $brand = (new AdminRepository(Database::connection()))->settings()['appName'] ?? 'ReGen'; }
            catch (\Throwable) { $brand = 'ReGen'; }
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
                '{{PRICING_CATALOGUE}}' => $encode($pricing),
                '{{PRICING_HIDDEN}}' => $publicOffers ? '' : ' hidden',
                '{{ROBOTS}}' => Config::get('app.env') === 'production' && ($path === '/' || $publicOffers) ? 'index,follow,max-image-preview:large' : 'noindex,nofollow',
            ];
            if ($path === '/pricing') PageRenderer::render($root, 'pricing.html', $view);
            try { $templates=(new TemplateManagement(Database::connection()))->catalogue(); }
            catch (\Throwable) { $templates=[]; }
            $featuredTemplates = array_slice($templates, 0, 3);
            $modernIndex = array_search('modern', array_column($templates, 'id'), true);
            if ($modernIndex !== false) {
                $modern = $templates[$modernIndex];
                $featuredTemplates = array_slice([$modern, ...array_values(array_filter($templates, static fn(array $template): bool => $template['id'] !== 'modern'))], 0, 3);
            }
            $feature = $featuredTemplates[0] ?? null;
            $sampleImage = $feature === null ? '' : '<img id="hero-document-image" src="/img/templates/' . $escape($feature['id'])
                . '-320.webp" width="320" height="453" alt="' . InterfaceText::html('public.exampleTitle') . '" fetchpriority="high">';
            $sampleLinks = '';
            foreach ($featuredTemplates as $template) {
                $id = $escape($template['id']);
                $sampleLinks .= '<a href="/samples/' . $id . '.pdf" data-hero-template="' . $id . '"' . ($template === $feature ? ' aria-current="true"' : '') . '>' . $escape($template['name']) . '</a>';
            }
            try { $mochi=self::mochiPreview(); }
            catch (\Throwable) { $mochi=['available'=>false]; }
            PageRenderer::render($root, 'landing.html', $view + [
                '{{HERO_SAMPLE}}' => $sampleImage,
                '{{HERO_OPTIONS}}' => $sampleLinks,
                '{{HERO_SAMPLE_STATE}}' => $feature === null ? ' hidden' : '',
                '{{HERO_UNAVAILABLE_STATE}}' => $feature === null ? '' : ' hidden',
                '{{HERO_SAMPLE_PDF}}' => $feature === null ? '/#designs' : '/samples/' . $escape($feature['id']) . '.pdf',
                '{{SITE_URL}}' => $escape($base . '/'),
                '{{SOCIAL_IMAGE}}' => $escape($base . '/img/social-preview.png'),
                '{{TEMPLATE_COUNT}}' => (string) count($templates),
                '{{TEMPLATE_CATALOGUE}}' => $encode($templates),
                '{{MOCHI_HIDDEN}}' => $mochi['available']?'':' hidden',
                '{{MOCHI_PREVIEW}}' => $encode($mochi),
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
