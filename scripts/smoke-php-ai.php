<?php
declare(strict_types=1);

use ReGen\OpenAIService;
use ReGen\OpenAIServiceException;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertAi(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('AI smoke test failed: ' . $message);
    }
}

/** @param array<string, mixed> $content */
function responseWithJson(array $content): array
{
    return [
        'status' => 200,
        'curlError' => 0,
        'body' => json_encode([
            'output' => [[
                'type' => 'message',
                'content' => [[
                    'type' => 'output_text',
                    'text' => json_encode($content),
                ]],
            ]],
        ]),
    ];
}

function emptySuggestion(string $section): array
{
    $suggestion = ['section' => $section];
    if ($section === 'summary') {
        $suggestion['summary'] = '';
    } elseif (in_array($section, ['experience', 'projects', 'extracurricular'], true)) {
        $suggestion['entries'] = [];
    } elseif ($section === 'skills') {
        $suggestion['skills'] = [
            'technical' => [],
            'software' => [],
            'interpersonal' => [],
            'language' => [],
            'custom' => [],
        ];
    } else {
        $suggestion['items'] = [];
    }
    return $suggestion;
}

$defaultService = new OpenAIService('test-key');
assertAi(
    $defaultService->model() === 'gpt-5.4-mini',
    'the production-oriented default model should be gpt-5.4-mini'
);

$capturedPayload = [];
$service = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (array $payload, int $attempt) use (&$capturedPayload): array {
        $capturedPayload = $payload;
        $content = emptySuggestion('projects');
        $content['entries'] = [[
            'index' => 0,
            'description' => 'Built a web application that helps users prepare structured resumes.',
            'bullets' => [[
                'index' => 0,
                'text' => 'Created the interface with React and reusable components.',
            ]],
        ]];
        return responseWithJson($content);
    }
);

$suggestion = $service->suggestSection(
    'projects',
    ['entries' => [[
        'index' => 0,
        'title' => 'ReGen',
        'type' => 'Personal Project',
        'description' => 'resume builder web app',
        'bullets' => [['index' => 0, 'text' => 'React reusable components']],
    ]]],
    '{"targetRole":"Software Engineer","experience":[{"role":"Developer","company":"Acme Digital"}],"projects":[{"title":"ReGen","description":"resume builder web app","bullets":["React reusable components"]}]}',
    [],
    42
);

assertAi($service->enabled(), 'configured service should be enabled');
assertAi($service->model() === 'gpt-5.4-mini', 'the configured production model should be retained');
assertAi(
    ($capturedPayload['text']['format']['type'] ?? '') === 'json_schema'
        && ($capturedPayload['reasoning']['effort'] ?? '') === 'low'
        && ($capturedPayload['store'] ?? true) === false
        && ($capturedPayload['safety_identifier'] ?? '')
            === hash_hmac('sha256', 'regen-user:42', 'test-key'),
    'Responses API request should use structured output, low reasoning, store=false, and a private safety identifier'
);
assertAi(
    str_contains((string) ($capturedPayload['instructions'] ?? ''), 'Never invent metrics')
        && str_contains((string) ($capturedPayload['instructions'] ?? ''), 'keyword stuffing')
        && str_contains((string) ($capturedPayload['instructions'] ?? ''), 'Personal details'),
    'instructions should enforce factual, natural, ATS-friendly, privacy-safe writing'
);
$promptInput = (string) ($capturedPayload['input'] ?? '');
$globalStart = strpos($promptInput, '<redacted_professional_context_for_summary_skills_and_style>');
$globalEnd = strpos($promptInput, '</redacted_professional_context_for_summary_skills_and_style>');
$localStart = strpos($promptInput, '<current_section_fact_source>');
$localEnd = strpos($promptInput, '</current_section_fact_source>');
assertAi(
    $globalStart !== false
        && $globalEnd !== false
        && $localStart !== false
        && $localEnd !== false
        && $globalStart < $globalEnd
        && $globalEnd < $localStart
        && $localStart < $localEnd
        && str_contains(substr($promptInput, $globalStart, $globalEnd - $globalStart), 'Acme Digital')
        && str_contains(substr($promptInput, $localStart, $localEnd - $localStart), 'ReGen'),
    'employer context and project facts should remain in their explicit global and local prompt boundaries'
);
assertAi(
    ($suggestion['entries'][0]['description'] ?? '') === 'Built a web application that helps users prepare structured resumes.'
        && ($suggestion['entries'][0]['bullets'][0]['text'] ?? '') === 'Created the interface with React and reusable components.',
    'project fields should be returned as one section-level suggestion'
);

