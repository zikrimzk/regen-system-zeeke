<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli-server' || !isset($root,$fixtureDatabase,$base)
    || !preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$fixtureDatabase)) {http_response_code(404);exit;}
$path=(string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (preg_match('#^/(?:css|js|img|fonts|lib|samples)/#',$path) && is_file($root . '/public' . $path)) return false;
if (in_array($path,['/favicon.svg','/favicon.ico','/manifest.webmanifest','/sw.js'],true)) return false;
require $root . '/vendor/autoload.php';
ReGen\Config::load(getenv('REGEN_HTTP_FIXTURE_CONFIG') ?: $root);
$property=new ReflectionProperty(ReGen\Config::class,'values');
$mail = isset($mailSinkPort) && is_int($mailSinkPort) && $mailSinkPort > 1024 && $mailSinkPort <= 65535 ? [
    'mail.transport'=>'smtp','mail.smtp_host'=>'127.0.0.1','mail.smtp_port'=>$mailSinkPort,'mail.smtp_encryption'=>'none',
    'mail.smtp_username'=>'fixture','mail.smtp_password'=>'local-test-only','mail.from_email'=>'mail@qa.regen.local','mail.reply_to'=>'',
] : ['mail.transport'=>'disabled','mail.smtp_host'=>''];
$property->setValue(null,array_replace($property->getValue(),[
    'db.name'=>$fixtureDatabase,'app.env'=>'testing','app.url'=>$base,'session.name'=>'regen_store_http','session.driver'=>'database',
    'openai.api_key'=>'','google.client_id'=>'',
    'recaptcha.site_key'=>'','recaptcha.secret_key'=>'','realtime.transport'=>'poll',
    'hitpay.mode'=>'disabled','hitpay.api_key'=>'','hitpay.sandbox_salt'=>$hitpayWebhookSalt??'','hitpay.live_salt'=>'',
    'mochi.enabled'=>$mockMochi ?? false,
],$mail));
set_exception_handler(static function(Throwable $error):void {ReGen\Http::json(['success'=>false,'message'=>$error->getMessage()],500);});
ReGen\Http::applySecurityHeaders();
ReGen\PublicSite::dispatch($root);
if (ReGen\Http::contentLength()>33554432) ReGen\Http::json(['success'=>false,'message'=>'Upload too large.'],413);
$db=ReGen\Database::connection();
ReGen\Session::start($db);
ReGen\RealtimeEndpoint::dispatch($db,$root);
$coach = null;
if ($mockMochi ?? false) {
    $transport = static function (array $payload): array {
        $input = json_decode($payload['input'] ?? '', true);
        if (($payload['model'] ?? '') !== 'gpt-6-luna' || ($payload['store'] ?? null) !== false) {
            return ['status'=>400];
        }
        if (($input['conversation_mode'] ?? false) === true) {
            if (($input['workspace_page'] ?? '') !== 'cover-letters'
                || isset($input['shared_writing']) || isset($input['saved_professional_details'])) return ['status'=>422];
            $reply = ['reply'=>'Practise one example aloud — then take a break.', 'mood'=>'bright','scope'=>'play','kind'=>'advice',
                'suggestion'=>'','paragraphs'=>[],'evidence'=>[]];
        } elseif (isset($input['current_message'])) {
            if ($input['current_message'] === 'Polish my resume: check rate limit') return ['status'=>429];
            if (str_contains($input['current_message'],'Use my saved resume.')
                && (!isset($input['saved_professional_details']) || str_contains(json_encode($input['saved_professional_details']),'@qa.regen.local'))) return ['status'=>422];
            if (($input['workspace_page'] ?? '') !== 'builder' || ($input['resume_section'] ?? '') !== 'projects'
                || ($input['coaching_preferences']['nickname'] ?? '') !== 'Ari'
                || ($input['coaching_preferences']['goal'] ?? '') !== 'Design internship'
                || isset($input['shared_writing'])) return ['status'=>422];
            $reply = $input['current_message']==='Can you help me with this part?'
                ? ['reply'=>'Which part of the project did you personally build?', 'mood'=>'curious','scope'=>'resume','kind'=>'question']
                : ['reply'=>'That sounds tough, Ari. Pick one contribution that fits the next role.', 'mood'=>'sad','scope'=>'resume','kind'=>'advice'];
            $reply += ['suggestion'=>'','paragraphs'=>[],'evidence'=>[]];
        } else {
            $excerpt = $input['excerpt'] ?? '';
            if (($input['field'] ?? '') !== 'Project contribution bullets' || str_contains($excerpt, 'person@example.com')
                || !str_contains($excerpt, '[private]')) return ['status'=>422];
            $reply = ['comment'=>'What changed after the team started using it?', 'mood'=>'curious'];
        }
        return ['status'=>200, 'body'=>json_encode([
            'status'=>'completed', 'output'=>[['type'=>'message', 'content'=>[['type'=>'output_text', 'text'=>json_encode($reply)]]]],
        ])];
    };
    $coach = new ReGen\MochiCoach(new ReGen\OpenAIService('fixture-key', ReGen\MochiCoach::DEFAULT_MODEL, $transport));
}
(new ReGen\Application($db,$root,$coach))->run();
