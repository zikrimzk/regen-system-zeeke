<?php
declare(strict_types=1);
namespace ReGen;

/** A letter shares the resume's typeface, with its own business-letter geometry. */
final class CoverLetterTemplate
{
    public static function buildHtml(array $resume,array $letter): string
    {
        $resume=Sanitizer::sanitizeResume($resume);$p=$resume['personal'];$settings=$resume['appearance'];
        $template=TemplateCatalog::get($resume['templateId']);$fontKey=$settings['font']==='template'?$template['fontKey']:$settings['font'];
        $font=DocumentFonts::stack($fontKey);$size=(float)$settings['size'];$contactSize=max(10,$size-.5);
        $margin=match($settings['margins']){'compact'=>19,'generous'=>25.4,default=>23};
        $leading=$settings['lineHeight']==='template'?match($settings['spacing']){'compact'=>1.25,'comfortable'=>1.45,default=>1.35}:(float)$settings['lineHeight'];
        $paragraphGap=match($settings['spacing']){'compact'=>8,'comfortable'=>14,default=>11};
        $accent=$settings['color']==='accent'?$template['accent']:'#202328';
        $nameSize=$settings['nameSize']==='template'?23:(int)$settings['nameSize'];
        $escape=static fn(mixed $s):string=>htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
        $name=$p['fullName']??'';$recipient=trim((string)($letter['recipient']??''))?:'Hiring Manager';
        $contacts=array_filter([$p['email']??'',$p['phone']??'',$p['address']??'']);
        $dateValue=$letter['letter_date']??substr((string)($letter['created_at']??gmdate('Y-m-d')),0,10);
        $date=\DateTimeImmutable::createFromFormat('!Y-m-d',(string)$dateValue,new \DateTimeZone('UTC'));
        $content='<header class="letter-heading"><h1>'.$escape($name).'</h1><p class="letter-contact">'.implode(' &nbsp;·&nbsp; ',array_map($escape,$contacts)).'</p></header>';
        $content.='<main><p class="letter-date">'.$escape($date?$date->format('j F Y'):'').'</p><div class="letter-recipient"><p>'.$escape($recipient).'</p>';
        if(trim((string)($letter['company']??''))!=='')$content.='<p>'.$escape($letter['company']).'</p>';
        foreach(preg_split('/\R/u',(string)($letter['recipient_address']??''))?:[] as $line)if(trim($line)!=='')$content.='<p>'.$escape(trim($line)).'</p>';
        $content.='</div>';
        if(trim((string)($letter['role']??''))!=='')$content.='<p class="letter-subject">Application for '.$escape($letter['role']).'</p>';
        $content.='<p class="letter-greeting">Dear '.$escape($recipient).',</p><div class="letter-body">';
        $paragraphs=array_values(array_filter(preg_split('/\n\s*\n/u',str_replace(["\r\n","\r"],"\n",(string)($letter['body']??'')))?:[],static fn(string $p):bool=>trim($p)!==''));
        $last=array_pop($paragraphs);
        foreach($paragraphs as $paragraph)$content.='<p>'.$escape(preg_replace('/\s*\n\s*/u',' ',trim($paragraph))).'</p>';
        $content.='</div><div class="letter-ending'.($last!==null&&mb_strlen($last)>700?' is-long':'').'"><div class="letter-body">'.($last!==null?'<p>'.$escape(preg_replace('/\s*\n\s*/u',' ',trim($last))).'</p>':'').'</div><div class="letter-closing"><p>'.($recipient==='Hiring Manager'?'Yours faithfully,':'Yours sincerely,').'</p><p class="letter-signature">'.$escape($name).'</p></div></div></main>';
        $css=DocumentFonts::css($fontKey)."@page{size:A4 portrait;margin:{$margin}mm}*{box-sizing:border-box}html{background:#fff}body,h1,p,div{margin:0;padding:0}body{font-family:{$font};font-size:{$size}pt;line-height:{$leading};color:#202328;background:#fff;word-wrap:break-word;overflow-wrap:break-word}p{orphans:3;widows:3}h1{color:{$accent};font-size:{$nameSize}pt;line-height:1.15;font-weight:700;letter-spacing:-.3pt}.letter-heading{padding-bottom:13pt;margin-bottom:20pt;border-bottom:.6pt solid #c4c8cb;page-break-inside:avoid}.letter-contact{font-size:{$contactSize}pt;line-height:1.4;color:#454b52;margin-top:6pt}.letter-date{margin-bottom:16pt}.letter-recipient{margin-bottom:16pt;page-break-inside:avoid}.letter-recipient p{line-height:1.35}.letter-subject{color:{$accent};font-weight:700;margin-bottom:15pt;page-break-after:avoid}.letter-greeting{margin-bottom:12pt;page-break-after:avoid}.letter-body p{margin-bottom:{$paragraphGap}pt;text-align:left;text-indent:0}.letter-ending{page-break-inside:avoid}.letter-ending.is-long{page-break-inside:auto}.letter-closing{margin-top:16pt;page-break-inside:avoid}.letter-signature{margin-top:21pt;font-weight:700}@media screen{body{width:794px;min-height:1123px;margin:auto;padding:{$margin}mm}}";
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cover letter</title><style>'.$css.'</style></head><body>'.$content.'</body></html>';
    }
}
