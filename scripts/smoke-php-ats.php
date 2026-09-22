<?php
declare(strict_types=1);

use ReGen\AtsService;

require dirname(__DIR__) . '/vendor/autoload.php';

function assertAts(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('ATS smoke test failed: ' . $message);
    }
}

$service = new AtsService();
$completeResume = [
    'personal' => [
        'fullName' => 'Nur Aisyah Rahman',
        'jobTitle' => 'Graduate Software Engineer',
        'email' => 'aisyah@example.test',
        'phone' => '+60 12-345 6789',
        'linkedin' => 'linkedin.com/in/aisyah',
        'address' => '43000, Selangor, Malaysia',
    ],
    'summary' => 'Software engineering graduate with practical experience building accessible PHP and JavaScript applications. Comfortable working with MySQL, Git, and responsive interface patterns, with a focus on reliable user experiences.',
    'education' => [[
        'degree' => 'Bachelor of Computer Science',
        'institution' => 'Example University',
        'cgpa' => '3.78',
    ]],
    'experience' => [[
        'jobTitle' => 'Software Developer Intern',
        'company' => 'Example Company',
        'employmentType' => 'Internship',
        'bullets' => [
            'Built responsive account screens with PHP and JavaScript for 3 internal workflows.',
            'Improved form validation and reduced incomplete submissions by 20%.',
        ],
    ]],
    'projects' => [[
        'title' => 'ReGen',
        'type' => 'Personal Project',
        'description' => 'A guided resume builder for mobile and desktop users.',
        'bullets' => ['Implemented MySQL persistence and secure server-side PDF generation.'],
    ]],
    'skills' => [
        'technical' => 'PHP, JavaScript, MySQL, HTML, CSS',
        'software' => 'Git, Figma',
        'interpersonal' => 'Communication, teamwork',
        'language' => 'Malay, English',
        'custom' => [],
    ],
    'references' => [[
        'name' => 'Private Referee',
        'email' => 'referee@example.test',
        'phone' => '+60 11-2222 3333',
    ]],
];

$complete = $service->analyze($completeResume);
$sparse = $service->analyze(['personal' => ['fullName' => 'A User']]);
$safeContext = $service->safeAiContext($completeResume);
$resumeWithMisplacedContact = $completeResume;
$resumeWithMisplacedContact['summary'] .= ' Contact aisyah@example.test or +60 12-345 6789.';
$resumeWithMisplacedContact['projects'][0]['description'] .= ' Created by Nur Aisyah Rahman.';
$redactedMisplacedContext = $service->safeAiContext($resumeWithMisplacedContact);

assertAts($complete['score'] >= 75, 'a complete evidence-led resume should score strongly');
assertAts($sparse['score'] < $complete['score'], 'a sparse resume should score below a complete resume');
assertAts(count($complete['checks']) >= 8, 'review should include actionable ATS checks');
assertAts(
    !str_contains($safeContext, 'aisyah@example.test')
        && !str_contains($safeContext, '+60 12-345 6789')
        && !str_contains($safeContext, 'Private Referee')
        && !str_contains($safeContext, 'referee@example.test'),
    'AI context must exclude personal information and references'
);
assertAts(
    str_contains($safeContext, 'PHP')
        && str_contains($safeContext, 'Software Developer Intern'),
    'AI context should retain relevant professional evidence'
);
assertAts(
    !str_contains($redactedMisplacedContext, 'aisyah@example.test')
        && !str_contains($redactedMisplacedContext, '+60 12-345 6789')
        && !str_contains($redactedMisplacedContext, 'Nur Aisyah Rahman')
        && str_contains($redactedMisplacedContext, 'resume builder'),
    'contact details accidentally entered in professional sections should be redacted without removing useful evidence'
);

echo "PHP ATS smoke test passed (deterministic scoring; no API request used).\n";
