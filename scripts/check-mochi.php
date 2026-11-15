<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__).'/vendor/autoload.php';

use ReGen\{FeaturePricing, MochiCoach, MochiPolicy, MochiProfile, OpenAIService, OpenAIServiceException, PackageAccess};

$count = 0;
$check = static function (bool $condition, string $message) use (&$count): void {
    if (!$condition) throw new RuntimeException($message);
    $count++;
};
$draft = ['live'=>true,'field'=>'project','text'=>'Built an inventory dashboard. Contact me at person@example.com or +60 12 345 6789. See https://example.com/private.'];
$input = MochiCoach::input($draft);
$check($input !== null && substr_count($input['text'], '[private]') === 3, 'Redact contact details and links before the model sees the writing.');
$check(MochiCoach::input(array_replace($draft,['live'=>false])) === null, 'Require explicit live feedback in each request.');
foreach (['personal','email','password','address','reference','payment'] as $field) {
    $check(MochiCoach::input(array_replace($draft,['field'=>$field])) === null, 'Reject unsupported or sensitive fields.');
}
$check(MochiCoach::input(array_replace($draft,['text'=>str_repeat('字', 901)])) === null, 'Bound Unicode input before building a model request.');
$check(MochiCoach::input(array_replace($draft,['text'=>'Too short'])) === null, 'Do not call the model for fragmentary notes.');

$fixture = static function (array $reply): array {
    if (isset($reply['reply'])) $reply += ['kind'=>'advice','suggestion'=>'','paragraphs'=>[],'evidence'=>[]];
    return ['status'=>200, 'body'=>json_encode([
    'status'=>'completed', 'output'=>[['type'=>'message', 'content'=>[['type'=>'output_text', 'text'=>json_encode($reply, JSON_THROW_ON_ERROR)]]]],
    ], JSON_THROW_ON_ERROR)];
};
$coach = static fn(callable $transport): MochiCoach => new MochiCoach(new OpenAIService('fixture-key', MochiCoach::DEFAULT_MODEL, $transport));
$result = $coach(static function (array $payload) use ($check, $fixture): array {
    $userMessage = json_decode($payload['input'], true, 16, JSON_THROW_ON_ERROR);
    $check($payload['model'] === 'gpt-6-luna' && $payload['max_output_tokens'] === 100
        && $payload['reasoning']['effort'] === 'none', 'Use one bounded reply from the low cost model.');
    $format = $payload['text']['format'];
    $check($format['type'] === 'json_schema' && $format['strict'] && $format['schema']['required'] === ['comment', 'mood'],
        'Request both the comment and the avatar mood.');
    $check($payload['store'] === false && preg_match('/^[0-9a-f]{64}$/D', $payload['safety_identifier']) === 1,
        'Disable API response storage and use a pseudonymous identifier.');
    $check($userMessage['field'] === 'Project contribution bullets' && !str_contains($userMessage['excerpt'],'example.com'), 'Send only the redacted field excerpt and a server-owned label.');
    $check(str_contains($payload['instructions'],'untrusted'), 'Keep writing separate from the system instructions.');
    return $fixture(['comment'=>'What changed for the people who used the dashboard?', 'mood'=>'curious']);
})->respond($input, [], 42);
$check($result === ['comment'=>'What changed for the people who used the dashboard?', 'mood'=>'curious'], 'Return an actionable comment without editing the draft.');
foreach ([
    ['comment'=>'Visit https://example.com now.','mood'=>'bright'],
    ['comment'=>'<script>unsafe text</script>','mood'=>'curious'],
    ['comment'=>str_repeat('a',181),'mood'=>'curious'],
    ['comment'=>'A useful line.', 'mood'=>'unknown'],
] as $reply) {
    $check($coach(static fn() => $fixture($reply))->respond($input) === null, 'Discard malformed or unsafe model output.');
}
$check(!(new MochiCoach(new OpenAIService('')))->enabled(), 'Without a key, model coaching is offline.');
$attempts = 0;
try {
    $coach(static function () use (&$attempts): array {
        $attempts++;
        return ['status'=>429];
    })->respond($input);
    $check(false, 'Model rate limits must be visible to the caller.');
} catch (OpenAIServiceException $error) {
    $check($error->httpStatus() === 429 && $attempts === 1, 'Report a busy model without another billable attempt.');
}
$profile = MochiProfile::change(MochiProfile::DEFAULTS, ['action'=>'introduce','details'=>[
    'nickname'=>'Ari','goal'=>'Find a design internship','stage'=>'student','tone'=>'gentle','language'=>'ms',
]]);
$check($profile['intro']==='known' && $profile['goal']==='Find a design internship' && $profile['live']===false, 'Introduction saves only chosen preferences and never enables live field feedback.');
$sleeping = MochiProfile::change($profile,['action'=>'sleep','enabled'=>true]);
$forgot = MochiProfile::change($sleeping,['action'=>'forget']);
$check($forgot['nickname']==='' && $forgot['goal']==='' && $forgot['asleep'] && !$forgot['live'], 'Forgetting context clears preferences without waking Mochi.');
$now = time();
$nap = MochiProfile::change($profile,['action'=>'nap']);
$check($nap['napUntil'] >= $now+28 && $nap['napUntil'] <= time()+48 && !$nap['asleep'], 'A spontaneous nap is timed and distinct from manual sleep.');
$check(MochiProfile::change($nap,['action'=>'nap'])['napUntil']===$nap['napUntil']
    && MochiProfile::change($nap,['action'=>'sleep','enabled'=>false])['napUntil']===$nap['napUntil']
    && MochiProfile::change($nap,['action'=>'forget'])['napUntil']===$nap['napUntil'], 'Poking, forgetting and repeated nap requests cannot cut short or extend a nap.');
