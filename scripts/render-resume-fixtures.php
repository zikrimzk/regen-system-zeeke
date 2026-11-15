<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
$fixtures = require __DIR__ . '/resume-fixtures.php';
$baseline = in_array('--baseline',$argv,true);
$directory = $root . ($baseline ? '/tmp/pdfs/baseline' : '/tmp/pdfs/current');
if (!is_dir($directory)) mkdir($directory,0700,true);
$service = new ReGen\PdfService();
$manifest = [];
foreach (ReGen\TemplateCatalog::all() as $template) {
 foreach ($fixtures as $profile=>$resume) {
  if ($baseline && $profile !== 'professional' && !in_array($template['id'],['classic','modern','essential'],true)) continue;
  $resume['templateId'] = $template['id'];
  $name = $template['id'] . '-' . $profile;
  $html = ReGen\ResumeTemplate::buildHtml($resume);
  file_put_contents($directory . '/' . $name . '.html',$html);
  file_put_contents($directory . '/' . $name . '.pdf',$service->generate($resume));
  $manifest[] = ['id'=>$template['id'],'profile'=>$profile,'name'=>$name,'data'=>ReGen\Sanitizer::sanitizeResume($resume)];
  echo $name . "\n";
 }
 $letter = ReGen\CoverLetterTemplate::buildHtml(array_replace($fixtures['professional'],['templateId'=>$template['id']]),ReGen\TemplateCatalog::sampleLetter());
 file_put_contents($directory . '/' . $template['id'] . '-letter.pdf',$service->generateHtml($letter));
}
file_put_contents($directory . '/manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
echo count($manifest) . " resume fixtures rendered without database or external requests.\n";
