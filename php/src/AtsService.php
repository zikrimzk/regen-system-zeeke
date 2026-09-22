<?php
declare(strict_types=1);

namespace ReGen;

final class AtsService
{
    private const ACTION_VERBS = [
        'achieved', 'analyzed', 'automated', 'built', 'collaborated', 'coordinated',
        'created', 'delivered', 'designed', 'developed', 'drove', 'implemented',
        'improved', 'increased', 'launched', 'led', 'managed', 'optimized',
        'organized', 'reduced', 'resolved', 'supported', 'tested', 'trained',
    ];

    /**
     * @param array<string, mixed> $resume
     * @return array{
     *   score:int,
     *   label:string,
     *   summary:string,
     *   checks:list<array{label:string,status:string,detail:string}>,
     *   recommendations:list<string>,
     *   strengths:list<string>
     * }
     */
    public function analyze(array $resume): array
    {
        $resume = Sanitizer::sanitizeResume($resume);
        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        $summary = trim((string) ($resume['summary'] ?? ''));
        $education = is_array($resume['education'] ?? null) ? $resume['education'] : [];
        $experience = is_array($resume['experience'] ?? null) ? $resume['experience'] : [];
        $projects = is_array($resume['projects'] ?? null) ? $resume['projects'] : [];
        $skills = is_array($resume['skills'] ?? null) ? $resume['skills'] : [];
        $bullets = self::collectBullets($resume);

        $score = 0;
        $checks = [];
        $recommendations = [];
        $strengths = [];

        $contactCount = count(array_filter([
            trim((string) ($personal['fullName'] ?? '')),
            trim((string) ($personal['email'] ?? '')),
            trim((string) ($personal['phone'] ?? '')),
        ], static fn (string $value): bool => $value !== ''));
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $contactCount === 3 ? 12 : ($contactCount === 2 ? 8 : 3),
            'Contact essentials',
            $contactCount === 3,
            $contactCount === 3
                ? 'Name, email, and phone are present.'
                : 'Add a professional name, email, and phone number.',
            'Complete the name, email, and phone fields so recruiters can contact you.'
        );