$retryAttempts = 0;
$retryService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (array $payload, int $attempt) use (&$retryAttempts): array {
        $retryAttempts++;
        if ($attempt === 0) {
            return ['status' => 503, 'curlError' => 0, 'body' => ''];
        }
        $content = emptySuggestion('summary');
        $content['summary'] = 'Software developer with experience building accessible web applications with React.';
        return responseWithJson($content);
    }
);
$summary = $retryService->suggestSection(
    'summary',
    ['summary' => 'developer building React web apps'],
    '{"skills":{"technical":"React"}}'
);
assertAi(
    $retryAttempts === 2
        && ($summary['summary'] ?? '') === 'Software developer with experience building accessible web applications with React.',
    'one transient OpenAI failure should be retried'
);

$capturedSkillsPayload = [];
$skillsService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (array $payload) use (&$capturedSkillsPayload): array {
        $capturedSkillsPayload = $payload;
        $content = emptySuggestion('skills');
        $content['skills']['technical'] = [
            [
                'name' => 'API Development',
                'evidence' => 'Built a Node.js API for applicant tracking',
            ],
            [
                'name' => 'Kubernetes',
                'evidence' => 'Deployed production workloads to Kubernetes',
            ],
        ];
        $content['skills']['interpersonal'] = [
            [
                'name' => 'Cross-functional Collaboration',
                'evidence' => 'Collaborated with designers and engineers to ship accessible features',
            ],
            [
                'name' => 'Strategic Leadership',
                'evidence' => 'Built a Node.js API for applicant tracking',
            ],
        ];
        $content['skills']['custom'] = [[
            'index' => 0,
            'label' => 'Methods',
            'skills' => [[
                'name' => 'Scrum',
                'evidence' => 'Facilitated Scrum ceremonies for the delivery team',
            ]],
        ]];
        return responseWithJson($content);
    }
);
$skills = $skillsService->suggestSection(
    'skills',
    [
        'technical' => 'React',
        'software' => '',
        'interpersonal' => '',
        'language' => '',
        'custom' => [['index' => 0, 'label' => 'Methods', 'value' => 'Agile']],
    ],
    '{"experience":[{"company":"Acme Digital","bullets":["Collaborated with designers and engineers to ship accessible features.","Facilitated Scrum ceremonies for the delivery team."]}],"projects":[{"title":"ReGen","bullets":["Built a Node.js API for applicant tracking."]}]}'
);
assertAi(
    ($skills['skills']['technical'] ?? '') === 'React, API Development'
        && ($skills['skills']['interpersonal'] ?? '') === 'Cross-functional Collaboration'
        && ($skills['skills']['custom'][0]['value'] ?? '') === 'Agile, Scrum',
    'skills should preserve drafts and accept evidence-backed technical, interpersonal, and custom inferences'
);
assertAi(
    !str_contains((string) ($skills['skills']['technical'] ?? ''), 'Kubernetes')
        && !str_contains((string) ($skills['skills']['interpersonal'] ?? ''), 'Strategic Leadership'),
    'skills backed by fabricated or unrelated evidence should be rejected'
);
$skillsSchema = $capturedSkillsPayload['text']['format']['schema']['properties']['skills']['properties'] ?? [];
$requiredSkillCategories = $capturedSkillsPayload['text']['format']['schema']['properties']['skills']['required'] ?? [];
assertAi(
    ($skillsSchema['technical']['items']['properties']['evidence']['type'] ?? '') === 'string'
        && ($skillsSchema['language']['items']['properties']['evidence']['type'] ?? '') === 'string'
        && ($skillsSchema['custom']['items']['properties']['skills']['type'] ?? '') === 'array'
        && in_array('language', is_array($requiredSkillCategories) ? $requiredSkillCategories : [], true)
        && str_contains(
            (string) ($capturedSkillsPayload['instructions'] ?? ''),
            'never infer fluency or proficiency'
        ),
    'the skills schema should use grounded arrays for every default and custom category'
);

