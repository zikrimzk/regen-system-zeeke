<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';ReGen\Config::load($root);
$out=$root.'/tmp/strict-package-review/letters';if(!is_dir($out))mkdir($out,0700,true);
$sample=ReGen\TemplateCatalog::sample('modern');$pdf=new ReGen\PdfService();$manifest=[];
$letter=['recipient'=>'Ms Aisha Hassan','company'=>'Example Studio','role'=>'Operations Specialist','recipient_address'=>"18 Example Road\n75000 Melaka, Malaysia",'letter_date'=>'2026-11-08','body'=>"I am applying for the Operations Specialist role at Example Studio. My experience coordinating project updates, preparing reports and documenting operating procedures would help me contribute to the organised delivery described in your role requirements.\n\nAt Syarikat Contoh, I coordinated cross-functional projects and maintained delivery schedules for a team of 12. I also created weekly reporting dashboards to help managers identify process bottlenecks. This work called for careful follow-up and clear communication with colleagues. I would bring the same attention to practical reporting and reliable coordination to your team.\n\nIn my earlier Project Coordinator role at Fieldwork Studio, I managed project documentation, communicated progress to internal stakeholders and organised client meetings. Keeping track of actions through to completion helped me develop a structured approach to day-to-day project support. These experiences provide a useful foundation for the responsibilities set out in your posting.\n\nI would welcome the opportunity to discuss how my experience could support your operations. Thank you for considering my application."];
$write=static function(string $name,array $resume,array $data,string $kind='standard',array $expected=[])use($pdf,$out,&$manifest):void{
    $html=ReGen\CoverLetterTemplate::buildHtml($resume,$data);
    file_put_contents($out.'/'.$name.'.html',$html);
    file_put_contents($out.'/'.$name.'.pdf',$pdf->generateHtml($html));
    $manifest[]=['name'=>$name,'kind'=>$kind,'size'=>$resume['appearance']['size']??'11','nameText'=>$resume['personal']['fullName'],'body'=>$data['body'],...$expected];
};
foreach(ReGen\TemplateCatalog::all() as $template){$resume=$sample;$resume['templateId']=$template['id'];$write($template['id'],$resume,$letter);}
foreach(['modern','classic'] as $id){$resume=$sample;$resume['templateId']=$id;$resume['appearance']=['size'=>'12'];$write($id.'-12pt',$resume,$letter);}
$write('long-letter',$sample,[...$letter,'body'=>str_repeat($letter['body']."\n\n",4)],'long');
$write('unnamed-recipient',$sample,[...$letter,'recipient'=>'','recipient_address'=>'']);
$compact=$sample;
$compact['appearance']=['margins'=>'compact','spacing'=>'compact','lineHeight'=>'1.25','nameSize'=>'22'];
$write('compact-letter',$compact,$letter,'standard',['marginPoints'=>19*72/25.4,'nameSize'=>22]);
$generous=$sample;
$generous['appearance']=['margins'=>'generous','spacing'=>'comfortable','lineHeight'=>'1.45','size'=>'12','nameSize'=>'30','color'=>'accent'];
$write('generous-letter',$generous,[...$letter,'body'=>str_repeat($letter['body']."\n\n",3)],'long',['marginPoints'=>72,'nameSize'=>30]);
file_put_contents($out.'/manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
echo count($manifest)." fictional cover-letter PDFs rendered. No provider requests.\n";
