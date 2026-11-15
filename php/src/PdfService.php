<?php
declare(strict_types=1);

namespace ReGen;

use Dompdf\Dompdf;
use Dompdf\Options;

final class PdfService
{
    /** @param array<string, mixed> $resume */
    public function generate(array $resume,bool $preview=false): string
    {
        return $this->generateHtml(ResumeTemplate::buildHtml($resume),$preview);
    }

    public function generateHtml(string $html,bool $preview=false): string
    {
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isJavascriptEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'Times-Roman');
        $options->set('defaultMediaType', 'print');
        $options->set('dpi', 96);
        // RESOLVE ONLY THE BUNDLED DOCUMENT FONT FILES; REMOTE RESOURCES STAY DISABLED.
        $root = dirname(__DIR__, 2);
        $fontRoot = is_dir($root . '/public/fonts') ? $root . '/public/fonts' : $root . '/fonts';
        $options->setChroot([$fontRoot, $options->getRootDir()]);
        $cache = Storage::directory('cache/fonts-' . substr(hash('sha256', $fontRoot), 0, 12));
        $options->setTempDir(Storage::directory('cache/pdf'));
        $options->setFontDir($cache);
        $options->setFontCache($cache);
        $options->set('isFontSubsettingEnabled', true);
        // NORMALIZE FONT METRICS SO 1.35 LEADING MEANS THE SAME PHYSICAL SPACE IN EACH FAMILY.
        preg_match_all('/body\{font-family:"([^"]+)"/', $html, $families);
        $family = end($families[1]);
        $ratios = ['Resume Sans'=>2048/2478, 'Resume Source'=>1000/1424, 'Resume Lato'=>2000/2400,
            'Resume Garamond'=>1000/1305, 'Resume Baskerville'=>1000/1240, 'Resume Serif'=>2048/2384];
        $options->setFontHeightRatio($ratios[$family] ?? 1.0);
        $faces = array_merge(array_column(DocumentFonts::all(), 'regular'), array_column(DocumentFonts::all(), 'bold'));
        foreach (array_unique($faces) as $face) {
            $font = $face . '.ttf';
            $file = realpath($fontRoot . '/' . $font);
            if ($file !== false) $html = str_replace('/fonts/' . $font, 'file://' . str_replace('\\', '/', $file), $html);
        }
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        if($preview)$dompdf->getCanvas()->page_script(static function($page,$pages,$canvas,$metrics):void{
            $font=$metrics->getFont('helvetica','bold');$canvas->set_opacity(.13);
            $canvas->text(120,$canvas->get_height()*.61,'PREVIEW',$font,72,[.15,.25,.2],0,0,-35);
            $canvas->set_opacity(1);$canvas->text(40,$canvas->get_height()-20,'PREVIEW - Use Download for a clean copy',$metrics->getFont('helvetica'),8,[.35,.4,.37]);
        });
        return $dompdf->output();
    }
}
