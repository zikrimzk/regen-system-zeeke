<?php
declare(strict_types=1);

namespace ReGen;

final class ResumeTemplate
{
    /** @param array<string, mixed> $resume */
    public static function buildHtml(array $resume): string
    {
        $resume = Sanitizer::sanitizeResume($resume);
        foreach(['education','experience'] as $key)$resume[$key]=ResumeWriting::orderedEntries($resume[$key],$resume['writing']['dateOrder']);
        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        $parts = [];

        $headerPersonal = $personal;
        if (!TemplateCatalog::get($resume['templateId'])['photo']) unset($headerPersonal['photoBase64']);
        $parts[] = self::documentHeader($headerPersonal, $resume['templateId'], $resume['appearance']);

        $sectionStart = count($parts);
        if (($resume['summary'] ?? '') !== '') {
            $parts[] = self::sectionHeader($resume['writing']['profileType']==='objective'?'OBJECTIVE':'SUMMARY', $resume['templateId']);
            $parts[] = '<p class="cv-summary">' . nl2br(self::wrapText($resume['summary'])) . '</p>';
        }
        $sections['summary'] = array_splice($parts, $sectionStart);

        $sectionStart = count($parts);
        if (!empty($resume['education'])) {
            $parts[] = self::sectionHeader('EDUCATION', $resume['templateId']);
            foreach ($resume['education'] as $entry) {
                $school = implode(', ', array_filter([$entry['institution'] ?? '', $entry['location'] ?? ''], static fn(string $text): bool => $text !== ''));
                $result = ($entry['cgpa'] ?? '') === '' ? '' : self::academicResultLabel($entry) . ': ' . $entry['cgpa'];
                $parts[] = self::entry(
                    $resume['templateId'],
                    '<strong>' . self::wrapText($entry['degree'] ?? '') . '</strong>',
                    self::dateRange($entry['startDate'] ?? '', $entry['endDate'] ?? ''),
                    self::wrapText(implode(' · ', array_filter([$school, $result], static fn(string $text): bool => $text !== '')))
                );
            }
        }
        $sections['education'] = array_splice($parts, $sectionStart);

        $sectionStart = count($parts);
        if (!empty($resume['experience'])) {
            $parts[] = self::sectionHeader('WORK EXPERIENCE', $resume['templateId']);
            foreach ($resume['experience'] as $entry) {
                $sub = self::wrapText($entry['company'] ?? '');
                if (($entry['employmentType'] ?? '') !== '') {
                    $sub .= ' - ' . self::escape($entry['employmentType']);
                }
                if (($entry['location'] ?? '') !== '') {
                    $sub .= ', ' . self::escape($entry['location']);
                }
                $parts[] = self::entry(
                    $resume['templateId'],
                    '<strong>' . self::wrapText($entry['jobTitle'] ?? '') . '</strong>',
                    self::dateRange($entry['startDate'] ?? '', $entry['endDate'] ?? ''),
                    $sub,
                    '',
                    self::bulletList($entry['bullets'] ?? [])
                );
            }
        }
        $sections['experience'] = array_splice($parts, $sectionStart);

        $sectionStart = count($parts);
        if (!empty($resume['projects'])) {
            $parts[] = self::sectionHeader('PROJECTS', $resume['templateId']);
            foreach ($resume['projects'] as $project) {
                $title = self::wrapText($project['title'] ?? '');
                if (($project['type'] ?? '') !== '') $title .= ' <span class="cv-project-type">· '.self::wrapText($project['type']).'</span>';
                $parts[] = self::entry($resume['templateId'], $title, '', '', '', self::bulletList($project['bullets'] ?? []));

            }
        }
        $sections['projects'] = array_splice($parts, $sectionStart);

        $sectionStart = count($parts);
        if (!empty($resume['extracurricular'])) {
            $parts[] = self::sectionHeader('ACTIVITIES', $resume['templateId']);
            foreach ($resume['extracurricular'] as $activity) {
                $title = '<strong>' . self::wrapText($activity['organization'] ?? '') . '</strong>';
                if (($activity['role'] ?? '') !== '') {
                    $title .= ' - <span>' . self::escape($activity['role']) . '</span>';
                }
                $parts[] = self::entry(
                    $resume['templateId'],
                    $title,
                    '',
                    '',
                    '',
                    self::bulletList($activity['bullets'] ?? [])
                );
            }
        }
        $sections['extracurricular'] = array_splice($parts, $sectionStart);

        $skillRows = self::skillRows(is_array($resume['skills'] ?? null) ? $resume['skills'] : []);
        $sectionStart = count($parts);
        if ($skillRows !== []) {
            $parts[] = self::sectionHeader('SKILLS', $resume['templateId']);
            $skills = '<div class="cv-skills">';
            foreach ($skillRows as [$label, $value]) {
                $skills .= '<div class="cv-skill-row"><strong>' . self::wrapText($label) . ':</strong> ' . self::wrapText($value) . '</div>';
            }
            $parts[] = $skills . '</div>';
        }
        $sections['skills'] = array_splice($parts, $sectionStart);

        $sectionStart = count($parts);
        if (!empty($resume['achievements'])) {
            $parts[] = self::sectionHeader('ACHIEVEMENTS', $resume['templateId']);
            $parts[] = self::bulletList($resume['achievements']);
        }
        $sections['achievements'] = array_splice($parts, $sectionStart);

        $sectionStart = count($parts);
        if (!empty($resume['certifications'])) {
            $parts[] = self::sectionHeader('CERTIFICATIONS', $resume['templateId']);
            $parts[] = self::bulletList($resume['certifications']);
        }
        $sections['certifications'] = array_splice($parts, $sectionStart);

        $sections['additional']=[];
        foreach($resume['additional'] as $block){
            $items='';
            foreach($block['items'] as $item)$items.='<p class="cv-extra-item">'.self::wrapText($item).'</p>';
            $sections['additional'][]='<section class="cv-extra-section">'.self::sectionHeader($block['title'],$resume['templateId'],false).$items.'</section>';
        }

        $sectionStart = count($parts);
        if (!empty($resume['references'])) {
            $parts[] = self::sectionHeader('REFERENCES', $resume['templateId']);
            $parts[] = self::references($resume['references']);
        }
        $sections['references'] = array_splice($parts, $sectionStart);

        foreach ($resume['sectionOrder'] as $section) {
            $blocks = $sections[$section] ?? [];
            if ($blocks === []) continue;
            if($section==='additional'){$parts[]=implode("\n",$blocks);continue;}
            $heading = array_shift($blocks);
            $parts[] = '<div class="cv-section">' . '<div class="cv-section-body">' . $heading . implode("\n", $blocks) . '</div></div>';
        }
        $content = implode("\n", $parts);
        $css = TemplateCatalog::css($resume['templateId'], $resume['appearance']) . DocumentStyle::appearance($resume['templateId'], $resume['appearance'], true);
        return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume</title><style>' . $css . '</style></head><body><main class="cv-document">' . $content . '</main></body></html>';
    }

