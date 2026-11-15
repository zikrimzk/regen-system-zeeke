<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\CoverLetterRepository;
use ReGen\CoverLetterTemplate;
use ReGen\Http;
use ReGen\OpenAIServiceException;
use ReGen\RateLimiter;
use ReGen\ResumeTemplate;
use ReGen\Sanitizer;
use ReGen\Session;
use ReGen\TemplateCatalog;

trait DocumentActions
{
    private function coverLetters(string $path, string $method): never
    {
        $this->requireAuth();
        $resume = $this->resumes->getPrimaryByUser(Session::userId());
        if ($resume === null) Http::json(['success'=>false, 'message'=>'Create your resume before creating a cover letter.'], 409);
        $repo = new CoverLetterRepository($this->db);
        preg_match('#^/api/cover-letters/(\d+)(?:/(ai-suggest|preview|pdf|document))?$#', $path, $matches);
        $id = isset($matches[1]) ? (int) $matches[1] : null;
        $action = $matches[2] ?? '';
        $letter = $id === null ? null : $repo->get($id, Session::userId());
        if ($id !== null && ($letter === null || (int) $letter['resume_id'] !== (int) $resume['id'])) Http::json(['success'=>false, 'message'=>'Cover letter not found.'], 404);
        $template = TemplateCatalog::get($resume['resume_data']['templateId'] ?? 'classic');
        if ($method === 'GET' && $action === '' && $id === null) Http::json(['success'=>true, 'data'=>$repo->list(Session::userId()), 'template'=>$template, 'documentGeneration'=>\ReGen\DocumentWriteGuard::generation($this->db, Session::userId())]);
        if ($method === 'GET' && $action === '' && $id !== null) Http::json(['success'=>true, 'data'=>$letter, 'template'=>$template, 'documentGeneration'=>\ReGen\DocumentWriteGuard::generation($this->db, Session::userId())]);
        if ($method === 'DELETE' && $id !== null && $action === '') {
            $repo->delete($id, Session::userId());
            Http::json(['success'=>true]);
        }
        if ($method === 'GET' && in_array($action, ['preview', 'pdf', 'document'], true)) {
            $html = CoverLetterTemplate::buildHtml($resume['resume_data'], $letter);
            if ($action === 'preview') Http::redirect('/api/cover-letters/'.$id.'/document');
            $this->requireDocumentContacts($resume['resume_data']);
            if (trim((string) ($letter['body'] ?? '')) === '') Http::json(['success'=>false,'message'=>'Write your cover letter before downloading it.'], 422);
            if($action==='pdf')try{(new \ReGen\TemplateAccess($this->db))->assertExport(Session::userId(),$resume['resume_data']['templateId']??'classic');}catch(\ReGen\TemplateAccessDenied $error){$this->templateAccessError($error);}
            RateLimiter::enforce('pdf', (string) Session::userId(), 20, 60);
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            $output = $this->pdf->generateHtml($html,$action==='document'&&$this->previewNeedsWatermark());
            if($action==='pdf')$this->completeDocumentDownload($resume['resume_data']);else Http::completeSuccess();
            header('Content-Type: application/pdf');
            header('Content-Disposition: '.($action==='document'?'inline':'attachment').'; filename="'.\ReGen\ResumeWriting::filename($resume['resume_data'],'letter').'"');
            header('Content-Length: '.strlen($output));
            echo $output;
            exit;
        }
        if (($method === 'POST' && $id === null) || ($method === 'PUT' && $id !== null && $action === '')) {
            RateLimiter::enforce('letter-save', (string) Session::userId(), 60, 60);
            $incoming=Http::jsonBody();
            if($letter!==null)$incoming+=['letter_date'=>$letter['letter_date']??substr($letter['created_at'],0,10),'recipient_address'=>$letter['recipient_address']??''];
            try{$data = CoverLetterRepository::clean($incoming);}catch(\DomainException $error){Http::json(['success'=>false,'message'=>$error->getMessage()],422);}
            if ($data['company'] === '' || $data['role'] === '') Http::json(['success'=>false, 'message'=>'Company name and role are required.'], 422);
            $savedId = $repo->save($id, Session::userId(), (int) $resume['id'], $data);
            Http::json(['success'=>true, 'data'=>$repo->get($savedId, Session::userId())], $id === null ? 201 : 200);
        }
        if ($method === 'POST' && $action === 'ai-suggest') {
            RateLimiter::enforce('letter-ai', (string) Session::userId(), 4, 60);
            try{$data = CoverLetterRepository::clean(Http::jsonBody());}catch(\DomainException $error){Http::json(['success'=>false,'message'=>$error->getMessage()],422);}
            if ($data['company'] === '' || $data['role'] === '') Http::json(['success'=>false, 'message'=>'Enter the company and role before asking ReGen AI.'], 422);
            $context = $this->ats->safeAiContext($resume['resume_data']);
            $evidence = json_decode($context, true) ?: [];
            unset($evidence['targetRole'], $evidence['jobTitle'], $evidence['careerFocus'], $evidence['targetJobDescription'], $evidence['writing']);
            if (!$this->hasMeaningfulAiValue($evidence)) Http::json(['success'=>false, 'message'=>'Add experience, projects or skills to your resume first so ReGen AI has facts to use.'], 422);
            // ONLY PROFESSIONAL RESUME CONTEXT AND APPLICATION DETAILS REACH THE MODEL.
            unset($data['body'], $data['recipient'], $data['recipient_address'], $data['letter_date']);
            if ($this->containsSensitiveAiText(json_encode($data) ?: '', $resume['resume_data'])) Http::json(['success'=>false, 'message'=>'Remove personal contact details from the company notes or job description before using AI.'], 422);
            if (!$this->openai->enabled()) Http::json(['success'=>false, 'message'=>'ReGen AI is currently unavailable. You can still write and save your letter.'], 503);
            $reservation = $this->reserveAiRequest('cover_letter', Http::jsonBody()['expectedCost'] ?? null);
            if (!$reservation['allowed']) Http::json(['success'=>false, 'message'=>($reservation['enabled'] ?? true) === false ? 'ReGen AI is currently paused.' : $this->aiQuotaMessage($reservation), 'quota'=>$this->publicAiQuota($reservation)], ($reservation['enabled'] ?? true) === false ? 503 : 429);
            try {
                if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
                $suggestion = $this->openai->suggestCoverLetter($context, $data, Session::userId());
            } catch (\Throwable $error) {
                $this->refundAiRequest($reservation);
                Http::json(['success'=>false, 'message'=>$error instanceof OpenAIServiceException ? $error->getMessage() : 'ReGen AI is temporarily unavailable. Please try again.', 'quota'=>$this->aiQuota->status(Session::userId())], $error instanceof OpenAIServiceException ? $error->httpStatus() : 503);
            }
            $this->finalizeAiRequest($reservation);
            Http::json(['success'=>true, 'suggestion'=>$suggestion, 'quota'=>$this->aiQuota->status(Session::userId())]);
        }
        Http::json(['success'=>false, 'message'=>'Method not allowed.'], 405);
    }

