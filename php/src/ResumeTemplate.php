<?php
declare(strict_types=1);

namespace ReGen;

final class ResumeTemplate
{
    /** @param array<string, mixed> $resume */
    public static function buildHtml(array $resume): string
    {
        $resume = Sanitizer::sanitizeResume($resume);
        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        $parts = [];

        $parts[] = self::header($personal);

        if (($resume['summary'] ?? '') !== '') {
            $parts[] = self::sectionHeader('SUMMARY');
            $parts[] = '<p class="cv-summary">' . nl2br(self::escape($resume['summary'])) . '</p>';
        }

        if (!empty($resume['education'])) {
            $parts[] = self::sectionHeader('EDUCATION');
            foreach ($resume['education'] as $entry) {
                $parts[] = self::entry(
                    '<strong>' . self::escape($entry['degree'] ?? '') . '</strong>',
                    self::dateRange($entry['startDate'] ?? '', $entry['endDate'] ?? ''),
                    self::escape($entry['institution'] ?? '')
                        . (($entry['location'] ?? '') !== '' ? ', ' . self::escape($entry['location']) : ''),
                    ($entry['cgpa'] ?? '') !== ''
                        ? self::academicResultLabel($entry) . ': ' . self::escape($entry['cgpa'])
                        : ''
                );
            }
        }

        if (!empty($resume['experience'])) {
            $parts[] = self::sectionHeader('WORK EXPERIENCE');
            foreach ($resume['experience'] as $entry) {
                $sub = self::escape($entry['company'] ?? '');
                if (($entry['employmentType'] ?? '') !== '') {
                    $sub .= ' - ' . self::escape($entry['employmentType']);
                }
                if (($entry['location'] ?? '') !== '') {
                    $sub .= ', ' . self::escape($entry['location']);
                }
                $parts[] = self::entry(
                    '<strong>' . self::escape($entry['jobTitle'] ?? '') . '</strong>',
                    self::dateRange($entry['startDate'] ?? '', $entry['endDate'] ?? ''),
                    $sub,
                    '',
                    self::bulletList($entry['bullets'] ?? [])
                );
            }
        }

        if (!empty($resume['projects'])) {
            $parts[] = self::sectionHeader('ACADEMIC PROJECTS');
            foreach ($resume['projects'] as $project) {
                $content = '<div class="cv-entry">';
                if (($project['type'] ?? '') !== '') {
                    $content .= '<div class="cv-entry-type">' . self::escape($project['type']) . '</div>';
                }
                $content .= '<div><strong>Title: ' . self::escape($project['title'] ?? '') . '</strong></div>';
                if (($project['description'] ?? '') !== '') {
                    $content .= '<div class="cv-entry-sub italic">'
                        . nl2br(self::escape($project['description']))
                        . '</div>';
                }
                $content .= self::bulletList($project['bullets'] ?? []) . '</div>';
                $parts[] = $content;
            }
        }

        if (!empty($resume['extracurricular'])) {
            $parts[] = self::sectionHeader('EXTRACURRICULAR ACTIVITIES');
            foreach ($resume['extracurricular'] as $activity) {
                $title = '<strong>' . self::escape($activity['organization'] ?? '') . '</strong>';
                if (($activity['role'] ?? '') !== '') {
                    $title .= ' - <em>' . self::escape($activity['role']) . '</em>';
                }
                $parts[] = self::entry(
                    $title,
                    '',
                    '',
                    '',
                    self::bulletList($activity['bullets'] ?? [])
                );
            }
        }

        $skillRows = self::skillRows(is_array($resume['skills'] ?? null) ? $resume['skills'] : []);
        if ($skillRows !== []) {
            $parts[] = self::sectionHeader('SKILLS');
            $skills = '<table class="cv-skills">';
            foreach ($skillRows as [$label, $value]) {
                $skills .= '<tr>'
                    . '<td class="cv-sk-label">' . self::escape($label) . '</td>'
                    . '<td class="cv-sk-sep">:</td>'
                    . '<td class="cv-sk-val">' . self::escape($value) . '</td>'
                    . '</tr>';
            }
            $parts[] = $skills . '</table>';
        }

        if (!empty($resume['achievements'])) {
            $parts[] = self::sectionHeader('ACHIEVEMENT');
            $parts[] = self::bulletList($resume['achievements']);
        }

        if (!empty($resume['certifications'])) {
            $parts[] = self::sectionHeader('LICENSE & CERTIFICATION');
            $parts[] = self::bulletList($resume['certifications']);
        }

        if (!empty($resume['references'])) {
            $parts[] = self::sectionHeader('REFERENCES');
            $parts[] = self::references($resume['references']);
        }

        $content = implode("\n", $parts);
        return '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=800">
<title>Resume</title>
<style>
@page {
  margin-top: 18mm;
  margin-right: 18mm;
  margin-bottom: 16mm;
  margin-left: 18mm;
}
* { box-sizing: border-box; }
body, div, p, table, tr, td, ul, li, hr {
  margin: 0;
  padding: 0;
}
html { background: #fff; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.8pt;
  color: #000;
  background: #fff;
  padding: 0;
  line-height: 1.42;
  width: auto;
  margin: 0;
  overflow: visible;
}
@media screen {
  body {
    width: 800px;
    margin: 0 auto;
    padding: 18mm 18mm 16mm 18mm;
    overflow-x: hidden;
  }
}
.cv-header-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
  page-break-inside: avoid;
}
.cv-header-info { vertical-align: top; }
.cv-photo-cell {
  width: 104px;
  padding-left: 16px;
  text-align: right;
  vertical-align: top;
}
.cv-photo {
  width: 88px;
  height: 115px;
  object-fit: cover;
  object-position: center top;
  border: 1px solid #555;
}
.cv-name { font-size: 19pt; font-weight: 700; margin-bottom: 3px; }
.cv-title { font-size: 11.5pt; font-weight: 700; margin-bottom: 8px; }
.cv-contacts { border-collapse: collapse; margin-top: 6px; width: 100%; }
.cv-contacts td { font-size: 10.5pt; line-height: 1.55; vertical-align: top; }
.cv-cl { width: 100px; white-space: nowrap; }
.cv-cs { width: 22px; text-align: center; }
.cv-cv { word-break: break-word; }
.sec-hdr {
  margin: 12px 0 4px;
  page-break-after: avoid;
  page-break-inside: avoid;
}
.sec-hdr span { font-size: 11pt; font-weight: 700; }
.sec-hdr hr { border: 0; border-top: 1px solid #000; margin: 2px 0 0; height: 1px; }
.cv-entry {
  margin-bottom: 9px;
  page-break-inside: avoid;
}
.cv-entry-row { width: 100%; border-collapse: collapse; }
.cv-entry-left { vertical-align: baseline; }
.cv-entry-date {
  width: 150px;
  padding-left: 8px;
  text-align: right;
  vertical-align: baseline;
  font-weight: 700;
  font-size: 10pt;
  white-space: nowrap;
}
.cv-entry-sub { font-size: 10.5pt; margin-top: 1px; }
.cv-entry-type { font-weight: 700; font-size: 10.5pt; }
.cv-entry-detail { font-size: 10.5pt; color: #222; }
.italic { font-style: italic; }
.bullets {
  margin: 4px 0 0 18px;
  padding-left: 0;
  font-size: 10.5pt;
  page-break-inside: avoid;
}
.bullets li { margin-bottom: 2px; page-break-inside: avoid; }
.cv-summary { font-size: 10.8pt; line-height: 1.48; page-break-inside: avoid; }
.cv-skills {
  width: 100%;
  border-collapse: collapse;
  page-break-inside: avoid;
}
.cv-skills td { font-size: 11pt; vertical-align: top; padding-bottom: 2px; }
.cv-sk-label { width: 115px; font-weight: 700; }
.cv-sk-sep { width: 22px; text-align: center; }
.cv-ref-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
.cv-ref-card { width: 50%; vertical-align: top; padding-right: 20px; padding-bottom: 8px; }
.cv-ref-name { font-weight: 700; font-size: 11pt; text-transform: uppercase; }
.cv-ref-pos, .cv-ref-contact { font-size: 10.5pt; }
</style>
</head>
<body>' . $content . '</body>
</html>';
    }

    /** @param array<string, mixed> $personal */
    private static function header(array $personal): string
    {
        $photo = '';
        $photoData = (string) ($personal['photoBase64'] ?? '');
        if (preg_match('#^data:image/(?:png|jpe?g);base64,[a-zA-Z0-9+/=\r\n]+$#', $photoData)) {
            $photo = '<td class="cv-photo-cell"><img class="cv-photo" src="'
                . self::escape($photoData)
                . '" alt="Photo"></td>';
        }

        $rows = '';
        foreach ([
            'Phone Number' => $personal['phone'] ?? '',
            'Email' => $personal['email'] ?? '',
            'LinkedIn' => $personal['linkedin'] ?? '',
            'Location' => $personal['address'] ?? '',
        ] as $label => $value) {
            if ($value === '') {
                continue;
            }
            $rows .= '<tr><td class="cv-cl">' . $label . '</td>'
                . '<td class="cv-cs">:</td>'
                . '<td class="cv-cv">' . self::escape($value) . '</td></tr>';
        }

        $name = self::escape($personal['fullName'] ?? '') ?: 'Your Name';
        $title = ($personal['jobTitle'] ?? '') !== ''
            ? '<div class="cv-title">' . self::escape($personal['jobTitle']) . '</div>'
            : '';

        return '<table class="cv-header-table"><tr>'
            . '<td class="cv-header-info"><div class="cv-name">' . $name . '</div>'
            . $title
            . '<table class="cv-contacts">' . $rows . '</table></td>'
            . $photo
            . '</tr></table>';
    }

    private static function sectionHeader(string $title): string
    {
        return '<div class="sec-hdr"><span>' . self::escape($title) . '</span><hr></div>';
    }

    private static function entry(
        string $titleHtml,
        string $date,
        string $subtitle = '',
        string $detail = '',
        string $after = ''
    ): string {
        $dateCell = $date !== ''
            ? '<td class="cv-entry-date">&nbsp;&nbsp;' . self::escape($date) . '</td>'
            : '';
        return '<div class="cv-entry">'
            . '<table class="cv-entry-row"><tr><td class="cv-entry-left">'
            . $titleHtml
            . '</td>' . $dateCell . '</tr>'
            . '</table>'
            . ($subtitle !== '' ? '<div class="cv-entry-sub">' . $subtitle . '</div>' : '')
            . ($detail !== '' ? '<div class="cv-entry-detail">' . $detail . '</div>' : '')
            . $after
            . '</div>';
    }

    /** @param mixed $items */
    private static function bulletList(mixed $items): string
    {
        if (!is_array($items) || $items === []) {
            return '';
        }
        $html = '<ul class="bullets">';
        foreach ($items as $item) {
            $html .= '<li>' . nl2br(self::escape($item)) . '</li>';
        }
        return $html . '</ul>';
    }

    /** @param array<string, mixed> $skills
     *  @return list<array{0:string,1:string}>
     */
    private static function skillRows(array $skills): array
    {
        $rows = [
            ['Interpersonal', (string) ($skills['interpersonal'] ?? '')],
            ['Software', (string) ($skills['software'] ?? '')],
            ['Technical', (string) ($skills['technical'] ?? '')],
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
        $html = '<table class="cv-ref-table">';
        foreach (array_chunk($references, 2) as $pair) {
            $html .= '<tr>';
            foreach ($pair as $reference) {
                $html .= '<td class="cv-ref-card">'
                    . '<div class="cv-ref-name">'
                    . self::escape(($reference['name'] ?? '') ?: 'Reference')
                    . '</div>'
                    . (($reference['position'] ?? '') !== ''
                        ? '<div class="cv-ref-pos">' . self::escape($reference['position']) . '</div>'
                        : '')
                    . (($reference['email'] ?? '') !== ''
                        ? '<div class="cv-ref-contact">' . self::escape($reference['email']) . '</div>'
                        : '')
                    . (($reference['phone'] ?? '') !== ''
                        ? '<div class="cv-ref-contact">' . self::escape($reference['phone']) . '</div>'
                        : '')
                    . '</td>';
            }
            if (count($pair) === 1) {
                $html .= '<td class="cv-ref-card"></td>';
            }
            $html .= '</tr>';
        }
        return $html . '</table>';
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
        return $end === '' ? $start : $start . ' - ' . $end;
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
