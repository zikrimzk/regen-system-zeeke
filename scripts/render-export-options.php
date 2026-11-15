<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';
$destination=$root.'/tmp/pdfs/options';if(!is_dir($destination))mkdir($destination,0700,true);
$sample=ReGen\TemplateCatalog::sample('modern');
$sample['personal']['fullName']='Anaïs O’Connor Muñoz';
$sample['personal']['address']='São Paulo, Brazil';
$sample['summary']='Operations specialist with experience coordinating projects and documenting clear procedures for international teams. Brings a thoughtful approach to analysis, communication and service delivery.';
$image=imagecreatetruecolor(60,80);imagefill($image,0,0,imagecolorallocate($image,86,112,125));ob_start();imagepng($image);$photo='data:image/png;base64,'.base64_encode((string)ob_get_clean());
$allSections=$sample;
$allSections['summary']='Operations specialist who coordinates projects, improves reporting and documents reliable procedures.';
$allSections['experience']=[$sample['experience'][0]];
$allSections['experience'][0]['bullets']=[$sample['experience'][0]['bullets'][0]];
$allSections['education'][0]['cgpa']='First Class Honours';
$allSections['education'][0]['academicResultType']='grade';
$allSections['skills']['custom']=[['label'=>'Methods','value'=>'Process mapping, service design']];
$allSections['projects']=[['title'=>'Service Reporting Toolkit','type'=>'Internal project','description'=>'Reusable reporting and documentation templates.','bullets'=>['Designed a clear handover process for the support team.']]];
$allSections['achievements']=['Received a team recognition award for service improvement.'];
$allSections['extracurricular']=[['organization'=>'Community Learning Centre','role'=>'Volunteer Coordinator','bullets'=>['Coordinated weekend learning sessions with six volunteers.']]];
$allSections['references']=[['name'=>'Jamie Lim','position'=>'Operations Manager','email'=>'jamie.lim@example.com','phone'=>'+60 12 555 0193']];
$cases=[
 'unicode-sans'=>['templateId'=>'modern','appearance'=>['font'=>'sans','size'=>'11','spacing'=>'compact']],
 'unicode-serif'=>['templateId'=>'classic','appearance'=>['font'=>'serif','size'=>'11.5','spacing'=>'comfortable','color'=>'accent']],
 'legacy-arial'=>['templateId'=>'editorial','appearance'=>['font'=>'arial','size'=>'10.5','spacing'=>'compact']],
 'optional-photo'=>['templateId'=>'essential','showPhoto'=>true,'personal'=>array_replace($sample['personal'],['photoBase64'=>$photo])],
 'all-sections-sans'=>array_replace($allSections,['templateId'=>'modern']),
 'all-sections-serif'=>array_replace($allSections,['templateId'=>'classic']),
];
foreach (array_keys(ReGen\DocumentFonts::all()) as $font) $cases['font-'.$font]=['templateId'=>'modern','appearance'=>['font'=>$font]];
foreach (['left','right'] as $side) foreach (['portrait','square'] as $shape) $cases['photo-'.$side.'-'.$shape]=['templateId'=>'essential','appearance'=>['photoPosition'=>$side,'photoShape'=>$shape], 'personal'=>array_replace($sample['personal'],['photoBase64'=>$photo])];
$cases['photo-ignored-text']=['templateId'=>'modern','showPhoto'=>true,'personal'=>array_replace($sample['personal'],['photoBase64'=>$photo])];
$cases['missing-photo-left']=['templateId'=>'essential','appearance'=>['photoPosition'=>'left'], 'personal'=>array_replace($sample['personal'],['photoBase64'=>''])];
$cases['long-photo-header']=['templateId'=>'essential','appearance'=>['photoPosition'=>'left'], 'personal'=>array_replace($sample['personal'],['fullName'=>'Anaïs O’Connor Muñoz de Albuquerque e Costa Pereira','photoBase64'=>$photo,'linkedin'=>'https://example.com/'.str_repeat('professional-project-',8)])];
$cases['custom-layout']=['templateId'=>'keystone','appearance'=>['font'=>'lato','size'=>'12','nameSize'=>'30','headingSize'=>'13','lineHeight'=>'1.45','margins'=>'compact','headingStyle'=>'uppercase','dates'=>'inline','color'=>'accent']];
$pdf=new ReGen\PdfService();
foreach($cases as $name=>$settings){$data=array_replace($sample,$settings);$html=ReGen\ResumeTemplate::buildHtml($data);file_put_contents($destination.'/'.$name.'.html',$html);file_put_contents($destination.'/'.$name.'.pdf',$pdf->generateHtml($html));}
echo count($cases)." export-option samples rendered with fictional data.\n";