    /** @param array<string, mixed> $personal */
    public static function documentHeader(array $personal, string $templateId, array $appearance = []): string
    {
        $photo = '';
        $photoData = (string) ($personal['photoBase64'] ?? '');
        if (TemplateCatalog::get($templateId)['photo']) {
            $photoData = PortraitImage::crop($photoData, ($appearance['photoShape'] ?? '') === 'square', $appearance['photoFocus'] ?? 'top');
            if ($photoData !== '') $photo = '<img class="cv-photo" src="' . self::escape($photoData) . '" alt="Applicant portrait">';
        }
        $contacts = [[], []];
        foreach (['address','phone','email','linkedin','portfolio'] as $key) {
            $value = trim((string) ($personal[$key] ?? ''));
            if ($value === '') continue;
            $text = self::wrapText(in_array($key, ['linkedin','portfolio'], true) ? preg_replace('#^https?://(?:www\.)?#i', '', rtrim($value, '/')) : $value);
            $href = $key === 'email' && filter_var($value, FILTER_VALIDATE_EMAIL) ? 'mailto:' . $value : '';
            if (in_array($key,['linkedin','portfolio'],true)) {
                $url = preg_match('#^https?://#i', $value) ? $value : 'https://' . $value;
                if (filter_var($url, FILTER_VALIDATE_URL) && in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http','https'], true)) $href = $url;
            }
            $contacts[in_array($key, ['linkedin','portfolio'], true) ? 1 : 0][] = $href !== '' ? '<a href="' . self::escape($href) . '">' . $text . '</a>' : '<span>' . $text . '</span>';
        }
        $name = self::wrapText($personal['fullName'] ?? '') ?: 'Your Name';
        $length = mb_strlen($personal['fullName'] ?? '');
        $nameClass = $length > 45 ? ' name-extra-long' : ($length > 28 ? ' name-long' : '');
        $title = trim((string) ($personal['jobTitle'] ?? ''));
        $lines = '';
        foreach ($contacts as $line) if ($line !== []) $lines .= '<div class="cv-contact-line">'.implode('<span class="cv-contact-divider"> | </span>', $line).'</div>';
        $left = $photo !== '' && ($appearance['photoPosition'] ?? '') === 'left';
        $identity = '<div class="cv-header-identity"><h1 class="cv-name' . $nameClass . '">' . $name . '</h1>'
            . ($title !== '' ? '<p class="cv-title">' . self::wrapText($title) . '</p>' : '')
            . ($lines !== '' ? '<div class="cv-contact-lines">'.$lines.'</div>' : '') . '</div>';
        if ($photo === '') return '<div class="cv-header">'.$identity.'</div>';
        return '<div class="cv-header has-photo'.($left?' photo-left':'').'"><div class="cv-masthead">'
            .$identity.$photo.'</div></div>';
    }

    private static function wrapText(string $value): string
    {
        // CSS wraps long tokens without inserting invisible characters into parsed PDF text.
        return self::escape($value);
    }

    private static function sectionHeader(string $title, string $templateId, bool $standard=true): string
    {
        $label=$standard?ucwords(strtolower($title)):$title;
        return '<h2 class="sec-hdr"><span>' . self::escape($label) . '</span></h2>';
    }

    private static function entry(string $templateId, string $titleHtml, string $date, string $subtitle = '', string $detail = '', string $after = ''): string
    {
        $heading = $titleHtml !== '' ? '<h3 class="cv-entry-left">' . $titleHtml . '</h3>' : '';
        $heading = '<div class="cv-entry-heading'.($date === '' ? ' no-date' : '').'">'.$heading.($date !== '' ? '<span class="cv-entry-date">'.self::escape($date).'</span>' : '').'</div>';
        $meta = $subtitle !== '' ? '<p class="cv-entry-meta">'.$subtitle.'</p>' : '';
        $detailHtml = $detail !== '' ? '<p class="cv-entry-detail">' . $detail . '</p>' : '';
        return '<div class="cv-entry"><div class="cv-entry-top">' . $heading . $meta . $detailHtml . '</div>'
            . ($after !== '' ? '<div class="cv-entry-body">' . $after . '</div>' : '') . '</div>';
    }

    /** @param mixed $items */
    private static function bulletList(mixed $items): string
    {
        if (!is_array($items) || $items === []) {
            return '';
        }
        $html = '<ul class="bullets">';
        foreach ($items as $item) {
            $html .= '<li>' . nl2br(self::wrapText($item)) . '</li>';
        }
        return $html . '</ul>';
    }

    /** @param array<string, mixed> $skills
     *  @return list<array{0:string,1:string}>
     */
    private static function skillRows(array $skills): array
    {
        $rows = [
            ['Technical', (string) ($skills['technical'] ?? '')],
            ['Software', (string) ($skills['software'] ?? '')],
            ['Interpersonal', (string) ($skills['interpersonal'] ?? '')],
            ['Language', (string) ($skills['language'] ?? '')],
        ];
        foreach (is_array($skills['custom'] ?? null) ? $skills['custom'] : [] as $item) {
            $item = is_array($item) ? $item : [];
            if (($item['label'] ?? '') !== '' || ($item['value'] ?? '') !== '') {
                $rows[] = [
                    (string) (($item['label'] ?? '') ?: 'Other'),
                    (string) ($item['value'] ?? ''),
                ];
            }
        }
        return array_values(array_filter($rows, static fn (array $row): bool => $row[1] !== ''));
    }

    /** @param list<array<string, mixed>> $references */
    private static function references(array $references): string
    {
        $html = '<div class="cv-references">';
        foreach ($references as $reference) {
            $html .= '<div class="cv-reference"><div class="cv-ref-name">' . self::wrapText($reference['name'] ?? '') . '</div>';
            if (($reference['position'] ?? '') !== '') $html .= '<div class="cv-ref-pos">' . self::wrapText($reference['position']) . '</div>';
            $contacts = [];
            foreach (['email','phone'] as $field) if (($reference[$field] ?? '') !== '') $contacts[] = self::wrapText($reference[$field]);
            $html .= '<div class="cv-ref-contact">' . implode(' · ', $contacts) . '</div></div>';
        }
        return $html . '</div>';
    }

    private static function formatDate(mixed $value): string
    {
        $value = (string) $value;
        if (!preg_match('/^(\d{4})-(\d{2})$/', $value, $match)) {
            return $value;
        }
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $month = $months[((int) $match[2]) - 1] ?? '';
        return trim($month . ' ' . $match[1]);
    }

    private static function dateRange(mixed $start, mixed $end): string
    {
        $start = self::formatDate($start);
        $end = self::formatDate($end);
        if ($start === '' && $end === '') {
            return '';
        }
        return $start === '' ? $end : ($end === '' ? $start : $start . ' - ' . $end);
    }

    /** @param array<string, mixed> $entry */
    private static function academicResultLabel(array $entry): string
    {
        $value = trim((string) ($entry['cgpa'] ?? ''));
        $explicit = (string) ($entry['academicResultType'] ?? '');
        if ($explicit === 'grade') {
            return 'Grade';
        }
        if ($explicit === 'cgpa') {
            return 'CGPA';
        }
        return preg_match('/^[0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?$/', $value)
            ? 'CGPA'
            : 'Grade';
    }

    private static function escape(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