    private function requireDocumentContacts(array $resume): void
    {
        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        if (trim((string) ($personal['fullName'] ?? '')) === ''
            || !filter_var((string) ($personal['email'] ?? ''), FILTER_VALIDATE_EMAIL)
            || trim((string) ($personal['phone'] ?? '')) === '') {
            Http::json(['success'=>false,'message'=>'Add your full name, a valid email and phone number in Personal before downloading.'], 422);
        }
    }

    private function generatePdf(int $id): never
    {
        RateLimiter::enforce('pdf', (string) Session::userId(), 20, 60);
        $row = $this->resumeOr404($id);
        $resume = Sanitizer::sanitizeResume($row['resume_data']);
        $this->requireDocumentContacts($resume);
        try{(new \ReGen\TemplateAccess($this->db))->assertExport(Session::userId(),$resume['templateId']??'classic');}catch(\ReGen\TemplateAccessDenied $error){$this->templateAccessError($error);}
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        $output = $this->pdf->generate($resume);
        $this->completeDocumentDownload($resume);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . \ReGen\ResumeWriting::filename($resume) . '"');
        header('Content-Length: ' . strlen($output));
        echo $output;
        exit;
    }

    private function previewDocument(int $id, bool $draft): never
    {
        RateLimiter::enforce('pdf-preview', (string) Session::userId(), 40, 60);
        $row = $this->resumeOr404($id);
        $resume = is_array($row['resume_data']) ? $row['resume_data'] : [];
        if ($draft) {
            $incoming = Http::jsonBody()['resumeData'] ?? null;
            if (!is_array($incoming)) Http::json(['success'=>false,'message'=>'Invalid preview data.'], 400);
            if(isset($incoming['templateId'])&&$incoming['templateId']!==($resume['templateId']??'classic'))Http::json(['success'=>false,'code'=>'TEMPLATE_NOT_APPLIED','message'=>'Apply an eligible template before previewing your resume in that design.'],403);
            $personal = array_replace($resume['personal'] ?? [], is_array($incoming['personal'] ?? null) ? $incoming['personal'] : []);
            // DRAFT PREVIEWS MAY USE ONLY THE USER'S VALIDATED, UPLOADED PHOTO.
            $personal['photoBase64'] = $resume['personal']['photoBase64'] ?? '';
            $personal['photoPath'] = '';
            $resume = array_replace($resume, $incoming);
            $resume['personal'] = $personal;
        }
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        $output = $this->pdf->generate($resume,$this->previewNeedsWatermark());
        Http::completeSuccess();
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="Resume.pdf"');
        header('Cache-Control: private, no-store');
        header('Content-Length: ' . strlen($output));
        echo $output;
        exit;
    }

    private function preview(int $id): never
    {
        $this->resumeOr404($id);
        Http::redirect('/api/pdf/'.$id.'/document');
    }

    private function previewDraft(int $id): never
    {
        $this->previewDocument($id,true);
    }

    private function previewNeedsWatermark(): bool
    {
        $price=(new \ReGen\FeaturePricing($this->db))->all(Session::userId())['pdf_download'];
        return $price['mode']!=='free'&&!$price['unlocked'];
    }

    private function completeDocumentDownload(array $resume): void
    {
        $this->db->beginTransaction();
        try {
            (new \ReGen\BonusCreditService($this->db))->lock(Session::userId());
            (new \ReGen\TemplateAccess($this->db))->assertExport(Session::userId(),$resume['templateId']??'classic');
            Http::completeSuccess();
            $this->db->commit();
        }catch(\ReGen\TemplateAccessDenied $error){if($this->db->inTransaction())$this->db->rollBack();$this->templateAccessError($error);}
        catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }
}
