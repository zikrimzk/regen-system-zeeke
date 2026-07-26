<?php
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use ReGen\PdfService;

$resume = [
    'personal' => [
        'fullName' => 'Nur Aisyah Binti Rahman',
        'jobTitle' => 'Junior Software Engineer',
        'phone' => '+60 12-345 6789',
        'email' => 'aisyah.rahman@example.com',
        'linkedin' => 'linkedin.com/in/aisyah-rahman',
        'address' => '43000, Selangor, Malaysia',
        'photoBase64' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ],
    'summary' => 'Detail-oriented software engineering graduate with hands-on experience building accessible web applications and automating business workflows. Comfortable collaborating across product and engineering teams.',
    'education' => [[
        'degree' => 'Bachelor of Computer Science (Software Engineering)',
        'institution' => 'Universiti Teknologi Malaysia',
        'location' => 'Johor Bahru, Johor, Malaysia',
        'cgpa' => '3.78 / 4.00',
        'academicResultType' => 'cgpa',
        'startDate' => '2021-09',
        'endDate' => '2025-06',
    ]],
    'experience' => [[
        'jobTitle' => 'Software Engineering Intern',
        'company' => 'Zeeke Digital Sdn. Bhd.',
        'employmentType' => 'Internship',
        'location' => 'Kuala Lumpur, Malaysia',
        'startDate' => '2024-03',
        'endDate' => '2024-08',
        'bullets' => [
            'Built responsive internal tools using JavaScript, Node.js and MySQL.',
            'Reduced repetitive data-entry work by creating validated import workflows.',
            'Worked with designers to improve mobile usability and accessibility.',
        ],
    ]],
    'projects' => [[
        'title' => 'ReGen Resume Builder',
        'type' => 'Final Year Project',
        'description' => 'A production-focused resume builder for Malaysian graduates.',
        'bullets' => [
            'Designed secure authentication and autosave flows.',
            'Implemented consistent A4 PDF rendering for user downloads.',
        ],
    ]],
    'extracurricular' => [[
        'organization' => 'Google Developer Student Club',
        'role' => 'Technical Committee',
        'bullets' => ['Facilitated two beginner web-development workshops for 80 students.'],
    ]],
    'skills' => [
        'interpersonal' => 'Communication, teamwork, problem solving',
        'software' => 'GitHub, Figma, Visual Studio Code',
        'technical' => 'PHP, JavaScript, MySQL, HTML, CSS',
        'language' => 'Malay (native), English (professional)',
        'custom' => [['label' => 'Cloud', 'value' => 'DirectAdmin, FTP deployment']],
    ],
    'achievements' => [
        'Dean’s List for four academic semesters.',
        'Top 10 finalist, National Student Innovation Challenge 2024.',
    ],
    'certifications' => [
        'Responsive Web Design — freeCodeCamp',
        'AWS Academy Cloud Foundations',
    ],
    'references' => [
        [
            'name' => 'Dr. Ahmad Firdaus',
            'position' => 'Senior Lecturer, UTM',
            'email' => 'ahmad.firdaus@example.edu.my',
            'phone' => '+60 7-555 0101',
        ],
        [
            'name' => 'Siti Hajar Ismail',
            'position' => 'Engineering Manager, Zeeke Digital',
            'email' => 'siti.hajar@example.com',
            'phone' => '+60 3-5555 0102',
        ],
    ],
];

$outputDirectory = dirname(__DIR__) . '/output/pdf';
if (!is_dir($outputDirectory) && !mkdir($outputDirectory, 0775, true) && !is_dir($outputDirectory)) {
    throw new RuntimeException('Could not create PDF output directory.');
}

$output = (new PdfService())->generate($resume);
$path = $outputDirectory . '/php-resume-smoke.pdf';
file_put_contents($path, $output);
echo $path . PHP_EOL;
