<?php
declare(strict_types=1);

namespace ReGen;

final class Sanitizer
{
    private const ALLOWED_SECTIONS = [
        'templateId', 'sectionOrder', 'appearance', 'documentSettings', 'personal', 'summary', 'education', 'experience', 'projects',
        'extracurricular', 'skills', 'achievements', 'certifications', 'references', 'writing', 'additional',
    ];

    public static function sectionOrder(mixed $value): array
    {
        $defaults = ['summary','experience','education','projects','skills','certifications','achievements','extracurricular','additional','references'];
        $ordered = is_array($value) ? array_values(array_unique(array_filter($value, static fn ($id) => is_string($id) && in_array($id, $defaults, true)))) : [];
        return array_merge($ordered, array_values(array_diff($defaults, $ordered)));
    }

    public static function isAllowedSection(string $section): bool
    {
        return in_array($section, self::ALLOWED_SECTIONS, true);
    }

    public static function appearance(mixed $value): array
    {
        $value = is_array($value) ? $value : [];
        $font = match ($value['font'] ?? 'template') {
            'arial','calibri','sans' => 'sans',
            'times','georgia','serif' => 'serif',
            'source','lato','garamond','baskerville' => $value['font'],
            default => 'template',
        };
        return [
            'font' => $font,
            'size' => in_array($value['size'] ?? '', ['10','10.5','11','11.5','12'], true) ? $value['size'] : '11',
            'spacing' => in_array($value['spacing'] ?? '', ['compact','balanced','comfortable'], true) ? $value['spacing'] : 'balanced',
            'color' => ($value['color'] ?? '') === 'accent' ? 'accent' : 'black',
            'margins' => in_array($value['margins'] ?? '', ['compact','balanced','generous'], true) ? $value['margins'] : 'balanced',
            'lineHeight' => in_array($value['lineHeight'] ?? '', ['template','1.25','1.3','1.35','1.45'], true) ? $value['lineHeight'] : 'template',
            'headingSize' => in_array($value['headingSize'] ?? '', ['template','11','12','13'], true) ? $value['headingSize'] : 'template',
            'nameSize' => in_array($value['nameSize'] ?? '', ['template','22','26','30'], true) ? $value['nameSize'] : 'template',
            'headingStyle' => in_array($value['headingStyle'] ?? '', ['template','title','uppercase'], true) ? $value['headingStyle'] : 'template',
            'dates' => ($value['dates'] ?? '') === 'inline' ? 'inline' : 'right',
            'photoShape' => ($value['photoShape'] ?? '') === 'square' ? 'square' : 'portrait',
            'photoPosition' => ($value['photoPosition'] ?? '') === 'left' ? 'left' : 'right',
            'photoFocus' => in_array($value['photoFocus'] ?? '', ['top','center','bottom'], true) ? $value['photoFocus'] : 'top',
        ];
    }

    public static function cleanText(mixed $value, bool $multiline = false, int $max = 5000): string
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
                '/^[\s>]*(?:[•●○◦▪▫■□‣⁃*]|[-\x{2013}\x{2014}]{1,2}|\d{1,3}[.)]|[a-zA-Z][.)])\s+/u',
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
        foreach (array_slice($value, 0, 50) as $item) {
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
            'templateId' => TemplateCatalog::get($data)['id'],
            'sectionOrder' => self::sectionOrder($data),
            'appearance' => self::appearance($data),
            'writing' => ResumeWriting::settings($data),
            'additional' => ResumeWriting::additional($data),
            'documentSettings' => [
                'sectionOrder' => self::sectionOrder(is_array($data) ? ($data['sectionOrder'] ?? []) : []),
                'appearance' => self::appearance(is_array($data) ? ($data['appearance'] ?? []) : []),
                'writing' => ResumeWriting::settings(is_array($data) ? ($data['writing'] ?? []) : []),
            ],
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
                // Fold legacy descriptions into the bullets without repeating exact matches.
                'bullets' => array_values(array_unique([
                    ...self::cleanBullets($item['bullets'] ?? []),
                    ...self::cleanBullets([$item['description'] ?? '']),
                ])),
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
            'templateId' => TemplateCatalog::get($source['templateId'] ?? 'classic')['id'],
            'showPhoto' => TemplateCatalog::get($source['templateId'] ?? 'classic')['photo'],
            'sectionOrder' => self::sectionOrder($source['sectionOrder'] ?? []),
            'appearance' => self::appearance($source['appearance'] ?? []),
            'writing' => ResumeWriting::settings($source['writing'] ?? []),
            'additional' => ResumeWriting::additional($source['additional'] ?? []),
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
            'portfolio' => self::cleanText($data['portfolio'] ?? '',false,300),
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
        foreach (array_slice(is_array($data['custom'] ?? null) ? $data['custom'] : [], 0, 20) as $item) {
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
        foreach (array_slice($data, 0, 50) as $entry) {
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
