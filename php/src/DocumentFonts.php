<?php
declare(strict_types=1);
namespace ReGen;

/** The same licensed faces and metrics are used in the browser and PDF. */
final class DocumentFonts
{
    public static function all(): array
    {
        return [
            'sans' => ['label'=>'Inter', 'family'=>'Resume Sans', 'regular'=>'Inter-Regular', 'bold'=>'Inter-SemiBold', 'fallback'=>'sans-serif'],
            'source' => ['label'=>'Source Sans 3', 'family'=>'Resume Source', 'regular'=>'SourceSans3-Regular', 'bold'=>'SourceSans3-Bold', 'fallback'=>'sans-serif'],
            'lato' => ['label'=>'Lato', 'family'=>'Resume Lato', 'regular'=>'Lato-Regular', 'bold'=>'Lato-Bold', 'fallback'=>'sans-serif'],
            'garamond' => ['label'=>'EB Garamond', 'family'=>'Resume Garamond', 'regular'=>'EBGaramond-Regular', 'bold'=>'EBGaramond-Bold', 'fallback'=>'serif'],
            'baskerville' => ['label'=>'Libre Baskerville', 'family'=>'Resume Baskerville', 'regular'=>'LibreBaskerville-Regular', 'bold'=>'LibreBaskerville-Bold', 'fallback'=>'serif'],
            'serif' => ['label'=>'DejaVu Serif', 'family'=>'Resume Serif', 'regular'=>'DejaVuSerif', 'bold'=>'DejaVuSerif-Bold', 'fallback'=>'serif'],
        ];
    }

    public static function css(string $key): string
    {
        $face = self::all()[$key] ?? self::all()['sans'];
        return '@font-face{font-family:"'.$face['family'].'";src:url("/fonts/'.$face['regular'].'.ttf") format("truetype");font-weight:400}'
            .'@font-face{font-family:"'.$face['family'].'";src:url("/fonts/'.$face['bold'].'.ttf") format("truetype");font-weight:700}';
    }

    public static function stack(string $key): string
    {
        $face = self::all()[$key] ?? self::all()['sans'];
        return '"'.$face['family'].'",'.$face['fallback'];
    }
}
