<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/vendor/autoload.php';
$root=dirname(__DIR__);
if(($argv[1]??'')==='--render'){
    $file=$argv[2]??'';$base=$argv[3]??$root;
    if(!in_array($file,['admin.html','dashboard.html','mochi.html','maintenance.html','upcoming.html','builder.html','cover-letters.html','store.html','token-activity.html','payments.html'],true))exit(2);
    $_SERVER['REQUEST_URI'] = $argv[4] ?? '/';
    parse_str((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY), $_GET);
    ReGen\PageRenderer::render($base,$file);
}
$checks=0;
$check=static function(bool $ok,string $message)use(&$checks):void{$checks++;if(!$ok)throw new RuntimeException($message);};
$render=static function(string $file,string $base,string $path='/')use($check):string{
    $process=proc_open([PHP_BINARY,__FILE__,'--render',$file,$base,$path],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $html=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    $check(proc_close($process)===0&&$error==='','Page render failed.');return $html;
};
$html=$render('admin.html',$root);
foreach(['admin.js','admin-control-centre.js','admin-templates.js','admin-insights.js'] as $script){$version=substr(hash_file('sha256',$root.'/public/js/'.$script),0,12);$check(str_contains($html,'/js/'.$script.'?v='.$version),'Admin script must use its current content hash: '.$script);}
$fixture=$root.'/tmp/asset-version-check-'.bin2hex(random_bytes(6));
try{
    mkdir($fixture.'/php/views',0700,true);mkdir($fixture.'/public/js',0700,true);
    file_put_contents($fixture.'/php/views/admin.html','<!doctype html><html><head><script src="/js/admin.js?v=fixed-old-version"></script></head><body></body></html>');
    file_put_contents($fixture.'/public/js/admin.js','const version=1;');$first=$render('admin.html',$fixture);
    file_put_contents($fixture.'/public/js/admin.js','const version=2;');$second=$render('admin.html',$fixture);
    $check($first!==$second,'Changing a script must invalidate the URL even when the old template version is unchanged.');
    $check(!str_contains($second,'fixed-old-version'),'Fixed historical script versions must not reach the browser.');
}finally{
    foreach(['/php/views/admin.html','/public/js/admin.js'] as $file)if(is_file($fixture.$file))unlink($fixture.$file);
    foreach(['/php/views','/php','/public/js','/public',''] as $folder)if(is_dir($fixture.$folder))rmdir($fixture.$folder);
}
$check(str_contains($html, 'id="regen-admin-navigation"') && str_contains($html, 'data-view="support" hidden'), 'Administrator navigation is initially hidden pending scoped permissions.');
$overview=$render('dashboard.html',$root,'/dashboard?lang=ms');
$check(str_contains($overview, '<html lang="ms">') && str_contains($overview, 'data-workspace-view="overview"'), 'Overview uses the selected language.');
$check(ReGen\Routes::returnTarget('/resumes?lang=ms') === '/dashboard?lang=ms', 'Legacy resume library opens Overview with the query intact.');
$upcoming=$render('upcoming.html',$root,'/jobs/saved?lang=ms');
$check(str_contains($upcoming, '<h1>Kerja disimpan</h1>') && str_contains($upcoming, 'Akan datang'), 'Future routes show the appropriate localised upcoming state.');
$html=$render('dashboard.html',$root);$dom=new DOMDocument();libxml_use_internal_errors(true);$dom->loadHTML($html);libxml_clear_errors();$xpath=new DOMXPath($dom);
$check($xpath->query('//*[@id="workspace-sidebar-nav"]/section[1]/a')->length===4,'The candidate sidebar includes Overview, both studios and Mochi.');
$check($xpath->query('//*[@id="workspace-sidebar-nav"]//a[@href="/builder"]')->length===1,'Resume Studio opens the editor directly.');
$check($xpath->query('//*[@id="account-menu-panel"]/a[@href="/support"]')->length===1,'Support belongs in the account dropdown.');
$check($xpath->query('//*[@id="account-menu-panel"]/*[@href="/notifications"]')->length===0,'Notification destination is not duplicated in the account dropdown.');
$check($xpath->query('//a[contains(@class,"workspace-notification-bell")][@href="/notifications"]')->length===1,'Notifications have one shared header bell.');
$check($xpath->query('//a[contains(@class,"workspace-notification-bell")]//span[@data-notification-count]')->length===1,'Header bell provides an unread-count element.');
$check(!str_contains($html,'class="mochi-launch"') && !str_contains($html,'data-mochi-den-stage'),'Workspace uses the floating pet without a duplicate header launcher or room stage.');
$room=$render('mochi.html',$root);
$check(str_contains($room,'has-mobile-nav')&&str_contains($room,'/css/workspace-shell.css?v=')&&str_contains($room,'class="mobile-product-nav"'),'Room has the shared mobile navigation and matching styles without JavaScript.');
$studio=$render('builder.html',$root,'/builder?id=5&section=skills&lang=ms');
$check(substr_count($studio, 'id="preview-open-top"')===1 && str_contains($studio,'id="studio-pdf-pages"'), 'The editor has one draft preview command plus a saved-preview pane.');
$check(str_contains($studio,'/css/studio.css?v=') && str_contains($studio,'/js/studio.js?v='), 'Resume Studio assets load through the existing versioned renderer.');
$check(str_contains($studio,'Pratonton draf') && str_contains($studio,'class="studio-icon studio-exit" href="/dashboard"'), 'The localized editor has a dedicated exit.');
$check(!str_contains($studio,'class="workspace-sidebar"') && !str_contains($studio,'class="mobile-product-nav"'), 'Resume Studio renders without workspace navigation.');
$check($xpath->query('//*[@id="workspace-sidebar-nav"]//a[@href="/store"]')->length===1, 'K-Store is a workspace destination.');
$check($xpath->query('//a[@href="/settings" or @href="/token-activity" or @href="/payments" or @href="/store/activity" or @href="/store/payments"]')->length===0, 'Workspace navigation excludes the duplicate settings and store history pages.');
$store=$render('store.html',$root,'/store?lang=ms');
$check(str_contains($store,'<h1>K-Store</h1>') && str_contains($store,'href="/store/activity"') && str_contains($store,'href="/store/payments"'), 'K-Store links to both history pages.');
$check(ReGen\Routes::returnTarget('/settings?lang=ms') === '/profile?lang=ms'
    && ReGen\Routes::returnTarget('/payments?order=example') === '/store/payments?order=example'
    && ReGen\Routes::returnTarget('/token-activity') === '/store/activity', 'Old candidate links retain the query and resolve to their canonical destinations.');
$letter = $render('cover-letters.html', $root, '/cover-letters?lang=ms');
$check(str_contains($letter,'Pratonton draf') && str_contains($letter,'id="letter-form"'), 'The cover-letter workspace renders the working preview and its form in Malay.');
$check(!str_contains($letter,'class="workspace-sidebar"') && !str_contains($letter,'class="mobile-product-nav"'), 'Cover Letter Studio renders without workspace navigation.');
$html=$render('maintenance.html',$root);
$check(str_contains($html,'/js/maintenance.js?v=')&&str_contains($html,'/js/realtime.js?v='),'Maintenance must retain live status and automatic restoration scripts.');
$check(!str_contains($html,'/js/service-centre.js')&&!str_contains($html,'/js/feedback.js'),'Maintenance must not load protected workspace notification code that can redirect back to itself.');
echo "Runtime asset invalidation and shared navigation checks passed ($checks assertions; local fixtures).\n";
