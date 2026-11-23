<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
$assertions = 0;
$check = static function (bool $passed, string $message) use (&$assertions): void {
    if (!$passed) throw new RuntimeException($message);
    $assertions++;
};
$dom = new DOMDocument();
libxml_use_internal_errors(true);
$dom->loadHTML((string) file_get_contents($root . '/php/views/landing.html'));
libxml_clear_errors();
$xpath = new DOMXPath($dom);
$check($xpath->query('//link[@rel="stylesheet"]')->length === 1, 'Landing must use one public stylesheet.');
$check(filesize($root . '/public/css/site.css') < 65000, 'Public stylesheet exceeded its 65 KB budget.');
$fonts=$xpath->query('//link[@rel="preload"][@as="font"]');
$check($fonts->length===1&&$fonts->item(0)->getAttribute('href')==='/fonts/Inter-Latin.woff2'&&filesize($root.'/public/fonts/Inter-Latin.woff2')<200000,'Preload the shared local variable interface font within its 200 KB budget.');
$check(str_contains(file_get_contents($root.'/public/css/main.css'),'--font: "Inter",system-ui')&&!str_contains(file_get_contents($root.'/public/css/landing.css'),'ReGen Interface'),'Use one shared UI type family across the public and signed-in experiences.');
$check($xpath->query('//*[@id="comfort-title"]')->length===0,'The appearance-only feature section must be removed.');
$check($xpath->query('//*[@id="the-difference"]')->length===0,'The removed application steps section must not return.');
$check($xpath->query('//*[@id="goals"]//li')->length === 4, 'Four compact career steps connect the product story.');
$check($xpath->query('//*[@id="studio"]//a[@href="/resume-templates"]')->length === 1, 'Resume Studio points to the public templates gallery.');
$check($xpath->query('//*[@id="letters"]//a[@href="/cover-letters"]')->length === 1, 'The letters CTA opens the actual signed-in workspace.');
$check($xpath->query('//*[@id="premium"]//a[@href="/pricing"]')->length === 1, 'The packages invitation opens the real catalogue.');
$check($xpath->query('//*[contains(@class,"tool-grid")]/article')->length === 6, 'The mobile-first grid presents six primary career tools.' );
$check($xpath->query('//*[@id="faq-title"]//details')->length === 8, 'The public FAQ answers eight questions.');
$check(!str_contains(file_get_contents($root.'/php/views/landing.html'), 'kerjayaku-world.svg'), 'Legacy landmark artwork must stay off the public critical path.');
foreach (ReGen\PublicProduct::MEDIA as [$name, $width, $height]) {
    foreach (['en','ms'] as $locale) {
        $file = "$root/public/img/marketing/studios/$name-$locale.webp";
        $size = getimagesize($file);
        $check($size && $size[0] === $width && $size[1] === $height && $size['mime'] === 'image/webp' && filesize($file) < 120000,
            'Invalid marketing screenshot: '.basename($file));
    }
}
foreach (['resume','letter'] as $studio) {
    foreach (['en','ms'] as $locale) {
        $file = "$root/public/img/marketing/studios/$studio-mobile-2x-$locale.webp";
        $size = getimagesize($file);
        $check($size && $size[0] === 780 && $size[1] === 1688 && $size['mime'] === 'image/webp' && filesize($file) < 120000,
            'The 2x phone capture must preserve the mobile viewport.');
    }
}
$future = gmdate('Y-m-d H:i:s', time() + 3600);
$past = gmdate('Y-m-d H:i:s', time() - 3600);
$sampleOffer = ['name'=>'Fixture <offer>', 'discount_percent'=>15, 'promotion_ends_at'=>$future];
$check(str_contains(ReGen\PublicProduct::promotion([$sampleOffer]), 'Fixture &lt;offer&gt;'), 'Active public offers use escaped catalogue copy.');
$check(!str_contains(ReGen\PublicProduct::promotion([['promotion_ends_at'=>$past] + $sampleOffer]), 'data-offer-until'), 'Expired offers fall back to the evergreen product message.');
$check($xpath->query('//iframe')->length === 0, 'The landing must keep sample documents off its critical path.');
foreach ($xpath->query('//button[@aria-label]') as $button) {
    foreach ((new DOMXPath($dom))->query('.//*[@aria-hidden="true"]', $button) as $decorative) $decorative->parentNode->removeChild($decorative);
    $text = trim((string) preg_replace('/\s+/', ' ', $button->textContent));
    $check($text === '' || str_contains(mb_strtolower($button->getAttribute('aria-label')), mb_strtolower($text)), 'Visible button text must be part of its accessible name: ' . $text);
}
$bytes = [320 => 0, 640 => 0, 1280 => 0];
foreach (ReGen\TemplateCatalog::all() as $template) {
    foreach ([320 => 453, 640 => 905, 1280 => 1810] as $width => $height) {
        $file = $root . '/public/img/templates/' . $template['id'] . '-' . $width . '.webp';
        $size = getimagesize($file);
        $check($size !== false && $size[0] === $width && $size[1] === $height && $size['mime'] === 'image/webp', 'Invalid responsive preview: ' . basename($file));
        $bytes[$width] += filesize($file);
    }
}
$count = count(ReGen\TemplateCatalog::all());
$check($bytes[320] < $count * 25000 && $bytes[640] < $count * 70000 && $bytes[1280] < $count * 180000, 'Preview collection exceeded its per-design image budgets.');
$logo = imagecreatefromwebp($root . '/public/img/brand-wordmark-116.webp');
$check($logo !== false && imagesx($logo) === 116 && ((imagecolorat($logo,0,0) >> 24) & 127) === 127, 'Wordmark must preserve transparent corners.');
$raw = ReGen\ResumeTemplate::buildHtml(ReGen\TemplateCatalog::sample('modern'));
$browser = ReGen\TemplateCatalog::browserHtml($raw);
$check(str_contains($raw, '/fonts/Inter-Regular.ttf') && !str_contains($raw, '.woff2'), 'PDF font sources must remain unchanged.');
$check(str_contains($browser, '/fonts/Inter-Regular.woff2') && str_contains($browser, '/fonts/Inter-SemiBold.woff2') && !str_contains($browser, '.ttf'), 'Browser previews must use compressed copies of the document fonts.');
echo "Public asset, label, image and preview checks passed ($assertions assertions; no network requests).\n";
echo "Complete preview collection: {$bytes[320]} bytes at 320 px, {$bytes[640]} bytes at 640 px, {$bytes[1280]} bytes at 1280 px.\n";
