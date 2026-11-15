<?php
declare(strict_types=1);
namespace ReGen;

/** Local writing heuristics, not a vendor ATS test, truth verifier or grammar checker. */
final class ResumeReview
{
    private const VERBS='achieved advised analyzed analysed assessed assisted audited automated authored built calculated coached collaborated coordinated created delivered designed developed directed documented edited evaluated facilitated guided implemented improved increased investigated launched led maintained managed mentored moderated negotiated optimized optimised organized organised planned prepared presented produced published reconciled reduced researched resolved reviewed scheduled simplified spearheaded supported taught tested trained tutored updated wrote';

    public static function analyze(array $value): array
    {
        $r=Sanitizer::sanitizeResume($value);$p=$r['personal'];$writing=$r['writing'];
        $checks=[];$recommendations=[];$strengths=[];$points=0;$possible=0;
        $add=static function(string $label,bool $pass,int $weight,string $detail,string $advice)use(&$checks,&$recommendations,&$strengths,&$points,&$possible):void{
            $possible+=$weight;if($pass){$points+=$weight;$strengths[]=$label;}else{$recommendations[]=$advice;}
            $checks[]=['label'=>$label,'status'=>$pass?'pass':'improve','detail'=>$detail];
        };
        $info=static function(string $label,string $detail)use(&$checks):void{$checks[]=['label'=>$label,'status'=>'info','detail'=>$detail];};
        $phone=preg_replace('/\D/','',$p['phone']);
        $contact=$p['fullName']!==''&&filter_var($p['email'],FILTER_VALIDATE_EMAIL)!==false&&strlen($phone)>=7&&strlen($phone)<=15;
        $add('Contact essentials',$contact,18,$contact?'Name, a valid email format and a plausible phone length are present.':'Check your name, email format and phone number.','Add your name, a valid email and a reachable phone number.');
        $add('Role headline',$p['jobTitle']!=='',6,$p['jobTitle']!==''?'A role headline is present; confirm it describes your actual background or clearly states your target.':'A concise role headline would clarify the application.','Add a clear role headline without inflating your title or experience.');
        if($r['summary']!==''){
            $words=self::words($r['summary']);$max=$writing['profileType']==='objective'?65:90;
            $pass=$words>=12&&$words<=$max;
            $add($writing['profileType']==='objective'?'Focused objective':'Focused profile',$pass,8,$pass?'The profile is short enough to scan. Check that it adds relevant evidence.':'Keep the profile concise and specific; a short useful objective is valid.','Use a few focused sentences connecting real strengths to the role. Avoid padding or generic praise.');
        }else{$info('Optional profile','A summary or objective is optional. Add one only if it explains your fit.');}

        $evidence=[];$bullets=[];
        foreach(['experience','projects','extracurricular'] as $section){
            foreach($r[$section] as $entry){
                $text=trim(($entry['description']??'').' '.implode(' ',$entry['bullets']??[]));
                if(self::words($text)>=4)$evidence[]=$text;
                foreach($entry['bullets']??[] as $bullet)if(trim($bullet)!=='')$bullets[]=$bullet;
            }
        }
        foreach($r['additional'] as $block)if(in_array($block['kind'],['research','teaching','publications','presentations','funding'],true))foreach($block['items'] as $item)if(self::words($item)>=4)$evidence[]=$item;
        $hasEvidence=$evidence!==[];
        $add('Relevant evidence',$hasEvidence,22,$hasEvidence?'Work, projects, volunteering or academic contributions provide material to assess.':'A title alone does not explain a contribution.','Describe a real contribution from work, a project, study or volunteering. Paid employment is not required.');
        if($r['education']!==[]){
            $complete=count(array_filter($r['education'],static fn($e)=>$e['degree']!==''&&$e['institution']!==''))===count($r['education']);
            $add('Education details',$complete,6,$complete?'Qualification and institution names are present. Grades remain optional.':'Check the qualification and institution names.','Complete the official qualification and institution names. Keep studying and completed qualifications distinct.');
        }elseif($writing['careerStage']==='graduate'||$writing['documentType']==='academic-cv'){
            $add('Education details',false,6,'Education is useful for the selected application type.','Add your current or highest relevant qualification, including an expected completion date where appropriate.');
        }else{$info('Education','Include relevant education when useful or requested; it is not a universal completeness requirement.');}

        $skillValues=[];
        foreach(['technical','software','interpersonal','language'] as $key)if($r['skills'][$key]!=='')$skillValues[]=$r['skills'][$key];
        foreach($r['skills']['custom'] as $item)if($item['value']!=='')$skillValues[]=$item['value'];
        $hasSkills=$skillValues!==[];
        $add('Specific skills',$hasSkills,12,$hasSkills?'Skills are listed. Verify relevance and support them with examples.':'Specific tools, methods or other relevant skills would help.','List skills you can explain and use. Do not add a job requirement unless it is true of you.');

        if($bullets!==[]){
            $clear=count(array_filter($bullets,static fn($b)=>self::words($b)>=4&&self::words($b)<=40));
            $ratio=$clear/count($bullets);
            $add('Readable contributions',$ratio>=.75,12,"$clear of ".count($bullets).' contribution bullets are within a useful scanning length.','Keep each contribution to one main idea. Shorten long points without losing context or a genuine result.');
            $actions=count(array_filter($bullets,static fn($b)=>self::action($b)));
            $add('Active wording',$actions/count($bullets)>=.5,8,"$actions of ".count($bullets).' contribution bullets start with a recognised action verb; this is a limited local check.','Start contributions with a specific action such as prepared, built, supported, researched or taught. Preserve your actual level of responsibility.');
            $concrete=count(array_filter($bullets,static fn($b)=>self::words($b)>=8&&self::action($b)));
            $add('Concrete contributions',$concrete>0,10,$concrete>0?'At least one point describes an action with supporting context. Numbers are not required.':'Give an action some context or an evidenced outcome.','Explain what you did, how or for whom, and the result when known. Qualitative evidence is valid; never invent a metric.');
            $duplicates=count($bullets)-count(array_unique(array_map(static fn($b)=>mb_strtolower(trim(preg_replace('/[^\p{L}\p{N}]+/u',' ',$b))),$bullets)));
            $add('Distinct evidence',$duplicates===0,5,$duplicates===0?'No identical contribution bullets were found.':"$duplicates repeated contribution bullets were found.",'Remove duplicated points or explain a distinct contribution for each entry.');
        }elseif($hasEvidence){$info('Contribution style','Descriptive academic entries can be valid without action-led bullets. Check that your own contribution and status are clear.');}

        $dateIssues=[];$dateStyles=[];$outOfOrder=false;
        foreach(['experience','education'] as $section){
            $last=null;
            foreach($r[$section] as $entry){
                $start=trim($entry['startDate']??'');$end=trim($entry['endDate']??'');
                foreach([$start,$end] as $date){
                    if($date==='')continue;
                    if(ResumeWriting::dateValue($date)===null)$dateIssues[]='Use consistent year or year-month dates, or Present for an ongoing role.';
                    elseif(!preg_match('/^(present|current|ongoing)$/i',$date))$dateStyles[]=strlen($date)===4?'year':'month';
                }
                $a=ResumeWriting::dateValue($start);$b=ResumeWriting::dateValue($end);
                if($a!==null&&$b!==null&&$a>$b)$dateIssues[]='An end date is earlier than its start date.';
                if($section==='experience'&&($start===''||$end===''))$dateIssues[]='Check missing work dates; use Present only for a genuinely ongoing role.';
                $key=$b??$a;
                if($key!==null){if($last!==null&&$key>$last)$outOfOrder=true;$last=$key;}
            }
        }
        if(count(array_unique($dateStyles))>1)$dateIssues[]='Year-only and month-year dates are mixed; use a consistent level of detail where known.';
        if($r['experience']!==[]||$r['education']!==[])$add('Consistent dates',$dateIssues===[],8,$dateIssues===[]?'Supplied dates have consistent recognised formats and plausible ordering within each entry.':implode(' ',array_unique($dateIssues)),'Review missing, inconsistent or reversed dates. Confirm every date against your own records.');
        if($outOfOrder&&$writing['dateOrder']==='entered')$info('Entry order','Some dated entries are not newest first. Choose Newest first in Document settings, or keep a deliberate order. No gap explanation is assumed.');
        $info('Targeting',$writing['jobDescription']!==''?'Job notes are available to guide AI relevance. They do not prove applicant skills or produce a job-match score.':'Add a job description in Document settings to give AI a target. General editing still works without it.');
        $info('Document length',$writing['documentType']==='academic-cv'?'Academic CVs can be longer. Follow discipline and employer requirements; retain accurate research and publication status.':'For most job applications, keep relevant material concise, often one or two pages. Review the actual PDF; no automatic page limit is enforced.');
        $info('Export structure','ReGen uses one reading column, standard headings and selectable PDF text. This check has not parsed your exported PDF in an employer ATS.');
        if($r['showPhoto'])$info('Photo','This design has a portrait layout. Choose a text-only design for online applications unless the employer or local convention requests a photo.');
        if($r['references']!==[])$info('References','Include referees only when requested or appropriate for this application, and obtain their permission.');
        $info('Human proofreading','Check names, links, dates, grammar, punctuation and every factual claim. Local checks cannot verify truth or certify spelling and grammar.');

        $score=$possible?max(0,min(100,(int)round($points*100/$possible))):0;
        // OPTIONAL FIELDS AND CERTIFICATION YEARS NEVER RAISE THE SCORE AS EVIDENCE.
        if(!$hasEvidence)$score=min($score,54);
        if(!$contact)$score=min($score,69);
        $label=$score>=85?'Strong foundation':($score>=70?'Worth refining':($score>=55?'Developing':'Needs attention'));
        return ['score'=>$score,'label'=>$label,'summary'=>$score>=85?'Your draft has a clear foundation. Check its accuracy, tailor the evidence and inspect the actual PDF before applying.':'Use the priority edits to make your real qualifications easier to assess. The checklist measures writing signals, not hiring chances or an employer ATS result.',
            'checks'=>$checks,'recommendations'=>array_slice(array_values(array_unique($recommendations)),0,5),'strengths'=>array_slice($strengths,0,4),'reviewKind'=>'local-writing-readiness'];
    }

    private static function action(string $text): bool
    {
        preg_match('/^\s*([\p{L}-]+)/u',$text,$match);$word=mb_strtolower($match[1]??'');
        $verbs=explode(' ',self::VERBS.' achieve analyze analyse assess automate author build calculate coach collaborate coordinate create deliver design develop document edit evaluate implement improve increase investigate launch lead maintain manage mentor negotiate optimize optimise organize organise plan prepare present produce reconcile reduce research resolve review schedule simplify support teach test train tutor update write');
        if(in_array($word,$verbs,true))return true;
        foreach($verbs as $verb)if(in_array($word,[$verb.'s',$verb.'es',preg_replace('/y$/','ies',$verb)],true))return true;
        return false;
    }

    private static function words(string $text): int
    {
        preg_match_all('/[\p{L}\p{N}][\p{L}\p{N}\'+.-]*/u',$text,$m);return count($m[0]??[]);
    }
}