        $hasHeadline = trim((string) ($personal['jobTitle'] ?? '')) !== '';
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $hasHeadline ? 6 : 0,
            'Target role',
            $hasHeadline,
            $hasHeadline
                ? 'A clear role headline helps the resume match relevant searches.'
                : 'The target role is missing.',
            'Add a specific target role, such as “Graduate Data Analyst”.'
        );

        $summaryWords = self::wordCount($summary);
        $summaryStrong = $summaryWords >= 35 && $summaryWords <= 100;
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $summaryStrong ? 12 : ($summaryWords > 0 ? 6 : 0),
            'Professional summary',
            $summaryStrong,
            $summaryStrong
                ? 'The summary is concise and substantial.'
                : ($summaryWords === 0
                    ? 'No professional summary was found.'
                    : 'The summary will scan better at roughly 35–100 words.'),
            $summaryWords === 0
                ? 'Add a short summary connecting your target role, strongest skills, and relevant evidence.'
                : 'Tighten the summary to 2–4 focused sentences with role-specific keywords.'
        );

        $hasEducation = count($education) > 0;
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $hasEducation ? 8 : 0,
            'Education',
            $hasEducation,
            $hasEducation ? 'Education details are included.' : 'Education details are missing.',
            'Add your highest or most relevant education entry.'
        );

        $hasEvidence = count($experience) > 0 || count($projects) > 0;
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $hasEvidence ? 10 : 0,
            'Experience evidence',
            $hasEvidence,
            $hasEvidence
                ? 'Work experience or projects provide evidence of capability.'
                : 'No work experience or project evidence was found.',
            'Add relevant work, internship, volunteer, or project experience.'
        );

        $skillText = implode(' ', array_filter([
            (string) ($skills['technical'] ?? ''),
            (string) ($skills['software'] ?? ''),
            (string) ($skills['interpersonal'] ?? ''),
            (string) ($skills['language'] ?? ''),
            ...array_map(
                static fn (mixed $item): string => is_array($item)
                    ? trim((string) ($item['label'] ?? '') . ' ' . (string) ($item['value'] ?? ''))
                    : '',
                is_array($skills['custom'] ?? null) ? $skills['custom'] : []
            ),
        ]));
        $hasSkills = self::wordCount($skillText) >= 3;
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $hasSkills ? 10 : 0,
            'Searchable skills',
            $hasSkills,
            $hasSkills
                ? 'A dedicated skills section gives ATS systems searchable keywords.'
                : 'The skills section is too limited.',
            'Add specific tools, technologies, methods, and languages you can genuinely use.'
        );

        $clearBullets = count(array_filter(
            $bullets,
            static function (string $bullet): bool {
                $words = self::wordCount($bullet);
                return $words >= 6 && $words <= 35;
            }
        ));
        $bulletRatio = count($bullets) > 0 ? $clearBullets / count($bullets) : 0.0;
        $bulletPoints = $bulletRatio >= 0.75 ? 12 : ($bulletRatio >= 0.4 ? 7 : 2);
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            count($bullets) > 0 ? $bulletPoints : 0,
            'Bullet readability',
            count($bullets) >= 2 && $bulletRatio >= 0.75,
            count($bullets) === 0
                ? 'No evidence bullets were found.'
                : sprintf('%d of %d bullets are within a clear scanning length.', $clearBullets, count($bullets)),
            'Keep most bullets to one clear idea and roughly 6–35 words.'
        );

        $actionBullets = count(array_filter(
            $bullets,
            static fn (string $bullet): bool => self::startsWithActionVerb($bullet)
        ));
        $actionRatio = count($bullets) > 0 ? $actionBullets / count($bullets) : 0.0;
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            count($bullets) === 0 ? 0 : ($actionRatio >= 0.65 ? 10 : ($actionRatio >= 0.35 ? 6 : 2)),
            'Action-led writing',
            count($bullets) >= 2 && $actionRatio >= 0.65,
            count($bullets) === 0
                ? 'Add bullets before this check can be completed.'
                : sprintf('%d of %d bullets begin with a clear action.', $actionBullets, count($bullets)),
            'Begin more experience and project bullets with a specific action verb.'
        );

        $measuredBullets = count(array_filter(
            $bullets,
            static fn (string $bullet): bool => (bool) preg_match(
                '/(?:\b\d+(?:[.,]\d+)?%?\b|\bRM\s?\d+|\bUSD\s?\d+|\$\s?\d+)/iu',
                $bullet
            )
        ));
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            count($bullets) === 0 ? 0 : ($measuredBullets >= 2 ? 8 : ($measuredBullets === 1 ? 5 : 2)),
            'Measurable impact',
            $measuredBullets >= 1,
            $measuredBullets > 0
                ? sprintf('%d bullet%s include%s measurable evidence.', $measuredBullets, $measuredBullets === 1 ? '' : 's', $measuredBullets === 1 ? 's' : '')
                : 'No measurable evidence was detected.',
            'Where truthful, add scale, frequency, time saved, quality improvement, or another concrete result.'
        );

        $sectionCount = count(array_filter([
            $summary !== '',
            count($education) > 0,
            count($experience) > 0,
            count($projects) > 0,
            $hasSkills,
        ]));
        self::record(
            $checks,
            $recommendations,
            $strengths,
            $score,
            $sectionCount >= 4 ? 8 : ($sectionCount === 3 ? 5 : 2),
            'Section coverage',
            $sectionCount >= 4,
            sprintf('%d of 5 core ATS sections contain information.', $sectionCount),
            'Complete the missing core sections that are relevant to your background.'
        );

        $score += 4;
        $checks[] = [
            'label' => 'ATS-safe layout',
            'status' => 'pass',
            'detail' => 'ReGen uses a simple text-first resume layout without tables or decorative charts.',
        ];
        $strengths[] = 'ATS-safe text-first layout';

        $score = max(0, min(100, $score));
        $label = match (true) {
            $score >= 85 => 'Excellent',
            $score >= 70 => 'Strong',
            $score >= 55 => 'Developing',
            default => 'Needs attention',
        };
        $summaryText = match (true) {
            $score >= 85 => 'Your resume is well structured for applicant tracking systems. Review the final wording and tailor keywords for each role.',
            $score >= 70 => 'Your resume has a solid ATS foundation. A few targeted edits can make the evidence and keywords easier to scan.',
            $score >= 55 => 'Your resume is readable, but several core sections or evidence signals need strengthening before you apply.',
            default => 'Complete the priority items below before downloading and using this resume.',
        };

        return [
            'score' => $score,
            'label' => $label,
            'summary' => $summaryText,
            'checks' => $checks,
            'recommendations' => array_slice(array_values(array_unique($recommendations)), 0, 5),
            'strengths' => array_slice(array_values(array_unique($strengths)), 0, 4),
        ];
    }

    /** @param array<string, mixed> $resume */
    public function safeAiContext(array $resume): string
    {
        $resume = Sanitizer::sanitizeResume($resume);
        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        $safe = [
            'targetRole' => Sanitizer::cleanText($personal['jobTitle'] ?? '', false, 120),
            'summary' => Sanitizer::cleanText($resume['summary'] ?? '', true, 900),
            'education' => [],
            'experience' => [],
            'projects' => [],
            'extracurricular' => [],
            'skills' => self::safeSkillContext($resume['skills'] ?? []),
            'achievements' => array_map(
                static fn (mixed $item): string => Sanitizer::cleanText($item, true, 320),
                array_slice(is_array($resume['achievements'] ?? null) ? $resume['achievements'] : [], 0, 12)
            ),
            'certifications' => array_map(
                static fn (mixed $item): string => Sanitizer::cleanText($item, true, 320),
                array_slice(is_array($resume['certifications'] ?? null) ? $resume['certifications'] : [], 0, 12)
            ),
        ];
        foreach (array_slice(is_array($resume['education'] ?? null) ? $resume['education'] : [], 0, 8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $safe['education'][] = [
                'degree' => Sanitizer::cleanText($entry['degree'] ?? '', false, 180),
                'institution' => Sanitizer::cleanText($entry['institution'] ?? '', false, 180),
                'result' => Sanitizer::cleanText($entry['cgpa'] ?? '', false, 40),
            ];
        }
        foreach (array_slice(is_array($resume['experience'] ?? null) ? $resume['experience'] : [], 0, 8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $safe['experience'][] = [
                'role' => Sanitizer::cleanText($entry['jobTitle'] ?? '', false, 140),
                'company' => Sanitizer::cleanText($entry['company'] ?? '', false, 180),
                'employmentType' => Sanitizer::cleanText($entry['employmentType'] ?? '', false, 80),
                'bullets' => self::safeAiBullets($entry['bullets'] ?? []),
            ];
        }
        foreach (array_slice(is_array($resume['projects'] ?? null) ? $resume['projects'] : [], 0, 8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $safe['projects'][] = [
                'title' => Sanitizer::cleanText($entry['title'] ?? '', false, 160),
                'type' => Sanitizer::cleanText($entry['type'] ?? '', false, 100),
                'description' => Sanitizer::cleanText($entry['description'] ?? '', true, 300),
                'bullets' => self::safeAiBullets($entry['bullets'] ?? []),
            ];
        }
        foreach (array_slice(is_array($resume['extracurricular'] ?? null) ? $resume['extracurricular'] : [], 0, 8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $safe['extracurricular'][] = [
                'organization' => Sanitizer::cleanText($entry['organization'] ?? '', false, 180),
                'role' => Sanitizer::cleanText($entry['role'] ?? '', false, 140),
                'bullets' => self::safeAiBullets($entry['bullets'] ?? []),
            ];
        }
        $sensitiveValues = [];
        foreach (['fullName', 'email', 'phone', 'linkedin', 'address'] as $key) {
            $value = trim((string) ($personal[$key] ?? ''));
            if (mb_strlen($value) >= 4) {
                $sensitiveValues[] = $value;
            }
        }
        $safe = self::redactAiContext($safe, $sensitiveValues);
        return self::boundedAiContextJson($safe, 12000);
    }

    /** @return list<string> */
    private static function safeAiBullets(mixed $bullets): array
    {
        return array_map(
            static fn (mixed $item): string => Sanitizer::cleanText($item, true, 320),
            array_slice(is_array($bullets) ? $bullets : [], 0, 6)
        );
    }

    /** @return array<string, mixed> */
    private static function safeSkillContext(mixed $skills): array
    {
        $skills = is_array($skills) ? $skills : [];
        $custom = [];
        foreach (array_slice(is_array($skills['custom'] ?? null) ? $skills['custom'] : [], 0, 6) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $custom[] = [
                'label' => Sanitizer::cleanText($item['label'] ?? '', false, 80),
                'value' => Sanitizer::cleanText($item['value'] ?? '', false, 320),
            ];
        }
        return [
            'technical' => Sanitizer::cleanText($skills['technical'] ?? '', false, 500),
            'software' => Sanitizer::cleanText($skills['software'] ?? '', false, 500),
            'interpersonal' => Sanitizer::cleanText($skills['interpersonal'] ?? '', false, 500),
            'language' => Sanitizer::cleanText($skills['language'] ?? '', false, 500),
            'custom' => $custom,
        ];
    }

    /** @param array<string, mixed> $safe */
    private static function boundedAiContextJson(array $safe, int $maxBytes): string
    {
        $encode = static fn (array $value): string => (string) json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );
        $json = $encode($safe);
        if ($json !== '' && strlen($json) <= $maxBytes) {
            return $json;
        }

        $sections = ['experience', 'projects', 'extracurricular', 'education', 'achievements', 'certifications'];
        $bounded = $safe;
        $queues = [];
        foreach ($sections as $section) {
            $queues[$section] = is_array($safe[$section] ?? null) ? array_values($safe[$section]) : [];
            $bounded[$section] = [];
        }
        $progress = true;
        while ($progress) {
            $progress = false;
            foreach ($sections as $section) {
                if ($queues[$section] === []) {
                    continue;
                }
                $item = array_shift($queues[$section]);
                $candidate = $bounded;
                $candidate[$section][] = $item;
                $candidateJson = $encode($candidate);
                if ($candidateJson !== '' && strlen($candidateJson) <= $maxBytes) {
                    $bounded = $candidate;
                    $progress = true;
                } else {
                    $queues[$section] = [];
                }
            }
        }
        $json = $encode($bounded);
        return $json !== '' ? $json : '{}';
    }

    /**
     * @param list<string> $sensitiveValues
     */
    private static function redactAiContext(mixed $value, array $sensitiveValues): mixed
    {
        if (is_array($value)) {
            $result = [];
            foreach ($value as $key => $item) {
                $result[$key] = self::redactAiContext($item, $sensitiveValues);
            }
            return $result;
        }
        if (!is_string($value) || $value === '') {
            return $value;
        }

        $redacted = preg_replace(
            '/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u',
            '[redacted]',
            $value
        ) ?? '';
        $redacted = preg_replace(
            '/(?<!\d)(?:\+?\d[\s().-]*){8,15}(?!\d)/u',
            '[redacted]',
            $redacted
        ) ?? '';
        foreach ($sensitiveValues as $sensitive) {
            $redacted = str_ireplace($sensitive, '[redacted]', $redacted);
        }
        return trim(preg_replace('/(?:\[redacted\]\s*){2,}/iu', '[redacted] ', $redacted) ?? '');
    }

    /** @param array<string, mixed> $resume */
    public static function fingerprint(array $resume): string
    {
        $safe = Sanitizer::sanitizeResume($resume);
        $personal = is_array($safe['personal'] ?? null) ? $safe['personal'] : [];
        $safe['personal'] = [
            'hasName' => trim((string) ($personal['fullName'] ?? '')) !== '',
            'hasEmail' => trim((string) ($personal['email'] ?? '')) !== '',
            'hasPhone' => trim((string) ($personal['phone'] ?? '')) !== '',
            'jobTitle' => trim((string) ($personal['jobTitle'] ?? '')),
        ];
        unset($safe['references']);
        $json = json_encode(
            $safe,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );
        return hash('sha256', is_string($json) ? $json : '{}');
    }

    /**
     * @param list<array{label:string,status:string,detail:string}> $checks
     * @param list<string> $recommendations
     * @param list<string> $strengths
     */
    private static function record(
        array &$checks,
        array &$recommendations,
        array &$strengths,
        int &$score,
        int $points,
        string $label,
        bool $passed,
        string $detail,
        string $recommendation,
    ): void {
        $score += $points;
        $checks[] = [
            'label' => $label,
            'status' => $passed ? 'pass' : 'improve',
            'detail' => $detail,
        ];
        if ($passed) {
            $strengths[] = $label;
        } else {
            $recommendations[] = $recommendation;
        }
    }

    /** @param array<string, mixed> $resume
     *  @return list<string>
     */
    private static function collectBullets(array $resume): array
    {
        $bullets = [];
        foreach (['experience', 'projects', 'extracurricular'] as $section) {
            foreach (is_array($resume[$section] ?? null) ? $resume[$section] : [] as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                foreach (is_array($entry['bullets'] ?? null) ? $entry['bullets'] : [] as $bullet) {
                    $clean = Sanitizer::cleanText($bullet);
                    if ($clean !== '') {
                        $bullets[] = $clean;
                    }
                }
            }
        }
        foreach (['achievements', 'certifications'] as $section) {
            foreach (is_array($resume[$section] ?? null) ? $resume[$section] : [] as $bullet) {
                $clean = Sanitizer::cleanText($bullet);
                if ($clean !== '') {
                    $bullets[] = $clean;
                }
            }
        }
        return $bullets;
    }

    private static function startsWithActionVerb(string $bullet): bool
    {
        $firstWord = mb_strtolower((string) preg_replace('/^([^\p{L}]*)([\p{L}-]+).*$/u', '$2', trim($bullet)));
        return in_array($firstWord, self::ACTION_VERBS, true);
    }

    private static function wordCount(string $text): int
    {
        preg_match_all('/[\p{L}\p{N}][\p{L}\p{N}\'+.-]*/u', $text, $matches);
        return count($matches[0] ?? []);
    }
}