$emptySkillsService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (): array {
        $content = emptySuggestion('skills');
        $content['skills']['technical'] = [[
            'name' => 'API Development',
            'evidence' => 'Built a Node.js API for applicant tracking',
        ]];
        $content['skills']['software'] = [[
            'name' => 'Jira',
            'evidence' => 'Tracked delivery work in Jira',
        ]];
        $content['skills']['interpersonal'] = [[
            'name' => 'Cross-functional Collaboration',
            'evidence' => 'Collaborated with designers and engineers to ship accessible features',
        ]];
        $content['skills']['language'] = [
            [
                'name' => 'English',
                'evidence' => 'Translated customer guides between English and Malay',
            ],
            [
                'name' => 'Malay',
                'evidence' => 'Translated customer guides between English and Malay',
            ],
            [
                'name' => 'Fluent English',
                'evidence' => 'Translated customer guides between English and Malay',
            ],
            [
                'name' => 'German',
                'evidence' => 'Translated customer guides between English and Malay',
            ],
        ];
        return responseWithJson($content);
    }
);
$skillsFromResume = $emptySkillsService->suggestSection(
    'skills',
    [
        'technical' => '',
        'software' => '',
        'interpersonal' => '',
        'language' => '',
        'custom' => [],
    ],
    '{"experience":[{"company":"Acme Digital","bullets":["Collaborated with designers and engineers to ship accessible features","Tracked delivery work in Jira","Translated customer guides between English and Malay"]}],"projects":[{"title":"ReGen","bullets":["Built a Node.js API for applicant tracking"]}]}'
);
assertAi(
    ($skillsFromResume['skills']['technical'] ?? '') === 'API Development'
        && ($skillsFromResume['skills']['software'] ?? '') === 'Jira'
        && ($skillsFromResume['skills']['interpersonal'] ?? '') === 'Cross-functional Collaboration'
        && ($skillsFromResume['skills']['language'] ?? '') === 'English, Malay',
    'empty default skill fields should be populated from grounded full-resume evidence'
);
assertAi(
    !str_contains((string) ($skillsFromResume['skills']['language'] ?? ''), 'Fluent')
        && !str_contains((string) ($skillsFromResume['skills']['language'] ?? ''), 'German'),
    'language suggestions should not invent proficiency or an unevidenced language'
);

$existingSkillItems = [
    'PHP', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Git', 'Docker',
    'HTML', 'CSS', 'REST APIs', 'Unit Testing', 'Linux', 'Bash', 'CI/CD',
];
$existingSkillDraft = implode(', ', $existingSkillItems);
$preservationService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (): array {
        return responseWithJson(emptySuggestion('skills'));
    }
);
$preservedSkills = $preservationService->suggestSection(
    'skills',
    [
        'technical' => $existingSkillDraft,
        'software' => '',
        'interpersonal' => '',
        'language' => '',
        'custom' => [],
    ],
    '{"projects":[{"bullets":["Built and tested a web application."]}]}'
);
assertAi(
    count(array_map('trim', explode(',', (string) ($preservedSkills['skills']['technical'] ?? ''))))
        === count($existingSkillItems)
        && str_contains((string) ($preservedSkills['skills']['technical'] ?? ''), 'CI/CD'),
    'more than 12 existing skills should be preserved without silent truncation'
);