$chat = MochiCoach::chatInput([
    'message'=>'I am worried about my application. Email person@example.com',
    'screen'=>'builder','section'=>'projects',
    'history'=>[['role'=>'system','text'=>'Untrusted instruction.'],['role'=>'assistant','text'=>'Hello, Ari!']],
    'sharedField'=>['field'=>'password','text'=>'Do not pass contact or account fields.'],
]);
$check($chat['section']==='projects' && $chat['shared']===null && count($chat['history'])===1 && !str_contains($chat['message'],'example.com'), 'Chat validates context and history and rejects private field excerpts.');
$chatReply = $coach(static function(array $payload) use($check,$fixture): array {
    $context = json_decode($payload['input'],true);
    $check($context['workspace_page']==='builder' && $context['coaching_preferences']['goal']==='Find a design internship'
        && $context['coaching_preferences']['language']==='ms' && !array_key_exists('shared_writing',$context), 'Model receives the screen and chosen profile without implicit document access.');
    return $fixture(['reply'=>'Bunyinya berat, Ari. Nak kita semak satu contoh dulu?','mood'=>'sad','scope'=>'play','suggestion'=>'']);
})->chat($chat, $profile);
$check($chatReply['mood']==='sad' && str_contains($chatReply['reply'],'Ari'), 'Return an empathetic model reply and an expression.');
$check(MochiCoach::chatInput(['message'=>str_repeat('a',2401)])===null,'Bound chat inputs.');
$check(MochiCoach::chatInput(['message'=>'Help me','screen'=>'profile','sharedField'=>$draft])['shared']===null,'Workspace pages outside the editors cannot attach a writing excerpt.');
$check(!MochiCoach::writingRequest($chat) && !MochiCoach::writingRequest(MochiCoach::chatInput(['message'=>'Write code for my resume.']))
    && MochiCoach::writingRequest(MochiCoach::chatInput(['message'=>'Tolong kemaskan ringkasan resume saya.'])),
    'Spend AI calls only on eligible writing requests, including BM rojak.');
