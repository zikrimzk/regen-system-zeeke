<?php
declare(strict_types=1);
namespace ReGen;

final class AtsService
{
    public function analyze(array $resume): array
    {
        return ResumeReview::analyze($resume);
    }

    /** @param array<string, mixed> $resume */
    public function safeAiContext(array $resume): string
    {
        $resume = Sanitizer::sanitizeResume($resume);
        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        $safe = [
            'targetRole' => Sanitizer::cleanText($personal['jobTitle'] ?? '', false, 120),
            'writing' => array_diff_key($resume['writing'],['jobDescription'=>true]),
            'targetJobDescription' => mb_strcut($resume['writing']['jobDescription'],0,3000,'UTF-8'),
            'summary' => Sanitizer::cleanText($resume['summary'] ?? '', true, 900),
            'education' => [],
            'experience' => [],
            'projects' => [],
            'extracurricular' => [],
            'additional' => [],
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
        foreach($resume['additional'] as $block){
            if(in_array($block['kind'],['research','teaching','publications','presentations','funding','affiliations'],true))$safe['additional'][]=['heading'=>$block['title'],'items'=>array_map(static fn($item)=>Sanitizer::cleanText($item,false,320),array_slice($block['items'],0,6))];
        }
        foreach (['fullName', 'email', 'phone', 'linkedin', 'portfolio', 'address'] as $key) {
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

        $sections = ['experience', 'projects', 'extracurricular', 'education', 'achievements', 'certifications', 'additional'];
        $bounded = $safe;
        $queues = [];
        foreach ($sections as $section) {
            $queues[$section] = is_array($safe[$section] ?? null) ? array_values($safe[$section]) : [];
            $bounded[$section] = [];
        }
        // MULTIBYTE TEXT MAY EXCEED A BYTE LIMIT EVEN WHEN CHARACTER LIMITS PASS.
        while(strlen($encode($bounded))>$maxBytes){
            $previous=$encode($bounded);
            array_walk_recursive($bounded,static function(&$value):void{if(is_string($value)&&strlen($value)>120)$value=mb_strcut($value,0,max(120,(int)(strlen($value)*.7)),'UTF-8');});
            if($encode($bounded)===$previous)break;
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

}
