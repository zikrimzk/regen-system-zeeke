<?php
declare(strict_types=1);

namespace ReGen;

use Dompdf\Dompdf;
use Dompdf\Options;

final class PdfService
{
    /** @param array<string, mixed> $resume */
    public function generate(array $resume): string
    {
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isJavascriptEnabled', false);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'Helvetica');
        $options->set('defaultMediaType', 'print');
        $options->set('dpi', 96);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(ResumeTemplate::buildHtml($resume), 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return $dompdf->output();
    }
}
