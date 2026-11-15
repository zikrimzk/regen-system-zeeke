<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/vendor/autoload.php';
use ReGen\{OpenAIService, OpenAIServiceException, ResumeAssistance};
$count = 0;
$check = static function(bool $ok, string $message) use (&$count): void { $count++; if (!$ok) throw new RuntimeException($message); };
$reject = static function(callable $call, string $message) use ($check): void { try { $call(); } catch (OpenAIServiceException) { $check(true, $message); return; } $check(false, $message); };
$mock = static function(mixed $result, ?callable $inspect = null): OpenAIService {
    return new OpenAIService('fixture-key', 'gpt-5.4-mini', static function($payload) use ($result, $inspect) {
        if ($inspect) $inspect($payload);
        return ['status' => 200, 'body' => json_encode(['status' => 'completed', 'output_text' => is_string($result) ? $result : json_encode($result)]), 'curlError' => 0];
    });
};
$definitions = ResumeAssistance::catalogue();
$check(count($definitions) === 15, 'All narrative sections and CV subtypes need their own guidance.');
$questions = [];
foreach ($definitions as $section => $definition) {
    $check(count($definition['questions']) === 4, 'Each section should have four targeted questions.');
    $questions[] = $definition['questions'][0]['label'];
    foreach ($definition['questions'] as $question) {
        $check(str_word_count($question['label']) <= 15, 'Questions should use short, readable sentences.');
        $check(is_string($question['example'] ?? null) && $question['example'] !== '', 'Every question needs an example or answer hint.');
    }
    $raw = ['answer1' => 'Saya membantu pasukan menyediakan laporan projek.', 'answer2' => 'Saya menggunakan Excel untuk menyemak dan menyusun maklumat.', 'answer3' => '', 'answer4' => ''];
    $answers = ResumeAssistance::cleanAnswers($section, $raw);
    $check(str_contains(implode(' ', $answers), 'Saya membantu'), 'Multilingual notes must survive sanitization.');
    $format = $section === 'summary' ? 'paragraph' : ($section === 'skills' ? 'skills' : 'bullets');
    $line = $section === 'skills' ? 'Excel' : 'Prepared project reports and organised information in Excel.';
    $result = $mock(['lines' => [$line]], static function($payload) use ($check, $section) {
        $check($payload['store'] === false, 'Draft requests must not enable provider storage.');
        $check($payload['text']['format']['strict'] === true, 'Drafts need strict structured output.');
        $check(str_contains($payload['instructions'], 'professional English'), 'Output language should be explicit.');
        $check(str_contains($payload['input'], $section), 'The selected section must reach the provider.');
    })->assistSection($section, $answers, ['format' => $format], '{}', 1);
    $check($result['lines'] === [$line] && $result['section'] === $section, 'A valid section draft must be usable.');
}
$check(count(array_unique($questions)) === count($definitions), 'Every section needs distinct questions.');
$reject(fn() => ResumeAssistance::cleanAnswers('summary', ['answer1' => '', 'answer2' => 'Hello']), 'Empty required notes must fail before the provider call.');
$reject(fn() => ResumeAssistance::cleanAnswers('summary', ['answer1' => str_repeat('x', 2001), 'answer2' => 'Hello']), 'Long answers must be rejected, not silently truncated.');
$reject(fn() => ResumeAssistance::cleanAnswers('personal', []), 'Contact details must not be an AI writing target.');
$answers = ['Work' => 'Assisted with weekly project reports using Excel.'];
foreach ([['lines' => []], ['lines' => ['Prepared 75 reports.']], ['lines' => ['Led the team.']], ['lines' => ['Contact me at test@example.com']], ['lines' => ['• Prepared reports.']], ['lines' => ['Prepared reports.', 'Prepared reports.']], ['lines' => ["Prepared reports.\nExtra line"]], ['lines' => [false]], '{broken json'] as $bad) {
    $reject(fn() => $mock($bad)->assistSection('experience', $answers, ['format' => 'bullets'], '{}'), 'Invalid, unsupported or sensitive drafts must fail.');
}
$reject(fn() => $mock(['lines' => ['Prepared reports.', 'Organised information.']])->assistSection('summary', $answers, ['format' => 'paragraph'], '{}'), 'A paragraph target must return one paragraph.');
$dateLine = 'Operations Certificate, Example Institute, awarded 2024-08-31.';
$dated = $mock(['lines' => [$dateLine]])->assistSection('certifications', ['Credential' => $dateLine], ['format' => 'items'], '{}');
$check($dated['lines'] === [$dateLine], 'ISO credential dates must not be mistaken for phone numbers.');
echo "Assist me question, multilingual-input and provider validation checks passed ($count assertions; mocked transport, no API credits used).\n";
