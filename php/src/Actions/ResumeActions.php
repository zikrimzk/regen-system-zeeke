<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\Http;
use ReGen\RateLimiter;
use ReGen\Sanitizer;
use ReGen\Session;
use ReGen\TemplateCatalog;

trait ResumeActions
{
    private function listDashboard(): never
    {
        $primary = $this->resumes->getPrimaryByUser(Session::userId());
        Http::json([
            'success' => true,
            'data' => $this->resumes->getSummariesByUser(Session::userId()),
            'profile' => $primary === null ? null : $this->buildProfile($primary),
            'ai' => $this->aiStatusPayload(),
            'coverLetterCount' => (new \ReGen\CoverLetterRepository($this->db))->count(Session::userId()),
        ]);
    }

    private function createResume(): never
    {
        $user = $this->users->findById(Session::userId());
        if ($user === null) {
            Session::destroy();
            Http::json(['success' => false, 'message' => 'Session expired.'], 401);
        }
        $body = Http::jsonBody();
        if ($this->resumes->getPrimaryByUser(Session::userId()) === null && !(new \ReGen\TemplateManagement($this->db))->selectable($body['templateId'] ?? null)) {
            Http::json(['success'=>false,'message'=>'Choose an available resume template first.'],422);
        }
        if (!TemplateCatalog::valid($body['templateId'] ?? null) && $this->resumes->getPrimaryByUser(Session::userId()) === null) {
            Http::json(['success'=>false, 'message'=>'Choose a resume template first.'], 422);
        }
        $title = Sanitizer::cleanText($body['title'] ?? '', false, 200) ?: 'My Resume';
        try { $resume = $this->resumes->getOrCreatePrimary(Session::userId(), $user, $title, TemplateCatalog::get($body['templateId'] ?? 'classic')['id']); }
        catch (\ReGen\TemplateAccessDenied $error) { $this->templateAccessError($error); }
        catch (\DomainException $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],422); }
        if (empty($resume['existing'])) {
            $templateId = TemplateCatalog::get($body['templateId'] ?? 'classic')['id'];
            $this->resumes->saveSection((int) $resume['id'], Session::userId(), 'templateId', $templateId);
            $resume['resumeData']['templateId'] = $templateId;
        }
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
            'documentGeneration' => \ReGen\DocumentWriteGuard::generation($this->db, Session::userId()),
        ]);
    }

    private function saveSection(int $id): never
    {
        RateLimiter::enforce('resume-save', (string) Session::userId(), 180, 60);
        $row=$this->resumeOr404($id);
        $body = Http::jsonBody();
        $section = (string) ($body['section'] ?? '');
        $featureKey = match($section) { 'documentSettings'=>'document_settings', default=>null };
        if($featureKey)$this->enforceTokenAccess(Http::path(),Http::method(),[$featureKey]);
        if ($featureKey !== null) {
            $feature=(new \ReGen\FeaturePolicy($this->db))->all()[$featureKey];
            if (!$feature['available']) Http::json(['success'=>false,'code'=>'FEATURE_UNAVAILABLE','message'=>$feature['message'] ?: $feature['name'].' is temporarily unavailable.'],503);
        }
        if (!Sanitizer::isAllowedSection($section)) {
            Http::json(['success' => false, 'message' => 'Invalid section.'], 400);
        }
        $rawData = $body['data'] ?? null;
        if($section==='documentSettings'&&is_array($rawData)&&!array_key_exists('writing',$rawData))$rawData['writing']=$row['resume_data']['writing']??[];
        if ($section === 'templateId' && !TemplateCatalog::valid($rawData)) Http::json(['success'=>false, 'message'=>'Choose a valid template.'], 422);
        if ($section === 'templateId' && !(new \ReGen\TemplateManagement($this->db))->selectable($rawData)) Http::json(['success'=>false,'message'=>'This template is no longer available for selection. Choose another design.'],422);
        $encoded = json_encode($rawData);
        if (is_string($encoded) && strlen($encoded) > 512 * 1024) {
            Http::json(['success' => false, 'message' => 'Resume section is too large.'], 413);
        }
        $data = Sanitizer::sanitizeSection($section, $rawData);
        if ($section === 'personal' && is_array($data)) {
            unset($data['photoPath'], $data['photoBase64']);
            $ok = $this->resumes->savePersonal($id, Session::userId(), $data);
        } else {
            try { $ok = $this->resumes->saveSection($id, Session::userId(), $section, $data); }
            catch (\ReGen\TemplateAccessDenied $error) { $this->templateAccessError($error); }
            catch (\DomainException $error) { Http::json(['success'=>false,'message'=>$error->getMessage()],422); }
        }
        if (!$ok && $this->resumes->getById($id, Session::userId()) === null) {
            Http::json(['success' => false, 'message' => 'Resume not found.'], 404);
        }
        Http::json(['success' => true]);
    }

    private function uploadPhoto(int $id): never
    {
        RateLimiter::enforce('photo-upload-user-minute', (string) Session::userId(), 6, 60);
        RateLimiter::enforce('photo-upload-ip-minute', RateLimiter::clientIdentity(), 20, 60);
        $this->resumeOr404($id);
        $upload = $_FILES['photo'] ?? null;
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            Http::json(['success' => false, 'message' => 'No file uploaded.'], 400);
        }
        $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            Http::json(['success' => false, 'message' => 'Photo must be smaller than 1.5MB.'], 413);
        }
        if ($error !== UPLOAD_ERR_OK) {
            Http::json(['success' => false, 'message' => 'Photo upload could not be processed.'], 400);
        }
        $size = (int) ($upload['size'] ?? 0);
        $tmp = (string) ($upload['tmp_name'] ?? '');
        if ($size < 12 || $size > 1536 * 1024 || !is_uploaded_file($tmp)) {
            Http::json([
                'success' => false,
                'message' => $size > 1536 * 1024
                    ? 'Photo must be smaller than 1.5MB.'
                    : 'Only valid JPG and PNG photos are accepted.',
            ], $size > 1536 * 1024 ? 413 : 400);
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
        $dimensions = @getimagesizefromstring($bytes);
        if (
            !is_array($dimensions)
            || (int) ($dimensions[0] ?? 0) < 1
            || (int) ($dimensions[1] ?? 0) < 1
            || (int) ($dimensions[0] ?? 0) > 6000
            || (int) ($dimensions[1] ?? 0) > 6000
            || ((int) $dimensions[0] * (int) $dimensions[1]) > 20000000
        ) {
            Http::json([
                'success' => false,
                'message' => 'Photo dimensions are invalid or too large.',
            ], 400);
        }
        try{$photo=\ReGen\PortraitImage::upload($bytes);}
        catch(\DomainException $error){Http::json(['success'=>false,'message'=>$error->getMessage()],422);}
        $this->resumes->updatePhoto($id,Session::userId(),$photo['photoBase64']);
        Http::json(['success'=>true,...$photo]);
    }

    private function deletePhoto(int $id): never
    {
        $this->resumeOr404($id);
        $this->resumes->updatePhoto($id, Session::userId(), '');
        Http::json(['success' => true]);
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
}
