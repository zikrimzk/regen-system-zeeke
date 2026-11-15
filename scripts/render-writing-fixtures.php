<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$root=dirname(__DIR__);require $root.'/vendor/autoload.php';
$fixtures=require __DIR__.'/resume-fixtures.php';$dest=$root.'/tmp/pdfs/writing';if(!is_dir($dest))mkdir($dest,0700,true);
$pdf=new ReGen\PdfService();$manifest=[];
$write=static function(string $name,array $data,array $expected,string $type='resume',?array $letter=null)use($pdf,$dest,&$manifest):void{
 $html=$letter===null?ReGen\ResumeTemplate::buildHtml($data):ReGen\CoverLetterTemplate::buildHtml($data,$letter);
 file_put_contents($dest.'/'.$name.'.pdf',$pdf->generateHtml($html));
 $manifest[]=['name'=>$name,'type'=>$type,'expected'=>$expected,'profile'=>$data['personal']['fullName'],'body_size'=>(float)($data['appearance']['size']??'11')];
};
foreach(['modern','classic'] as $id){
 $graduate=$fixtures['graduate'];$graduate['templateId']=$id;$graduate['writing']=['careerStage'=>'graduate','profileType'=>'objective','jobDescription'=>'PRIVATE TARGET NOTES MUST NOT APPEAR IN THE PDF'];
 $graduate['summary']='Computer science graduate seeking a software engineering role, bringing accessible web development experience from student projects and an internship. Offers practical SQL skills and clear technical documentation.';
 $graduate['personal']['portfolio']='https://portfolio.example/amelia';
 $write($id.'-objective',$graduate,['Objective',$graduate['summary'],'https://portfolio.example/amelia'],'objective');
 $cv=$fixtures['senior'];$cv['templateId']=$id;$cv['writing']=['documentType'=>'academic-cv'];$cv['sectionOrder']=['summary','education','additional','experience','skills'];
 $cv['additional']=[['kind'=>'research','items'=>['Research associate, Example Policy Institute, 2023-2025. Analysed supplied operational datasets and documented the study methods.']],['kind'=>'publications','items'=>['Rahman, N. and Tan, A. (2025). Operational reporting practices. Example Research Journal (fictional), 4(2), 10-24.','Rahman, N. (2026). Accessible financial information. Submitted manuscript.']],['kind'=>'teaching','items'=>['Guest tutor, Example Learning Centre, 2024. Prepared workshops on spreadsheet reporting.']],['kind'=>'funding','items'=>['Community Data Fellowship application, 2026. Submitted; decision pending.']],['kind'=>'affiliations','items'=>['Example Research Association, member since 2024.']]];
 $expected=['Research Experience','Publications','Submitted manuscript.','decision pending.','Teaching Experience','Grants and Funding','Professional Affiliations'];
 $write($id.'-cv',$cv,$expected,'cv');
 if($id==='modern'){
  $long=$cv;$items=[];for($i=1;$i<=50;$i++)$items[]='Rahman, N. and Tan, A. (2025). Fictional methods study '.$i.'. Example Research Journal (fictional). Reviewed reporting workflows, documented reproducible analysis and described the study limitations for an academic audience.';
  $long['additional'][1]['items']=$items;$write('academic-long-cv',$long,['Fictional methods study 1.','Fictional methods study 50.','Submitted; decision pending.'],'long-cv');
 }
}
$career=$fixtures['professional'];$career['templateId']='atlas';$career['writing']=['careerStage'=>'career-change','profileType'=>'objective'];$career['summary']='Operations specialist moving into project coordination, bringing experience maintaining delivery schedules, preparing team reports and documenting procedures. Seeking to apply these transferable skills in a project support role.';
$write('career-change',$career,['Objective',$career['summary']],'objective');
$body="I am applying for the Operations Specialist role at Example Studio. My experience coordinating project updates, preparing reports and documenting operating procedures would help me contribute to the organised delivery described in your role requirements.\n\nAt Syarikat Contoh, I coordinated cross-functional projects and maintained delivery schedules for a team of 12. I also created weekly reporting dashboards to help managers identify process bottlenecks. This work called for careful follow-up and clear communication with colleagues. I would bring the same attention to practical reporting and reliable coordination to your team.\n\nIn my earlier Project Coordinator role at Fieldwork Studio, I managed project documentation, communicated progress to internal stakeholders and organised client meetings. Keeping track of actions through to completion helped me develop a structured approach to day-to-day project support. These experiences provide a useful foundation for the responsibilities set out in your posting.\n\nI would welcome the opportunity to discuss how my experience could support your operations. Thank you for considering my application.";
foreach(ReGen\TemplateCatalog::all() as $template){
 $data=$fixtures['professional'];$data['templateId']=$template['id'];$letter=['company'=>'Example Studio','role'=>'Operations Specialist','recipient'=>'Hiring Manager','body'=>$body];
 $write($template['id'].'-full-letter',$data,['team of 12','Fieldwork Studio','Thank you for considering my application.'],'letter',$letter);
 foreach(['10','12'] as $size){
  $data['appearance']=['size'=>$size];
  $write($template['id'].'-size-'.$size.'-resume',$data,[$data['summary'],'Syarikat Contoh'],'sized-resume');
  $write($template['id'].'-size-'.$size.'-letter',$data,['team of 12','Thank you for considering my application.'],'letter',$letter);
 }
}
file_put_contents($dest.'/manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
echo count($manifest)." writing-specific PDF fixtures rendered. Fictional inputs only; these are not live AI generations.\n";
