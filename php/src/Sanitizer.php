<?php
declare(strict_types=1);

namespace ReGen;

final class Sanitizer
{
    private const ALLOWED_SECTIONS = [
        'personal', 'summary', 'education', 'experience', 'projects',
        'extracurricular', 'skills', 'achievements', 'certifications', 'references',
    ];

    public static function isAllowedSection(string $section): bool
    {
        return in_array($section, self::ALLOWED_SECTIONS, true);
    }

    public static function cleanText(mixed $value, bool $multiline = false, int $max = 20000): string
    {
        $text = is_scalar($value) ? (string) $value : '';
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($text, \Normalizer::FORM_KC);
            if (is_string($normalized)) {
                $text = $normalized;
            }
        }
        $text = preg_replace('/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}\x{200B}-\x{200D}\x{FEFF}]/u', '', $text) ?? '';
        $text = str_replace(["\u{00A0}", "\r\n", "\r", "\t"], [' ', "\n", "\n", ' '], $text);
        $lines = preg_split('/\n/u', $text) ?: [];
        $cleaned = [];
        foreach ($lines as $line) {
            $line = preg_replace(
                '/^[\s>]*(?:[•●○◦▪▫■□‣⁃*]|[-–—]{1,2}|\d{1,3}[.)]|[a-zA-Z][.)])\s+/u',
                '',
                $line
            ) ?? '';
            $line = trim(preg_replace('/[ ]{2,}/u', ' ', $line) ?? '');
            if ($line !== '') {
                $cleaned[] = $line;
            }
        }
        $result = $multiline
            ? implode("\n", $cleaned)
            : trim(preg_replace('/[ ]{2,}/u', ' ', implode(' ', $cleaned)) ?? '');
        return mb_substr($result, 0, $max);
    }

    /** @return list<string> */
    public static function cleanBullets(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        $result = [];
        foreach ($value as $item) {
            $lines = explode("\n", self::cleanText($item, true));
            foreach ($lines as $line) {
                $clean = self::cleanText($line);
                if ($clean !== '') {
                    $result[] = $clean;
                }
            }
        }
        return $result;
    }

    public static function sanitizeSection(string $section, mixed $data): mixed
    {
        return match ($section) {
            'personal' => self::sanitizePersonal($data),
            'summary' => self::cleanText($data, true),
            'education' => self::cleanEntries($data, static fn (array $item): array => [
                'degree' => self::cleanText($item['degree'] ?? ''),
                'institution' => self::cleanText($item['institution'] ?? ''),
                'institutionCountry' => self::cleanText($item['institutionCountry'] ?? ''),
                'location' => self::cleanText($item['location'] ?? ''),
                'cgpa' => self::cleanText($item['cgpa'] ?? ''),
                'academicResultType' => self::cleanText($item['academicResultType'] ?? ''),
                'startDate' => self::cleanText($item['startDate'] ?? ''),
                'endDate' => self::cleanText($item['endDate'] ?? ''),
            ]),
            'experience' => self::cleanEntries($data, static fn (array $item): array => [
                'jobTitle' => self::cleanText($item['jobTitle'] ?? ''),
                'company' => self::cleanText($item['company'] ?? ''),
                'employmentType' => self::cleanText($item['employmentType'] ?? ''),
                'locationCountry' => self::cleanText($item['locationCountry'] ?? ''),
                'location' => self::cleanText($item['location'] ?? ''),
                'startDate' => self::cleanText($item['startDate'] ?? ''),
                'endDate' => self::cleanText($item['endDate'] ?? ''),
                'bullets' => self::cleanBullets($item['bullets'] ?? []),
            ]),
            'projects' => self::cleanEntries($data, static fn (array $item): array => [
                'title' => self::cleanText($item['title'] ?? ''),
                'type' => self::cleanText($item['type'] ?? ''),
                'description' => self::cleanText($item['description'] ?? '', true),
                'bullets' => self::cleanBullets($item['bullets'] ?? []),
            ]),
            'extracurricular' => self::cleanEntries($data, static fn (array $item): array => [
                'organization' => self::cleanText($item['organization'] ?? ''),
                'role' => self::cleanText($item['role'] ?? ''),
                'bullets' => self::cleanBullets($item['bullets'] ?? []),
            ]),
            'skills' => self::sanitizeSkills($data),
            'achievements', 'certifications' => self::cleanBullets($data),
            'references' => self::sanitizeReferences($data),
            default => $data,
        };
    }

    /** @return array<string, mixed> */
    public static function sanitizeResume(mixed $resume): array
    {
        $source = is_array($resume) ? $resume : [];
        $references = $source['references'] ?? [];
        if ((!is_array($references) || $references === []) && isset($source['reference'])) {
            $references = $source['reference'];
        }
        if ((!is_array($references) || $references === []) && isset($source['referees'])) {
            $references = $source['referees'];
        }

        return [
            'personal' => self::sanitizePersonal($source['personal'] ?? []),
            'summary' => self::sanitizeSection('summary', $source['summary'] ?? ''),
            'education' => self::sanitizeSection('education', $source['education'] ?? []),
            'experience' => self::sanitizeSection('experience', $source['experience'] ?? []),
            'projects' => self::sanitizeSection('projects', $source['projects'] ?? []),
            'extracurricular' => self::sanitizeSection('extracurricular', $source['extracurricular'] ?? []),
            'skills' => self::sanitizeSkills($source['skills'] ?? []),
            'achievements' => self::sanitizeSection('achievements', $source['achievements'] ?? []),
            'certifications' => self::sanitizeSection('certifications', $source['certifications'] ?? []),
            'references' => self::sanitizeReferences($references),
        ];
    }

    /** @return array<string, mixed> */
    private static function sanitizePersonal(mixed $data): array
    {
        $data = is_array($data) ? $data : [];
        $country = self::cleanText($data['locationCountry'] ?? '');
        $state = self::cleanText($data['locationState'] ?? '');
        $postcode = self::cleanText($data['postcode'] ?? '');
        $structured = $country === 'Malaysia'
            ? implode(', ', array_values(array_filter([$postcode, $state, $country])))
            : $country;

        return [
            'fullName' => self::cleanText($data['fullName'] ?? ''),
            'jobTitle' => self::cleanText($data['jobTitle'] ?? ''),
            'email' => mb_strtolower(self::cleanText($data['email'] ?? '')),
            'phone' => self::cleanText($data['phone'] ?? ''),
            'linkedin' => self::cleanText($data['linkedin'] ?? ''),
            'address' => $structured !== '' ? $structured : self::cleanText($data['address'] ?? ''),
            'streetAddress' => '',
            'locationCountry' => $country,
            'locationState' => $state,
            'locationCity' => '',
            'postcode' => $postcode,
            'photoPath' => is_string($data['photoPath'] ?? null) ? $data['photoPath'] : '',
            'photoBase64' => is_string($data['photoBase64'] ?? null) ? $data['photoBase64'] : '',
        ];
    }

    /** @return array<string, mixed> */
    private static function sanitizeSkills(mixed $data): array
    {
        $data = is_array($data) ? $data : [];
        $custom = [];
        foreach (is_array($data['custom'] ?? null) ? $data['custom'] : [] as $item) {
            $item = is_array($item) ? $item : [];
            $row = [
                'label' => self::cleanText($item['label'] ?? ''),
                'value' => self::cleanText($item['value'] ?? ''),
            ];
            if ($row['label'] !== '' || $row['value'] !== '') {
                $custom[] = $row;
            }
        }
        return [
            'interpersonal' => self::cleanText($data['interpersonal'] ?? ''),
            'software' => self::cleanText($data['software'] ?? ''),
            'technical' => self::cleanText($data['technical'] ?? ''),
            'language' => self::cleanText($data['language'] ?? ''),
            'custom' => $custom,
        ];
    }

    /** @return list<array<string, string>> */
    private static function sanitizeReferences(mixed $data): array
    {
        return self::cleanEntries($data, static fn (array $item): array => [
            'name' => self::cleanText(
                $item['name'] ?? $item['fullName'] ?? $item['referenceName'] ?? ''
            ),
            'position' => self::cleanText(
                $item['position'] ?? $item['jobTitle'] ?? $item['title'] ?? $item['company'] ?? ''
            ),
            'email' => self::cleanText($item['email'] ?? ''),
            'phone' => self::cleanText($item['phone'] ?? $item['contact'] ?? ''),
            'phoneCountry' => self::cleanText($item['phoneCountry'] ?? ''),
        ]);
    }

    /**
     * @template T of array<string, mixed>
     * @param mixed $data
     * @param callable(array<string, mixed>):T $mapper
     * @return list<T>
     */
    private static function cleanEntries(mixed $data, callable $mapper): array
    {
        if (!is_array($data)) {
            return [];
        }
        $result = [];
        foreach ($data as $entry) {
            $mapped = $mapper(is_array($entry) ? $entry : []);
            $hasValue = false;
            array_walk_recursive($mapped, static function (mixed $value) use (&$hasValue): void {
                if ($value !== '' && $value !== null && $value !== []) {
                    $hasValue = true;
                }
            });
            if ($hasValue) {
                $result[] = $mapped;
            }
        }
        return $result;
    }
}
