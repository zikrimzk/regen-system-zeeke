<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {http_response_code(404);exit;}
$root = dirname(__DIR__);
$output = $root . '/public/img/launch';
if (!is_dir($output)) mkdir($output,0755,true);
$logos = ['light'=>imagecreatefrompng($root . '/public/img/brand-wordmark.png'),'dark'=>imagecreatefrompng($root . '/public/img/brand-wordmark.png')];
if ($logos['light'] === false || $logos['dark'] === false) throw new RuntimeException('Original artwork missing.');
imagefilter($logos['dark'],IMG_FILTER_COLORIZE,255,255,255);
$devices = [[375,667,2],[375,812,3],[390,844,3],[393,852,3],[402,874,3],[414,896,2],[414,896,3],[428,926,3],[430,932,3],[440,956,3],[768,1024,2],[820,1180,2]];
$links = [];
foreach ($logos as $theme => $logo) {
    foreach ($devices as [$width,$height,$scale]) {
        foreach (['portrait','landscape'] as $orientation) {
            [$canvasWidth,$canvasHeight] = $orientation === 'portrait' ? [$width*$scale,$height*$scale] : [$height*$scale,$width*$scale];
            $canvas = imagecreatetruecolor($canvasWidth,$canvasHeight);
            imagefill($canvas,0,0,$theme === 'dark' ? imagecolorallocate($canvas,8,9,11) : imagecolorallocate($canvas,245,245,247));
            $logoWidth = 158*$scale; $logoHeight = (int)round($logoWidth*imagesy($logo)/imagesx($logo));
            imagecopyresampled($canvas,$logo,(int)(($canvasWidth-$logoWidth)/2),(int)(($canvasHeight-$logoHeight)/2),0,0,$logoWidth,$logoHeight,imagesx($logo),imagesy($logo));
            $name = 'launch-'.$width.'-'.$height.'-'.$scale.'-'.$orientation.($theme === 'light' ? '-light' : '').'.png';
            imagepng($canvas,$output.'/'.$name,9); imagedestroy($canvas);
            $media = 'screen and (device-width: '.$width.'px) and (device-height: '.$height.'px) and (-webkit-device-pixel-ratio: '.$scale.') and (orientation: '.$orientation.') and (prefers-color-scheme: '.$theme.')';
            $links[] = '  <link rel="apple-touch-startup-image" href="/img/launch/'.$name.'" media="'.$media.'">';
        }
    }
    imagedestroy($logo);
}
foreach (glob($root.'/php/views/*.html') ?: [] as $view) {
    $html = (string)file_get_contents($view);
    $html = preg_replace('~\s*<link rel="apple-touch-startup-image"[^>]+>~','',$html);
    $html = str_replace('</head>',implode("\n",$links)."\n</head>",$html);
    file_put_contents($view,$html);
}
echo count($links)." theme-aware startup images rendered from the original artwork.\n";
