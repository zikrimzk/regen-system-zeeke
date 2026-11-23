<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
$parts = [];
foreach (['tokens','main','landing','site-controls','privacy','public-interface','commercial','commercial-pricing','public-footer'] as $name) {
    $parts[]=file_get_contents($root . '/public/css/' . $name . '.css');
}
// Whitespace is compacted only outside strings; calc() operator spacing is preserved.
$css = implode("\n", $parts);
$structural=preg_replace('~(["\'])(?:\\\\.|(?!\1)[^\\\\])*\1|/\*[\s\S]*?\*/~','',$css);
$depth=0;foreach(str_split($structural) as $character){if($character==='{')$depth++;elseif($character==='}'&&--$depth<0)throw new RuntimeException('Public stylesheet has an unmatched closing brace.');}
if($depth!==0)throw new RuntimeException('Public stylesheet has an unmatched opening brace.');
// A missing custom property can silently make a menu background transparent.
preg_match_all('/(--[a-z0-9-]+)\s*:/i', $css, $definitions);
preg_match_all('/var\(\s*(--[a-z0-9-]+)\s*\)/i', $css, $references);
$missing = array_diff(array_unique($references[1]), array_unique($definitions[1]));
if ($missing !== []) throw new RuntimeException('Public CSS has unresolved custom properties: ' . implode(', ', $missing));
$css = preg_replace_callback('~(["\'])(?:\\\\.|(?!\1)[^\\\\])*\1|/\*[\s\S]*?\*/|\s*([{}])\s*|\s+~',
    static fn(array $m): string => str_starts_with($m[0], '/*') ? '' : ($m[2] ?? (ctype_space($m[0][0]) ? ' ' : $m[0])), $css);
$css = trim((string) $css) . "\n";
file_put_contents($root . '/public/css/site.css', $css);
echo 'Public stylesheet: ' . strlen($css) . " bytes, one blocking request.\n";
