<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root=dirname(__DIR__);$zip=new ZipArchive();
if ($zip->open($root.'/release/regen-php.zip')!==true) throw new RuntimeException('Build the release first.');
$samples=0;$images=0;
for($index=0;$index<$zip->numFiles;$index++){
    $name=$zip->getNameIndex($index);
    if(preg_match('#(^/|^[a-z]:|(?:^|/)\.\.(?:/|$))#i',$name))throw new RuntimeException('Unsafe archive path.');
    if(preg_match('#(?:^|/)(?:\.env(?:$|\.(?!example$))|tmp/|output/|__template-review|resume-fixtures)#',$name))throw new RuntimeException('Private or QA data in release: '.$name);
    if(preg_match('#^samples/[a-z-]+\.pdf$#',$name))$samples++;
    if(preg_match('#^img/templates/[a-z-]+-(?:320|640|1280)\.webp$#',$name))$images++;
}
if($samples!==16||$images!==48)throw new RuntimeException('Incomplete released template assets.');
foreach(['js/assist-me.js','_app/src/ResumeAssistance.php','_app/database/migrations/011_assistance_and_admin_access.sql','_app/ASSIST_ME_UPDATE.md','_app/src/DocumentFonts.php','_app/TEMPLATE_DESIGN_STANDARD.md','fonts/lato-OFL.txt','fonts/sourcesans3-OFL.txt','fonts/ebgaramond-OFL.txt','fonts/librebaskerville-OFL.txt','_app/src/DocumentStyle.php','_app/src/ResumeWriting.php','_app/src/ResumePrompts.php','_app/src/ResumeReview.php','_app/RESUME_ENGINE_UPDATE.md','_app/WRITING_STANDARDS.md','_app/AI_WRITING_PROMPTS.md','_app/LANDING_MOBILE_UPDATE.md','js/mobile-viewport.js','js/sections/additional.js','fonts/Inter-Latin.woff2','fonts/Inter-OFL.txt','samples/catalog.json'] as $file)if($zip->locateName($file)===false)throw new RuntimeException('Missing released file: '.$file);
foreach(['assist-me.js','ai-enhance.js','admin.js','api.js','cover-letters.js','public-product.js','dashboard.js','store.js','mobile-viewport.js','ui.js','form-assist.js','stepper.js','app.js','templates.js','pdf-pages.js','document-settings.js','sections/personal.js'] as $script)if(hash('sha256',$zip->getFromName('js/'.$script))!==hash_file('sha256',$root.'/public/js/'.$script))throw new RuntimeException('Released script is stale: '.$script);
$destination=$root.'/tmp/release-template-check-'.bin2hex(random_bytes(4));
if(!mkdir($destination,0700,true)||!$zip->extractTo($destination))throw new RuntimeException('Unable to extract a local test release.');
@mkdir($destination . '/storage', 0777, true);
@mkdir($destination . '/_app/storage', 0777, true);
$zip->close();
foreach(['css/auth-journey.css','css/cover-letters.css','css/site.css','css/main.css','css/appearance.css','_app/src/MailDeliveryRejected.php','_app/src/MailRetryPolicy.php','_app/src/SmtpMailer.php','_app/src/NotificationService.php','_app/src/AdminAlertService.php','_app/src/CampaignService.php'] as $file){
    $source=str_starts_with($file,'_app/')?$root.'/php/'.substr($file,5):$root.'/public/'.$file;
    if(!is_file($destination.'/'.$file)||hash_file('sha256',$destination.'/'.$file)!==hash_file('sha256',$source))throw new RuntimeException('Launch follow-up file is missing or stale: '.$file);
}
if(!is_file($destination.'/_app/UAT_STATUS_2026-11-06.md')||hash_file('sha256',$destination.'/_app/UAT_STATUS_2026-11-06.md')!==hash_file('sha256',$root.'/docs/UAT_STATUS_2026-11-06.md'))throw new RuntimeException('Missing current UAT status guide.');
foreach(['_app/src/RealtimeEvents.php','_app/src/RealtimeConnection.php','_app/src/MaintenanceService.php','_app/src/Actions/LiveActions.php','_app/src/AdminAccess.php','_app/src/TemplateManagement.php','_app/database/migrations/017_realtime_and_maintenance.sql','js/realtime.js','js/maintenance.js','js/admin-maintenance.js','css/maintenance.css','css/pdf-pages.css'] as $file){
    $source=str_starts_with($file,'_app/database/')?$root.'/database/'.substr($file,14):(str_starts_with($file,'_app/')?$root.'/php/'.substr($file,5):$root.'/public/'.$file);
    if(!is_file($destination.'/'.$file)||hash_file('sha256',$destination.'/'.$file)!==hash_file('sha256',$source))throw new RuntimeException('Live operations release file is stale: '.$file);
}
if(!is_file($destination.'/_app/LIVE_OPERATIONS.md'))throw new RuntimeException('Missing live operations guide.');
foreach(['_app/src/ManagedRealtime.php','_app/src/RealtimeEndpoint.php','_app/src/PageRenderer.php','_app/src/Actions/LiveActions.php','_app/database/migrations/018_managed_realtime_delivery.sql','lib/pusher/pusher-8.6.0.min.js','lib/pusher/LICENSE'] as$file){
    $source=str_starts_with($file,'_app/database/')?$root.'/database/'.substr($file,14):(str_starts_with($file,'_app/')?$root.'/php/'.substr($file,5):$root.'/public/'.$file);
    if(!is_file($destination.'/'.$file)||hash_file('sha256',$destination.'/'.$file)!==hash_file('sha256',$source))throw new RuntimeException('Managed update release file is stale: '.$file);
}
if(!is_file($destination.'/_app/MANAGED_REALTIME_DIRECTADMIN.md'))throw new RuntimeException('Missing managed delivery setup guide.');
foreach(['_app/src/TokenStore.php','_app/src/FeaturePricing.php','_app/src/SupportAttachments.php','_app/src/Actions/CommerceActions.php','_app/database/migrations/019_support_and_token_store.sql','js/store.js','js/feature-access.js','js/support-attachments.js','js/live-notifications.js','js/admin-store.js','css/token-store.css','css/support-attachments.css','css/admin-commerce.css','css/k-store.css','css/workspace-overview.css','css/editor-workbench.css','css/workspace-material.css','js/live-document-preview.js'] as $file){
    $source=str_starts_with($file,'_app/database/')?$root.'/database/'.substr($file,14):(str_starts_with($file,'_app/')?$root.'/php/'.substr($file,5):$root.'/public/'.$file);
    if(!is_file($destination.'/'.$file)||hash_file('sha256',$destination.'/'.$file)!==hash_file('sha256',$source))throw new RuntimeException('Store and support release file is stale: '.$file);
}
foreach(['TOKEN_STORE_PHASE_ONE.md','UAT_STATUS_2026-11-07.md'] as $guide){
    if(!is_file($destination.'/_app/'.$guide)||hash_file('sha256',$destination.'/_app/'.$guide)!==hash_file('sha256',$root.'/docs/'.$guide))throw new RuntimeException('Missing current release guide: '.$guide);
}
$loader=require $destination.'/_app/vendor/autoload.php';
$loader->addPsr4('ReGen\\',$destination.'/_app/src',true);
$loader->addClassMap(require $destination.'/_app/autoload-map.php');
if(!class_exists(\Pusher\Pusher::class))throw new RuntimeException('The managed delivery SDK cannot load from the release.');
$map=require $destination.'/_app/autoload-map.php';
foreach($map as $class=>$file)if(!class_exists($class)&&!trait_exists($class))throw new RuntimeException('Released class cannot load: '.$class);
foreach(['_app/src/CampaignService.php','_app/src/Actions/AdminWorkspaceActions.php','_app/database/migrations/016_campaigns_and_uat_controls.sql','_app/ADMIN_UAT_NOVEMBER.md','js/admin-campaigns.js','js/admin-charts.js','js/campaigns.js','css/campaigns.css','_app/src/WorkspaceShell.php','_app/src/DeviceContext.php','_app/src/TemplateManagement.php','_app/ADMIN_REFINEMENT.md','_app/database/migrations/013_feedback_and_admin_refinement.sql','_app/database/migrations/014_template_management.sql','_app/database/migrations/015_feedback_limits_and_support_context.sql','js/admin-templates.js','js/admin-insights.js','js/feedback.js','js/service-centre.js','css/workspace-shell.css','css/feedback.css','css/admin-control-centre.css'] as $file)if(!file_exists($destination.'/'.$file))throw new RuntimeException('Missing refined release file: '.$file);
foreach(['js/theme.js','js/campaigns.js','js/admin-campaigns.js','js/admin-charts.js','css/campaigns.css','js/admin-templates.js','js/admin-insights.js','js/admin-control-centre.js','js/feedback.js','js/service-centre.js','css/workspace-shell.css','css/feedback.css','css/admin-control-centre.css'] as $file)if(hash_file('sha256',$destination.'/'.$file)!==hash_file('sha256',$root.'/public/'.$file))throw new RuntimeException('Refinement release asset is stale: '.$file);
// NEW RELEASE PATH ALSO PROVIDES AN EMPTY FONT CACHE, AS ON A FRESH HOST.
$pdf=new ReGen\PdfService();
foreach(['modern','classic','essential','minimal','executive','heritage'] as $id){
    $file=$destination.'/release-'.$id.'.pdf';
    $bytes=$pdf->generate(ReGen\TemplateCatalog::sample($id));
    if(!str_starts_with($bytes,'%PDF-')||strlen($bytes)<5000)throw new RuntimeException('Invalid release export: '.$id);
    file_put_contents($file,$bytes);
}
echo "Release has 16 PDF samples and 48 thumbnails; fresh-cache exports passed for all six bundled font families.\n";
echo "Local test extraction: ".str_replace('\\','/',$destination)."\n";
