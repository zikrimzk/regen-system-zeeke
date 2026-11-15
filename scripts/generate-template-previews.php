<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
ReGen\Config::load($root);
$destination = $root . '/public/samples';
if (!is_dir($destination)) mkdir($destination,0700,true);
$pdf = new ReGen\PdfService();
foreach (ReGen\TemplateCatalog::all() as $template) {
    file_put_contents($destination . '/' . $template['id'] . '.pdf',$pdf->generate(ReGen\TemplateCatalog::sample($template['id'])));
}
$fingerprint = '';
foreach (['DocumentFonts','TemplateCatalog','DocumentStyle','ResumeTemplate','PortraitImage','ResumeWriting','Sanitizer','PdfService'] as $class) $fingerprint .= hash_file('sha256', $root . '/php/src/' . $class . '.php');
file_put_contents($destination . '/catalog.json', json_encode(['version'=>substr(hash('sha256',$fingerprint),0,12),'templates'=>ReGen\TemplateCatalog::all()],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) . "\n");
echo "Real sample PDFs generated for all template designs.\n";