$exactNumberRejected = false;
$metricService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (): array {
        $content = emptySuggestion('experience');
        $content['entries'] = [[
            'index' => 0,
            'description' => '',
            'bullets' => [['index' => 0, 'text' => 'Managed 3 concurrent projects for Acme Digital.']],
        ]];
        return responseWithJson($content);
    }
);
try {
    $metricService->suggestSection(
        'experience',
        ['entries' => [[
            'index' => 0,
            'role' => 'Developer',
            'company' => 'Acme Digital',
            'employmentType' => 'Full-time',
            'bullets' => [['index' => 0, 'text' => 'Managed 30 concurrent projects.']],
        ]]],
        '{"experience":[{"role":"Developer","company":"Acme Digital"}]}'
    );
} catch (OpenAIServiceException $error) {
    $exactNumberRejected = $error->httpStatus() === 422;
}
assertAi($exactNumberRejected, 'the number 3 must not be accepted merely because the source contains 30');

$incompleteRejected = false;
$incompleteService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static fn (): array => [
        'status' => 200,
        'curlError' => 0,
        'body' => json_encode([
            'status' => 'incomplete',
            'incomplete_details' => ['reason' => 'max_output_tokens'],
            'output' => [],
        ]),
    ]
);
try {
    $incompleteService->suggestSection(
        'summary',
        ['summary' => 'Developer building accessible web applications.'],
        '{"skills":{"technical":"React"}}'
    );
} catch (OpenAIServiceException $error) {
    $incompleteRejected = $error->httpStatus() === 502
        && str_contains(mb_strtolower($error->getMessage()), 'incomplete');
}
assertAi($incompleteRejected, 'incomplete Responses API results should be rejected explicitly');

$refusalRejected = false;
$refusalService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static fn (): array => [
        'status' => 200,
        'curlError' => 0,
        'body' => json_encode([
            'status' => 'completed',
            'output' => [[
                'type' => 'message',
                'content' => [[
                    'type' => 'refusal',
                    'refusal' => 'Unable to assist with this request.',
                ]],
            ]],
        ]),
    ]
);
try {
    $refusalService->suggestSection(
        'summary',
        ['summary' => 'Developer building accessible web applications.'],
        '{"skills":{"technical":"React"}}'
    );
} catch (OpenAIServiceException $error) {
    $refusalRejected = $error->httpStatus() === 422;
}
assertAi($refusalRejected, 'Responses API refusals should be handled without parsing them as suggestions');

$capturedCommentPayload = [];
$commentService = new OpenAIService(
    'test-key',
    'gpt-5.4-mini',
    static function (array $payload) use (&$capturedCommentPayload): array {
        $capturedCommentPayload = $payload;
        return [
            'status' => 200,
            'curlError' => 0,
            'body' => json_encode([
                'output' => [[
                    'type' => 'message',
                    'content' => [[
                        'type' => 'output_text',
                        'text' => 'Strengthen the experience bullets with specific tools and supplied outcomes. Keep the strongest role keywords easy to scan.',
                    ]],
                ]],
            ]),
        ];
    }
);
$comment = $commentService->atsComment('{"skills":{"technical":"React"}}', [
    'score' => 70,
    'label' => 'Strong',
    'recommendations' => ['Add evidence to experience bullets.'],
    'strengths' => ['Clear structure.'],
], 42);
assertAi(
    str_contains($comment, 'experience bullets')
        && ($capturedCommentPayload['safety_identifier'] ?? '')
            === hash_hmac('sha256', 'regen-user:42', 'test-key'),
    'ATS comments should use plain output text and the same private user safety identifier'
);

$disabledRejected = false;
try {
    (new OpenAIService(''))->suggestSection('summary', ['summary' => 'draft'], '{}');
} catch (OpenAIServiceException $error) {
    $disabledRejected = $error->httpStatus() === 503;
}
assertAi($disabledRejected, 'missing API key should disable AI safely');

echo "PHP AI smoke test passed (mocked OpenAI Responses API; no key or credits used).\n";
