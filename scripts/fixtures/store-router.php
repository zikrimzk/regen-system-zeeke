<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli-server' || !isset($root,$fixtureDatabase,$base)
    || !preg_match('/^regen_store_http_[a-f0-9]{12}$/D',$fixtureDatabase)) {http_response_code(404);exit;}
$path=(string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (preg_match('#^/(?:css|js|img|fonts|lib|samples)/#',$path) && is_file($root . '/public' . $path)) return false;
if (in_array($path,['/favicon.svg','/favicon.ico','/manifest.webmanifest','/sw.js'],true)) return false;
require $root . '/vendor/autoload.php';
ReGen\Config::load($root);
$property=new ReflectionProperty(ReGen\Config::class,'values');
$property->setValue(null,array_replace($property->getValue(),[
    'db.name'=>$fixtureDatabase,'app.env'=>'testing','app.url'=>$base,'session.name'=>'regen_store_http','session.driver'=>'database',
    'mail.transport'=>'disabled','mail.smtp_host'=>'','openai.api_key'=>'','google.client_id'=>'',
    'recaptcha.site_key'=>'','recaptcha.secret_key'=>'','realtime.transport'=>'poll',
    'hitpay.mode'=>'disabled','hitpay.api_key'=>'','hitpay.sandbox_salt'=>$hitpayWebhookSalt??'','hitpay.live_salt'=>'',
    'mochi.enabled'=>$mockMochi ?? false,
]));
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
        if (isset($input['current_message'])) {
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
