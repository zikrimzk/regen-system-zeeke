<?php
declare(strict_types=1);
namespace ReGen;

/** Print-first geometry: one reading column, flowing text and an intentional masthead. */
final class DocumentStyle
{
    public static function base(mixed $id, mixed $preferences = []): string
    {
        $template = TemplateCatalog::get($id);
        $settings = Sanitizer::appearance($preferences);
        $fontKey = $settings['font'] === 'template' ? $template['fontKey'] : $settings['font'];
        $font = DocumentFonts::stack($fontKey);
        $base = <<<CSS
@page{size:A4 portrait;margin:18mm}
*{box-sizing:border-box}html{background:#fff}body,h1,h2,h3,p,div,ul,li{margin:0;padding:0}
body{font-family:{$font};font-size:11pt;line-height:1.3;color:#222;background:#fff;word-wrap:break-word;overflow-wrap:break-word}
strong,b{font-weight:700}a{color:inherit;text-decoration:none}p,li{orphans:2;widows:2}
.cv-header{margin:0 0 8pt;page-break-inside:avoid;page-break-after:avoid}
.cv-name{font-size:27pt;font-weight:700;line-height:1.08;letter-spacing:0;color:#171717}
.cv-name.name-long{font-size:23pt}.cv-name.name-extra-long{font-size:20pt}
.cv-title{font-size:11.5pt;line-height:1.25;margin-top:3pt;color:#353535}
.cv-contact-lines{font-size:9.5pt;line-height:1.3;margin-top:3pt;color:#404040}
.cv-contact-line+.cv-contact-line{margin-top:1.5pt}.cv-contact-divider{padding:0 4pt;color:#777}
.cv-header-identity{width:100%}.cv-header.has-photo{text-align:left}
.cv-masthead{position:relative;min-height:80pt;padding-right:72pt}
.cv-photo{position:absolute;top:0;right:0;width:60pt;height:80pt;border:.4pt solid #d4d9d7;border-radius:2pt}
.photo-left .cv-masthead{padding:0 0 0 72pt}.photo-left .cv-photo{right:auto;left:0}
.cv-section,.cv-section-body{page-break-inside:auto}
.sec-hdr{font-size:11.5pt;font-weight:700;line-height:1.2;margin:10pt 0 3.5pt;padding:0 0 2pt;border-bottom:.5pt solid #555;page-break-inside:avoid;page-break-after:avoid;text-transform:uppercase;letter-spacing:0}
.sec-hdr span{font:inherit}.sec-hdr hr{display:none}.cv-header+.cv-section .sec-hdr{margin-top:0}
.cv-summary{margin:0;orphans:2;widows:2;page-break-inside:auto}
.cv-entry{margin:0 0 6pt;page-break-inside:auto}.cv-entry:last-child{margin-bottom:0}
.cv-entry-top{page-break-inside:avoid;page-break-after:avoid}.cv-entry-heading{line-height:1.25;page-break-after:avoid}
.cv-entry-left{display:inline-block;vertical-align:top;width:70%;font-size:11pt;font-weight:700;line-height:1.25}
.cv-entry-date{display:inline-block;vertical-align:top;width:30%;font-size:9.5pt;line-height:1.45;text-align:right;color:#454545}
.cv-entry-heading.no-date .cv-entry-left{width:100%;padding-right:0}
.cv-entry-meta{font-size:10pt;line-height:1.3;color:#444;margin-top:1pt;page-break-after:avoid}
.cv-entry-detail{font-size:10pt;line-height:1.35;margin-top:2pt;color:#444;page-break-after:avoid}
.cv-entry-body{page-break-inside:auto}.bullets{margin:2.5pt 0 0 12pt;padding:0;list-style-type:disc;page-break-inside:auto}
.bullets li{padding-left:2pt;margin:0 0 1.5pt;page-break-inside:auto;orphans:2;widows:2}.bullets li:last-child{margin-bottom:0}
.cv-skill-row{margin:0 0 1.5pt;page-break-inside:auto;orphans:2;widows:2}.cv-skill-row:last-child{margin-bottom:0}
.cv-extra-section{page-break-inside:auto}.cv-extra-item{margin:0 0 4pt;page-break-inside:auto;orphans:2;widows:2}.cv-extra-item:last-child{margin-bottom:0}
.cv-reference{margin-bottom:5pt;page-break-inside:avoid}.cv-ref-name{font-weight:700}.cv-ref-pos,.cv-ref-contact{font-size:10pt;color:#444}
@media screen{body{width:794px;min-height:1123px;margin:0 auto;padding:18mm}}
CSS;
        $design = match ($template['id']) {
            'classic' => '.cv-header{text-align:center;border-bottom:.7pt solid #333;padding-bottom:6pt}.cv-name{font-size:27pt;font-weight:400}.sec-hdr{font-size:12pt;border-bottom:.45pt solid #555}',
            'modern' => '.cv-header{border-bottom:1.6pt solid #333;padding-bottom:6pt}.cv-name{font-size:27pt}.sec-hdr{border:0;text-transform:none;font-size:12pt;padding:0}.cv-title{font-weight:400}',
            'minimal' => '.cv-name{font-size:28pt;font-weight:400}.cv-header{margin-bottom:9pt}.sec-hdr{border:0;font-size:11pt;padding:0}.cv-title{font-size:11pt}.cv-entry-meta{color:#555}',
            'heritage' => '.cv-header{text-align:center;padding-bottom:4pt}.cv-name{font-weight:400;font-size:25pt}.sec-hdr{text-align:center;text-transform:none;border-bottom:0;border-top:.5pt solid #555;padding-top:4pt}',
            'essential' => '.cv-header{border-bottom:.6pt solid #555;padding-bottom:6pt}.cv-name{font-size:26pt}.sec-hdr{text-transform:none;font-size:12pt}.cv-title{font-size:12pt}',
            'graduate' => '.cv-header{text-align:center;border-bottom:.7pt solid #444;padding-bottom:6pt}.cv-name{font-size:25pt}.sec-hdr{text-transform:none}.cv-title{font-weight:400}',
            'executive' => '.cv-name{font-size:26pt}.cv-header{border-bottom:1pt solid #333;padding-bottom:7pt}.sec-hdr{text-transform:none;font-size:12pt;border:0;padding:0}.cv-title{font-size:11pt}',
            'editorial' => '.cv-name{font-size:28pt;font-weight:400}.cv-header{border-top:1.1pt solid #333;border-bottom:.5pt solid #555;padding:6pt 0}.sec-hdr{font-weight:400;text-transform:none;font-size:13pt}.cv-title{font-size:12pt}',
            'precision' => '.cv-name{text-transform:uppercase;font-size:25pt}.cv-header{padding-bottom:5pt}.sec-hdr{border-bottom:0;border-top:.6pt solid #555;padding-top:5pt}.cv-entry-left{font-size:11.5pt}',
            'horizon' => '.cv-header{border-bottom:.6pt solid #555;padding-bottom:7pt}.cv-name{font-size:27pt;font-weight:400}.sec-hdr{border:0;text-transform:none;font-size:13pt;padding:0}.cv-title{font-size:12pt}',
            'signature' => '.cv-name{font-size:28pt;font-weight:400}.cv-header{border-bottom:2pt double #333;padding-bottom:6pt}.sec-hdr{border:0;font-size:12pt;padding:0}.cv-title{font-size:12pt}',
            'atlas' => '.cv-header{border-top:2pt solid #333;padding-top:10pt;padding-bottom:3pt}.cv-name{font-size:27pt}.sec-hdr{text-transform:none;border-bottom:0;border-left:2pt solid #444;padding:0 0 0 7pt;font-size:12pt}',
            'meridian' => '.cv-name{font-size:25pt;font-weight:400}.cv-header{padding-bottom:6pt;border-bottom:.5pt solid #555}.sec-hdr{text-transform:none;text-align:center;border:0;font-size:12pt;padding:0}.cv-title{font-size:10.5pt}',
            'keystone' => '.cv-name{font-size:27pt}.cv-header{margin-bottom:9pt}.cv-title{font-size:11pt}.cv-entry-left{font-size:12pt}.sec-hdr{text-transform:none;border-bottom:.75pt solid #555;font-size:12pt}',
            'counsel' => '.cv-header{text-align:center}.cv-name{font-size:25pt;font-weight:400}.sec-hdr{border-top:.45pt solid #555;border-bottom:.45pt solid #555;padding:3pt 0;font-size:11pt}.cv-title{font-size:11pt}',
            'impact' => '.cv-name{font-size:28pt}.cv-header{padding-bottom:4pt}.cv-title{font-weight:700;font-size:12pt}.sec-hdr{text-transform:none;border-bottom:1.2pt solid #555;font-size:12pt}',
            default => '',
        };
        return DocumentFonts::css($fontKey) . $base . $design;
    }

    public static function appearance(mixed $id, mixed $preferences, bool $resume = false): string
    {
        $s = Sanitizer::appearance($preferences);
        $template = TemplateCatalog::get($id);
        $size = (float)$s['size'];
        $fontKey = $s['font'] === 'template' ? $template['fontKey'] : $s['font'];
        $font = DocumentFonts::stack($fontKey);
        [$line, $section, $entry, $bullet] = match ($s['spacing']) {
            'compact' => [1.25, 8, 4.5, 1], 'comfortable' => [1.4, 12, 8, 2.5], default => [1.3, 10, 6, 1.5],
        };
        if ($resume) {
            [$line, $section, $entry, $bullet] = match ($s['spacing']) {
                'compact' => [1.22, 7, 3.5, .75],
                'comfortable' => [1.35, 10, 6, 1.75],
                default => [1.25, 8, 4.5, 1],
            };
        }
        if ($s['lineHeight'] !== 'template') $line = (float)$s['lineHeight'];
        $detail = max(9.5, $size - 1);
        $meta = max(10, $size - .5);
        $role = max($size, match ($template['id']) { 'keystone'=>12, 'precision'=>11.5, default=>11 });
        $margin = match ($s['margins']) { 'compact'=>12.7, 'generous'=>22, default=>$resume ? 16 : 18 };
        $color = $s['color'] === 'accent' ? $template['accent'] : '#333333';
        $css = "@page{margin:{$margin}mm}body{font-family:{$font};font-size:{$size}pt;line-height:{$line}}"
            .".cv-summary,.bullets,.cv-skill-row,.cv-extra-item{font-size:{$size}pt;line-height:{$line}}"
            .".cv-entry-left{font-size:{$role}pt}"
            .".sec-hdr{margin-top:{$section}pt;border-color:{$color};color:{$color}}.cv-contact-lines,.cv-entry-date,.cv-ref-pos,.cv-ref-contact{font-size:{$detail}pt}"
            .".cv-entry-meta,.cv-entry-detail{font-size:{$meta}pt}.cv-entry{margin-bottom:{$entry}pt}.cv-entry:last-child{margin-bottom:0}.bullets li{margin-bottom:{$bullet}pt}.bullets li:last-child{margin-bottom:0}.cv-header{border-color:{$color}}";
        if ($resume) {
            $name = match ($template['id']) { 'editorial','signature','minimal'=>27, 'precision','graduate','meridian'=>24, default=>25 };
            // Leave space for rounding in the PDF renderer so dates stay on the title line.
            $css .= ".cv-header{margin-bottom:7pt}.cv-name{font-size:{$name}pt}.cv-title{margin-top:2pt}"
                .".cv-contact-lines{margin-top:2pt}.cv-entry-meta{margin-top:.5pt}.cv-entry-left{width:69%}"
                .".bullets{margin-top:1.5pt}.cv-project-type{font-size:{$meta}pt;font-weight:400;color:#454545}.cv-skill-row{margin-bottom:1pt}";
        }
        if ($s['headingSize'] !== 'template') $css .= '.sec-hdr{font-size:'.$s['headingSize'].'pt}';
        if ($s['nameSize'] !== 'template') $css .= '.cv-name,.cv-name.name-long,.cv-name.name-extra-long{font-size:'.$s['nameSize'].'pt}';
        if ($s['headingStyle'] !== 'template') $css .= '.sec-hdr{text-transform:'.($s['headingStyle']==='title'?'none':'uppercase').'}';
        if ($s['dates'] === 'inline') $css .= '.cv-entry-left{width:100%;padding-right:0}.cv-entry-date{display:block;width:100%;text-align:left;margin-top:2pt}';
        if ($s['photoShape'] === 'square') $css .= '.cv-masthead{min-height:60pt}.cv-photo{height:60pt}';
        return $css . "@media screen{body{padding:{$margin}mm}}";
    }
}
