<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
$count = 0;
$check = static function (bool $condition,string $message) use (&$count): void { $count++;if(!$condition) throw new RuntimeException($message); };
$templates = ReGen\TemplateCatalog::all();
$check(count($templates) === 16,'The reviewed collection must contain 16 designs.');
$check(count(array_unique(array_column($templates,'id'))) === count($templates),'Template IDs must be unique.');
$check(count(array_filter($templates,static fn($t)=>$t['tier']==='basic'))===6,'Basic collection must contain six designs.');
$check(count(array_filter($templates,static fn($t)=>$t['tier']==='premium'))===10,'Premium collection must contain ten designs.');
$fingerprint = '';
foreach (['DocumentFonts','TemplateCatalog','DocumentStyle','ResumeTemplate','PortraitImage','ResumeWriting','Sanitizer','PdfService'] as $class) $fingerprint .= hash_file('sha256',$root.'/php/src/'.$class.'.php');
$samples = json_decode((string) file_get_contents($root.'/public/samples/catalog.json'),true,32,JSON_THROW_ON_ERROR);
$check($samples['version']===substr(hash('sha256',$fingerprint),0,12),'Sample PDFs are stale. Regenerate sample PDFs and thumbnails from the current engine.');
$check($samples['templates']===$templates,'Gallery metadata must match the current template collection.');
$styles=[];
$onboarding=(string) file_get_contents($root.'/public/js/auth.js');
foreach ($templates as $template) {
 $check(str_contains($onboarding,"'".$template['id']."'"),'New-account onboarding must retain the selected design: '.$template['id']);
 $check(in_array($template['tier'],['basic','premium'],true),'Invalid collection tier.');
 $check(array_key_exists($template['fontKey'],ReGen\DocumentFonts::all()),'Unbundled font family.');
 $html=ReGen\ResumeTemplate::buildHtml(ReGen\TemplateCatalog::sample($template['id']));
 $check(!str_contains($html,'<table')&&!str_contains($html,'float:'),'Resume uses a layout table or float: '.$template['id']);
 $check(!str_contains($html,'&#8203;'),'Invisible characters must not be inserted into resume words.');
 $check(substr_count($html,'<h1 ')===1&&str_contains($html,'<h2 '),'Resume hierarchy is not semantic.');
 $check(preg_match('/\.cv-header\{[^}]*position\s*:/',$html)!==1,'Positioning the identity block can scramble PDF extraction order.');
 $check(is_file($root.'/public/samples/'.$template['id'].'.pdf'),'Missing real PDF sample.');
 $check($template['photo'] === str_contains($html,'class="cv-photo"'), 'Sample portrait must follow template policy: '.$template['id']);
 $styles[]=hash('sha256',ReGen\TemplateCatalog::css($template['id']));
}
$check(count(array_unique($styles))===count($templates),'Every design needs its own typography treatment.');
$default=ReGen\Sanitizer::appearance([]);
$check($default['size']==='11','New documents must use readable 11 pt body type.');
$check(ReGen\Sanitizer::appearance(['size'=>'10.5'])['size']==='10.5','Explicit saved font sizes must be preserved.');
$check(ReGen\Sanitizer::appearance(['font'=>'arial'])['font']==='sans'&&ReGen\Sanitizer::appearance(['font'=>'times'])['font']==='serif','Legacy font choices must map to bundled export families.');
foreach (ReGen\DocumentFonts::all() as $face) foreach (['regular','bold'] as $weight) foreach (['ttf','woff2'] as $ext) $check(is_file($root.'/public/fonts/'.$face[$weight].'.'.$ext), 'Missing bundled face: '.$face[$weight]);
$check(count(array_filter($templates,static fn($t)=>$t['photo']))===4,'Four existing designs must have dedicated portrait layouts.');
$invalid=ReGen\Sanitizer::appearance(['font'=>'bad;font','size'=>'0','margins'=>'-99','lineHeight'=>'NaN','nameSize'=>'999','photoFocus'=>['top']]);
$check($invalid['size']==='11'&&$invalid['margins']==='balanced'&&$invalid['font']==='template'&&$invalid['lineHeight']==='template'&&$invalid['nameSize']==='template'&&$invalid['photoFocus']==='top','Invalid appearance input must not enter document CSS or crop geometry.');
$custom=['skills','education','summary'];
$check(array_slice(ReGen\Sanitizer::sectionOrder($custom),0,3)===$custom,'Existing section preferences must be preserved.');
$bad=ReGen\ResumeTemplate::buildHtml(['personal'=>['fullName'=>'<script>alert(1)</script>','email'=>'person@example.com','phone'=>'+60 12 555 0120','linkedin'=>'javascript:alert(1)'],'summary'=>'<img src=x onerror=alert(1)>']);
$check(!str_contains($bad,'<script>')&&!str_contains($bad,'<img src=x')&&!str_contains($bad,'href="javascript:'),'Resume fields must stay escaped and links must use permitted schemes.');
echo "Template collection, document structure, typography and sample freshness passed ($count assertions).\n";
