<?php
declare(strict_types=1);
namespace ReGen;

/** Writing preferences are separate from visual templates and never create applicant facts. */
final class ResumeWriting
{
    public const EXTRA_HEADINGS = [
        'research'=>'Research Experience', 'publications'=>'Publications',
        'teaching'=>'Teaching Experience', 'presentations'=>'Presentations',
        'funding'=>'Grants and Funding', 'affiliations'=>'Professional Affiliations',
        'interests'=>'Interests', 'custom'=>'Additional Information',
    ];

    public static function settings(mixed $value): array
    {
        $value=is_array($value)?$value:[];
        $choice=static fn(string $key,array $allowed,string $default):string=>in_array($value[$key]??'', $allowed,true)?$value[$key]:$default;
        return [
            'documentType'=>$choice('documentType',['resume','academic-cv'],'resume'),
            'careerStage'=>$choice('careerStage',['auto','graduate','experienced','career-change'],'auto'),
            'profileType'=>$choice('profileType',['summary','objective'],'summary'),
            'dateOrder'=>$choice('dateOrder',['entered','newest'],'entered'),
            'jobDescription'=>Sanitizer::cleanText($value['jobDescription']??'',true,6000),
        ];
    }

    public static function additional(mixed $value): array
    {
        $result=[];
        foreach(array_slice(is_array($value)?$value:[],0,8) as $block){
            if(!is_array($block))continue;
            $kind=is_string($block['kind']??null)&&array_key_exists($block['kind'],self::EXTRA_HEADINGS)?$block['kind']:'custom';
            $title=$kind==='custom'?Sanitizer::cleanText($block['title']??'',false,60):self::EXTRA_HEADINGS[$kind];
            $items=array_map(static fn($item)=>Sanitizer::cleanText($item,false,1200),array_slice(Sanitizer::cleanBullets($block['items']??[]),0,50));
            $items=array_values(array_filter($items,static fn($item)=>$item!==''));
            if($items!==[])$result[]=['kind'=>$kind,'title'=>$title?:'Additional Information','items'=>$items];
        }
        return $result;
    }

    /** Unknown dates retain their positions; only dated entries are sorted, stably. */
    public static function orderedEntries(array $entries, string $order): array
    {
        if($order!=='newest')return $entries;
        $dated=[];$slots=[];
        foreach($entries as $index=>$entry){
            $start=self::dateValue((string)($entry['startDate']??''));
            $end=self::dateValue((string)($entry['endDate']??''));
            $key=$end??$start;
            if($key!==null){$slots[]=$index;$dated[]=['entry'=>$entry,'key'=>$key,'start'=>$start??0,'index'=>$index];}
        }
        usort($dated,static fn($a,$b)=>($b['key']<=>$a['key'])?:($b['start']<=>$a['start'])?:($a['index']<=>$b['index']));
        foreach($slots as $index=>$slot)$entries[$slot]=$dated[$index]['entry'];
        return $entries;
    }

    public static function dateValue(string $value): ?int
    {
        if(preg_match('/^(present|current|ongoing)$/i',trim($value)))return 999999;
        if(preg_match('/^(\d{4})(?:-(0[1-9]|1[0-2]))?$/D',trim($value),$match))return (int)$match[1]*12+(int)($match[2]??12);
        return null;
    }

    public static function filename(array $resume, string $kind='resume'): string
    {
        $name=Sanitizer::cleanText($resume['personal']['fullName']??'',false,80);
        $ascii=function_exists('iconv')?@iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$name):$name;
        $name=trim((string)preg_replace('/[^a-z0-9]+/i','_',(string)$ascii),'_')?:'Application';
        $label=$kind==='letter'?'Cover_Letter':((self::settings($resume['writing']??[])['documentType']==='academic-cv')?'CV':'Resume');
        return $name.'_'.$label.'.pdf';
    }
}