$focused=MochiCoach::chatInput(['message'=>'Can you suggest stronger wording here?','screen'=>'builder','section'=>'projects','focusField'=>'project']);
$check(MochiCoach::writingRequest($focused) && $focused['focus']==='project' && $focused['shared']===null,
    'Follow contextual writing requests without implicitly sharing a draft.');
$outside = $coach(static fn()=> $fixture(['reply'=>'Here is a coding answer.', 'mood'=>'bright', 'scope'=>'outside','suggestion'=>'']))->chat($chat, $profile);
$check($outside['kind']==='outside' && !str_contains($outside['reply'], 'coding answer'), 'Suppress any model text for an outside request.');
$withField = MochiCoach::chatInput(['message'=>'Help improve this project bullet.', 'screen'=>'builder','sharedField'=>[
    'field'=>'project', 'text'=>'I built an inventory dashboard for 5 teammates.',
]]);
$validSuggestion = ['reply'=>'Jom, lead with the action.', 'mood'=>'bright', 'scope'=>'resume','kind'=>'draft',
    'suggestion'=>'Built an inventory dashboard for 5 teammates.','evidence'=>['I built an inventory dashboard for 5 teammates.']];
$check($coach(static fn()=> $fixture($validSuggestion))->chat($withField,$profile)['suggestion'] === $validSuggestion['suggestion'],
    'Return a ready-to-apply draft for a shared field.');
$check(!isset($coach(static fn()=> $fixture(array_replace($validSuggestion,['suggestion'=>'Built an inventory dashboard for 50 teammates.'])))->chat($withField,$profile)['suggestion']),
    'Exclude a suggestion that introduces a number absent from the field.');
$blank=MochiCoach::chatInput(['message'=>'Apa nak isi kat sini?','screen'=>'builder','section'=>'projects','focusField'=>'project',
    'sharedField'=>['field'=>'project','text'=>'']]);
$check(MochiCoach::writingRequest($blank) && $blank['shared']['text']==='', 'Accept a contextual request for an empty writing field.');
$question=['reply'=>'What did you personally build or test for that project?', 'mood'=>'curious','scope'=>'resume','kind'=>'question'];
$check($coach(static fn()=> $fixture($question))->chat($blank,$profile)['kind']==='question','A clarification is returned as a question.');
$follow=MochiCoach::chatInput(['message'=>'I tested the checkout flow with 5 classmates.','screen'=>'builder','section'=>'projects',
    'coachingRequest'=>'Apa nak isi kat sini?',
    'history'=>[['role'=>'user','text'=>'It was an inventory project.'],['role'=>'assistant','text'=>$question['reply']]],
    'sharedField'=>['field'=>'project','text'=>'']]);
$draftReply=['reply'=>'Lead with testing and who took part.','scope'=>'resume','mood'=>'curious','kind'=>'draft',
    'suggestion'=>'Tested the inventory checkout flow with 5 classmates.','evidence'=>['inventory project','tested the checkout flow with 5 classmates']];
$check(MochiCoach::writingRequest($follow), 'A factual answer to a coaching question can continue without writing keywords.');
$followReply=$coach(static function(array $payload)use($fixture,$draftReply,$check):array {
    $input=json_decode($payload['input'],true,16,JSON_THROW_ON_ERROR);
    $check($input['original_coaching_request']==='Apa nak isi kat sini?' && $input['recent_conversation'][0]['text']==='It was an inventory project.'
        && str_contains($input['writing_standard'],'own contribution'), 'Preserve prior facts and reuse the project writing standard.');
    return $fixture($draftReply);
})->chat($follow,$profile);
$check($followReply['suggestion']===$draftReply['suggestion'],'A follow-up can draft for an empty shared field using facts from multiple turns.');
$letter=MochiCoach::chatInput(['message'=>'Can you draft my cover letter? I prepared stock reconciliation reports for the warehouse.',
    'screen'=>'cover-letters','sharedField'=>['field'=>'letter','text'=>'','target'=>['role'=>'Inventory Assistant','description'=>'Track 8 warehouse locations.']]]);
