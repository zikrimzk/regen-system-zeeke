<?php
declare(strict_types=1);

namespace ReGen;

use PDO;
use PDOException;

final class Application
{
    private UserRepository $users;
    private ResumeRepository $resumes;
    private LookupService $lookups;
    private PdfService $pdf;

    public function __construct(
        private readonly PDO $db,
        private readonly string $projectRoot,
    ) {
        $this->users = new UserRepository($db);
        $this->resumes = new ResumeRepository($db);
        $this->lookups = new LookupService(sys_get_temp_dir() . '/regen-lookups');
        $this->pdf = new PdfService();
    }

    public function run(): never
    {
        Http::requireSameOriginForMutation();
        $method = Http::method();
        $path = Http::path();

        if ($method === 'GET' && $path === '/api/health') {
            $this->health();
        }
        if ($path === '/api/auth/login' && $method === 'POST') {
            $this->login();
        }
        if ($path === '/api/auth/register' && $method === 'POST') {
            $this->register();
        }
        if ($path === '/api/auth/logout' && $method === 'GET') {
            Session::destroy();
            Http::json(['success' => true]);
        }
        if ($path === '/api/auth/me' && $method === 'GET') {
            $this->me();
        }

        if (str_starts_with($path, '/api/')) {
            $this->requireAuth();
        }

        if ($path === '/api/dashboard' && $method === 'GET') {
            $this->listDashboard();
        }
        if ($path === '/api/dashboard' && $method === 'POST') {
            $this->createResume();
        }
        if (preg_match('#^/api/dashboard/(\d+)/title$#', $path, $matches) && $method === 'PATCH') {
            $this->renameResume((int) $matches[1]);
        }
        if (preg_match('#^/api/dashboard/(\d+)$#', $path) && $method === 'DELETE') {
            Http::json([
                'success' => false,
                'message' => 'Each account keeps one resume. Edit the existing resume instead of deleting it.',
            ], 405);
        }

        if (preg_match('#^/api/resume/(\d+)$#', $path, $matches) && $method === 'GET') {
            $this->getResume((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/section$#', $path, $matches) && $method === 'POST') {
            $this->saveSection((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/photo$#', $path, $matches) && $method === 'POST') {
            $this->uploadPhoto((int) $matches[1]);
        }
        if (preg_match('#^/api/resume/(\d+)/photo$#', $path, $matches) && $method === 'DELETE') {
            $this->deletePhoto((int) $matches[1]);
        }

        if (preg_match('#^/api/pdf/(\d+)/generate$#', $path, $matches) && $method === 'GET') {
            $this->generatePdf((int) $matches[1]);
        }
        if (preg_match('#^/api/pdf/(\d+)/preview$#', $path, $matches) && $method === 'GET') {
            $this->preview((int) $matches[1]);
        }
        if (preg_match('#^/api/pdf/(\d+)/preview-data$#', $path, $matches) && $method === 'POST') {
            $this->previewDraft((int) $matches[1]);
        }

        if ($path === '/api/lookups/institutions' && $method === 'GET') {
            Http::json([
                'success' => true,
                'results' => $this->lookups->institutions(
                    (string) ($_GET['q'] ?? ''),
                    (string) ($_GET['country'] ?? 'Malaysia')
                ),
            ]);
        }
        if ($path === '/api/lookups/locations' && $method === 'GET') {
            Http::json([
                'success' => true,
                'results' => $this->lookups->locations(
                    (string) ($_GET['q'] ?? ''),
                    (string) ($_GET['country'] ?? 'Worldwide')
                ),
            ]);
        }

        $this->servePage($path);
    }

    private function health(): never
    {
        try {
            $this->db->query('SELECT 1');
            Http::json(['success' => true, 'message' => 'ReGen API ready']);
        } catch (\Throwable) {
            Http::json(['success' => false, 'message' => 'Service unavailable'], 503);
        }
    }

    private function login(): never
    {
        RateLimiter::enforce('login', RateLimiter::clientIdentity(), 60, 900);
        $body = Http::jsonBody();
        $email = mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200));
        $password = (string) ($body['password'] ?? '');
        if ($email === '' || $password === '') {
            Http::json(['success' => false, 'message' => 'Email and password are required.'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::json(['success' => false, 'message' => 'Please enter a valid email address.'], 400);
        }
        $user = $this->users->findByEmail($email);
        if ($user === null || !$this->users->verifyPassword($password, $user)) {
            Http::json(['success' => false, 'message' => 'Invalid email or password.'], 401);
        }
        Session::establish($user);
        Http::json([
            'success' => true,
            'authenticated' => true,
            'user' => [
                'id' => (int) $user['id'],
                'firstName' => (string) $user['first_name'],
                'lastName' => (string) $user['last_name'],
                'email' => (string) $user['email'],
            ],
        ]);
    }

    private function register(): never
    {
        RateLimiter::enforce('register', RateLimiter::clientIdentity(), 30, 3600);
        $body = Http::jsonBody();
        $data = [
            'firstName' => Sanitizer::cleanText($body['firstName'] ?? '', false, 100),
            'lastName' => Sanitizer::cleanText($body['lastName'] ?? '', false, 100),
            'email' => mb_strtolower(Sanitizer::cleanText($body['email'] ?? '', false, 200)),
            'phone' => Sanitizer::cleanText($body['phone'] ?? '', false, 30),
            'address' => Sanitizer::cleanText($body['address'] ?? '', false, 500),
            'password' => (string) ($body['password'] ?? ''),
        ];
        $confirm = (string) ($body['confirmPassword'] ?? '');
        $errors = [];
        if (mb_strlen(trim($data['firstName'])) < 2) {
            $errors[] = 'First name must be at least 2 characters.';
        }
        if (mb_strlen(trim($data['lastName'])) < 2) {
            $errors[] = 'Last name must be at least 2 characters.';
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Please enter a valid email address.';
        }
        if (strlen($data['password']) < 8) {
            $errors[] = 'Password must be at least 8 characters.';
        }
        if ($data['password'] !== $confirm) {
            $errors[] = 'Passwords do not match.';
        }
        if ($errors !== []) {
            Http::json(['success' => false, 'errors' => $errors], 400);
        }
        if ($this->users->emailExists($data['email'])) {
            Http::json([
                'success' => false,
                'message' => 'This email is already registered. Please log in.',
            ], 409);
        }
        try {
            $user = $this->users->create($data);
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') {
                Http::json([
                    'success' => false,
                    'message' => 'This email is already registered. Please log in.',
                ], 409);
            }
            throw $error;
        }
        Session::establish($user);
        Http::json(['success' => true, 'authenticated' => true, 'user' => $user], 201);
    }

    private function me(): never
    {
        $this->requireAuth();
        $user = $this->users->findById(Session::userId());
        if ($user === null) {
            Session::destroy();
            Http::json(['success' => false, 'message' => 'Session expired.'], 401);
        }
        Http::json([
            'success' => true,
            'user' => $user,
            'userName' => (string) ($_SESSION['userName'] ?? ''),
        ]);
    }

    private function listDashboard(): never
    {
        $primary = $this->resumes->getPrimaryByUser(Session::userId());
        $personal = is_array($primary['resume_data']['personal'] ?? null)
            ? $primary['resume_data']['personal']
            : [];
        Http::json([
            'success' => true,
            'data' => $this->resumes->getSummariesByUser(Session::userId()),
            'profilePhotoBase64' => (string) ($personal['photoBase64'] ?? ''),
            'profile' => $primary === null ? null : self::buildProfile($primary),
        ]);
    }

    private function createResume(): never
    {
        $user = $this->users->findById(Session::userId());
        if ($user === null) {
            Session::destroy();
            Http::json(['success' => false, 'message' => 'Session expired.'], 401);
        }
        $title = Sanitizer::cleanText(Http::jsonBody()['title'] ?? '', false, 200) ?: 'Untitled Resume';
        $resume = $this->resumes->getOrCreatePrimary(Session::userId(), $user, $title);
        Http::json(
            ['success' => true, 'data' => $resume],
            !empty($resume['existing']) ? 200 : 201
        );
    }

    private function renameResume(int $id): never
    {
        if ($id < 1) {
            Http::json(['success' => false, 'message' => 'Invalid resume ID.'], 400);
        }
        $title = Sanitizer::cleanText(Http::jsonBody()['title'] ?? '', false, 200);
        if ($title === '') {
            Http::json(['success' => false, 'message' => 'Title is required.'], 400);
        }
        if ($this->resumes->getById($id, Session::userId()) === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        $this->resumes->updateTitle($id, Session::userId(), $title);
        Http::json(['success' => true]);
    }

    private function getResume(int $id): never
    {
        $row = $this->resumeOr404($id);
        Http::json([
            'success' => true,
            'data' => $row['resume_data'],
            'title' => (string) $row['title'],
        ]);
    }

    private function saveSection(int $id): never
    {
        RateLimiter::enforce('resume-save', (string) Session::userId(), 180, 60);
        $this->resumeOr404($id);
        $body = Http::jsonBody();
        $section = (string) ($body['section'] ?? '');
        if (!Sanitizer::isAllowedSection($section)) {
            Http::json(['success' => false, 'message' => 'Invalid section.'], 400);
        }
        $rawData = $body['data'] ?? null;
        $encoded = json_encode($rawData);
        if (is_string($encoded) && strlen($encoded) > 6 * 1024 * 1024) {
            Http::json(['success' => false, 'message' => 'Resume section is too large.'], 413);
        }
        $data = Sanitizer::sanitizeSection($section, $rawData);
        if ($section === 'personal' && is_array($data)) {
            unset($data['photoPath'], $data['photoBase64']);
            $ok = $this->resumes->savePersonal($id, Session::userId(), $data);
        } else {
            $ok = $this->resumes->saveSection($id, Session::userId(), $section, $data);
        }
        if (!$ok && $this->resumes->getById($id, Session::userId()) === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        Http::json(['success' => true]);
    }

    private function uploadPhoto(int $id): never
    {
        $this->resumeOr404($id);
        $upload = $_FILES['photo'] ?? null;
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            Http::json(['success' => false, 'message' => 'No file uploaded.'], 400);
        }
        $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            Http::json(['success' => false, 'message' => 'Photo must be smaller than 5MB.'], 413);
        }
        if ($error !== UPLOAD_ERR_OK) {
            Http::json(['success' => false, 'message' => 'Photo upload could not be processed.'], 400);
        }
        $size = (int) ($upload['size'] ?? 0);
        $tmp = (string) ($upload['tmp_name'] ?? '');
        if ($size < 12 || $size > 5 * 1024 * 1024 || !is_uploaded_file($tmp)) {
            Http::json([
                'success' => false,
                'message' => $size > 5 * 1024 * 1024
                    ? 'Photo must be smaller than 5MB.'
                    : 'Only valid JPG and PNG photos are accepted.',
            ], $size > 5 * 1024 * 1024 ? 413 : 400);
        }
        $bytes = file_get_contents($tmp);
        if (!is_string($bytes)) {
            Http::json(['success' => false, 'message' => 'Photo upload failed.'], 500);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $validJpeg = $mime === 'image/jpeg' && str_starts_with($bytes, "\xFF\xD8");
        $validPng = $mime === 'image/png' && str_starts_with($bytes, "\x89PNG\r\n\x1A\n");
        if (!$validJpeg && !$validPng) {
            Http::json(['success' => false, 'message' => 'Only valid JPG and PNG photos are accepted.'], 400);
        }
        $base64 = 'data:' . $mime . ';base64,' . base64_encode($bytes);
        $this->resumes->updatePhoto($id, Session::userId(), $base64);
        Http::json(['success' => true, 'photoBase64' => $base64]);
    }

    private function deletePhoto(int $id): never
    {
        $this->resumeOr404($id);
        $this->resumes->updatePhoto($id, Session::userId(), '');
        Http::json(['success' => true]);
    }

    private function generatePdf(int $id): never
    {
        RateLimiter::enforce('pdf', (string) Session::userId(), 20, 60);
        $row = $this->resumeOr404($id);
        $resume = Sanitizer::sanitizeResume($row['resume_data']);
        $output = $this->pdf->generate($resume);
        $name = preg_replace('/[^a-z0-9_\- ]/i', '', (string) ($resume['personal']['fullName'] ?? $row['title']));
        $name = trim((string) preg_replace('/\s+/', '_', (string) $name)) ?: 'Resume';
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $name . '_Resume.pdf"');
        header('Content-Length: ' . strlen($output));
        echo $output;
        exit;
    }

    private function preview(int $id): never
    {
        $row = $this->resumeOr404($id);
        Http::html(ResumeTemplate::buildHtml($row['resume_data']));
    }

    private function previewDraft(int $id): never
    {
        $row = $this->resumeOr404($id);
        $incoming = Http::jsonBody()['resumeData'] ?? null;
        if (!is_array($incoming)) {
            Http::html('<p>Preview data is invalid.</p>', 400);
        }
        $stored = is_array($row['resume_data']) ? $row['resume_data'] : [];
        $merged = array_replace($stored, $incoming);
        $storedPersonal = is_array($stored['personal'] ?? null) ? $stored['personal'] : [];
        $incomingPersonal = is_array($incoming['personal'] ?? null) ? $incoming['personal'] : [];
        $merged['personal'] = array_replace($storedPersonal, $incomingPersonal);
        Http::html(ResumeTemplate::buildHtml($merged));
    }

    private function requireAuth(): void
    {
        if (!Session::authenticated()) {
            Http::json(['success' => false, 'message' => 'Not authenticated.'], 401);
        }
    }

    /** @return array<string, mixed> */
    private function resumeOr404(int $id): array
    {
        if ($id < 1) {
            Http::json(['success' => false, 'message' => 'Invalid resume ID.'], 400);
        }
        $row = $this->resumes->getById($id, Session::userId());
        if ($row === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        return $row;
    }

    private function servePage(string $path): never
    {
        if ($path === '/') {
            Http::redirect(Session::authenticated() ? '/dashboard' : '/login');
        }
        $pages = [
            '/login' => ['login.html', false],
            '/register' => ['register.html', false],
            '/dashboard' => ['dashboard.html', true],
            '/builder' => ['builder.html', true],
        ];
        if (!isset($pages[$path])) {
            if (str_starts_with($path, '/api/')) {
                Http::json(['success' => false, 'message' => 'Not found'], 404);
            }
            Http::html('<h1>404</h1><p>Page not found.</p>', 404);
        }
        [$file, $protected] = $pages[$path];
        if ($protected && !Session::authenticated()) {
            Http::redirect('/login');
        }
        if (!$protected && Session::authenticated()) {
            Http::redirect('/dashboard');
        }
        $pathToFile = $this->projectRoot . '/public/' . $file;
        if (!is_file($pathToFile)) {
            $pathToFile = $this->projectRoot . '/' . $file;
        }
        if (!is_file($pathToFile)) {
            Http::html('<h1>500</h1><p>Page template is missing.</p>', 500);
        }
        Http::html((string) file_get_contents($pathToFile));
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private static function buildProfile(array $row): array
    {
        $data = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $personal = is_array($data['personal'] ?? null) ? $data['personal'] : [];
        $contactFields = ['fullName', 'jobTitle', 'email', 'phone', 'address'];
        $contactCount = count(array_filter(
            $contactFields,
            static fn (string $key): bool => trim((string) ($personal[$key] ?? '')) !== ''
        ));
        $hasSummary = trim((string) ($data['summary'] ?? '')) !== '';
        $hasEducation = is_array($data['education'] ?? null) && $data['education'] !== [];
        $hasExperience = is_array($data['experience'] ?? null) && $data['experience'] !== [];
        $hasProjects = is_array($data['projects'] ?? null) && $data['projects'] !== [];
        $skills = is_array($data['skills'] ?? null) ? $data['skills'] : [];
        $hasSkills = false;
        foreach (['technical', 'software', 'interpersonal', 'language'] as $key) {
            $hasSkills = $hasSkills || trim((string) ($skills[$key] ?? '')) !== '';
        }
        if (!$hasSkills && is_array($skills['custom'] ?? null)) {
            foreach ($skills['custom'] as $item) {
                if (is_array($item) && (
                    trim((string) ($item['label'] ?? '')) !== ''
                    || trim((string) ($item['value'] ?? '')) !== ''
                )) {
                    $hasSkills = true;
                    break;
                }
            }
        }
        $completion = (int) round(
            ($contactCount / count($contactFields)) * 40
            + ($hasSummary ? 15 : 0)
            + ($hasEducation ? 15 : 0)
            + (($hasExperience || $hasProjects) ? 15 : 0)
            + ($hasSkills ? 15 : 0)
        );
        $definitions = [
            ['personal', 'Personal information', $contactCount === count($contactFields), false],
            ['summary', 'Professional summary', $hasSummary, false],
            ['education', 'Education', $hasEducation, false],
            ['experience', 'Work experience', $hasExperience, true],
            ['projects', 'Projects', $hasProjects, true],
            ['extracurricular', 'Activities', is_array($data['extracurricular'] ?? null) && $data['extracurricular'] !== [], true],
            ['skills', 'Skills', $hasSkills, false],
            ['achievements', 'Achievements', is_array($data['achievements'] ?? null) && $data['achievements'] !== [], true],
            ['certifications', 'Certifications', is_array($data['certifications'] ?? null) && $data['certifications'] !== [], true],
            ['references', 'References', is_array($data['references'] ?? null) && $data['references'] !== [], true],
        ];
        $sections = [];
        $nextSection = 'personal';
        $foundNext = false;
        foreach ($definitions as [$id, $label, $complete, $optional]) {
            $sections[] = compact('id', 'label', 'complete', 'optional');
            if (!$foundNext && !$optional && !$complete) {
                $nextSection = $id;
                $foundNext = true;
            }
        }
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'updatedAt' => $row['updated_at'],
            'completion' => $completion,
            'nextSection' => $nextSection,
            'sections' => $sections,
            'personal' => [
                'fullName' => (string) ($personal['fullName'] ?? ''),
                'jobTitle' => (string) ($personal['jobTitle'] ?? ''),
                'email' => (string) ($personal['email'] ?? ''),
                'phone' => (string) ($personal['phone'] ?? ''),
                'address' => (string) ($personal['address'] ?? ''),
            ],
        ];
    }
}