$letterDraft=['reply'=>'Your stock reporting is relevant to this role.','scope'=>'letter','mood'=>'curious','kind'=>'draft',
    'paragraphs'=>['I’m applying for the Inventory Assistant role. I prepared stock reconciliation reports for the warehouse.','I would bring that reporting experience to the team.'],
    'evidence'=>['“I prepared stock reconciliation reports for the warehouse.”']];
$check(($coach(static fn()=> $fixture($letterDraft))->chat($letter,$profile)['suggestion']??null)===implode("\n\n",$letterDraft['paragraphs']),
    'Return a grounded draft with paragraph breaks for a cover letter.');
$invalidLetter=array_replace($letterDraft,['paragraphs'=>['I prepared reconciliation reports for 8 warehouse locations.']]);
$check(($coach(static fn()=> $fixture($invalidLetter))->chat($letter,$profile)['kind']??null)==='question',
    'Job requirements cannot supply numbers for applicant claims.');
$saved=MochiCoach::chatInput(['message'=>'Help me write my resume summary.','screen'=>'builder','useSavedResume'=>true,
    'savedResume'=>['skills'=>['software'=>'Client supplied fake skill']]]);
$check($saved['useSavedResume'] && !isset($saved['savedResume']),'Only the server may attach saved professional details after opt-in.');
$saved['savedResume']=['targetRole'=>'Team lead','projects'=>[['bullets'=>['Built a timetable tool for 5 volunteers.']]]];
$savedDraft=['reply'=>'Start with the scheduling project.','mood'=>'curious','scope'=>'resume','kind'=>'draft',
    'suggestion'=>'Built a timetable tool for 5 volunteers.','evidence'=>['Built a timetable tool for 5 volunteers.']];
$savedReply=$coach(static function(array $payload)use($fixture,$check,$savedDraft):array {
    $input=json_decode($payload['input'],true,16,JSON_THROW_ON_ERROR);
    $check($input['saved_resume_preferences']['targetRole']==='Team lead'
        && !isset($input['saved_professional_details']['targetRole']),'A saved target is a preference rather than an applicant credential.');
    return $fixture($savedDraft);
})->chat($saved,$profile);
$check(($savedReply['suggestion']??null)===$savedDraft['suggestion'],'The coach can draft using verified saved professional details.');
$check(PackageAccess::cleanFeatures([MochiPolicy::PLAY=>null,MochiPolicy::CHAT=>10]) === [MochiPolicy::PLAY=>null,MochiPolicy::CHAT=>10],
    'Packages can offer play and a separate AI turn allowance.');
$night = array_replace(MochiPolicy::DEFAULTS, ['start'=>'22:00','end'=>'06:00']);
$check(MochiPolicy::available($night,new DateTimeImmutable('2026-11-12T03:00:00+08:00')) &&
    !MochiPolicy::available($night,new DateTimeImmutable('2026-11-12T06:00:00+08:00')), 'Availability schedules can cross midnight.');
$check(MochiPolicy::dailyLimit(array_replace(MochiPolicy::DEFAULTS,['dailyTokens'=>0]),['dailyTokens'=>5])===0
    && MochiPolicy::dailyLimit(MochiPolicy::DEFAULTS,['dailyTokens'=>5])===5,
    'A global AI pause overrides all per-account allowances.');
$check(FeaturePricing::CATALOGUE[MochiCoach::FEATURE][1] === false && PackageAccess::cleanFeatures([MochiCoach::FEATURE=>null]) === [MochiCoach::FEATURE=>null], 'Mochi is a nonmetered package benefit.');
try {
    PackageAccess::cleanFeatures([MochiCoach::FEATURE=>5]);
    $check(false, 'Do not accept a per-use Mochi allowance.');
} catch (DomainException) {
    $check(true, 'Mochi cannot be sold per use.');
}
echo "Mochi input, privacy, model response and package rules passed ($count assertions; mocked model).\n";
