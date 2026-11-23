<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\AtsService;
use ReGen\Config;
use ReGen\Http;
use ReGen\OpenAIServiceException;
use ReGen\RateLimiter;
use ReGen\ResumeAssistance;
use ReGen\Sanitizer;
use ReGen\Session;

trait AiActions
{
    private function aiStatus(): never
    {
        Http::json(['success' => true, ...$this->aiStatusPayload()]);
    }

    private function assistResumeSection(int $id): never
    {
        RateLimiter::enforce('ai-assist-user', (string) Session::userId(), 8, 60);
        RateLimiter::enforce('ai-assist-ip', RateLimiter::clientIdentity(), 24, 60);
        $row = $this->resumeOr404($id);
        $body = Http::jsonBody();
        $section = Sanitizer::cleanText($body['section'] ?? '', false, 50);
        try {
            $answers = ResumeAssistance::cleanAnswers($section, $body['answers'] ?? null);
        } catch (OpenAIServiceException $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], $error->httpStatus());
        }
        $target = [];
        foreach (['role', 'company', 'title', 'kind', 'category'] as $key) {
            $target[$key] = Sanitizer::cleanText(is_array($body['target'] ?? null) ? ($body['target'][$key] ?? '') : '', false, 180);
        }
        $format = is_array($body['target'] ?? null) ? ($body['target']['format'] ?? '') : '';
        $target['format'] = match ($section) {
            'summary' => 'paragraph', 'skills' => 'skills', 'projects' => $format === 'paragraph' ? 'paragraph' : 'bullets',
            'experience', 'extracurricular' => 'bullets', default => 'items',
        };
        $resume = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $privacySource = $resume;
        if ($section === 'additional_publications') unset($privacySource['personal']['fullName']);
        if ($this->containsSensitiveAiText(json_encode([$answers, $target], JSON_UNESCAPED_UNICODE) ?: '', $privacySource)) {
            Http::json(['success' => false, 'message' => 'Remove names, contact details and personal addresses from your notes before generating.'], 422);
        }
        if (!$this->openai->enabled()) Http::json(['success' => false, 'message' => 'ReGen AI is not configured yet.'], 503);
        $reservation = $this->reserveAiRequest('assist', $body['expectedCost'] ?? null);
        try {
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            $draft = $this->openai->assistSection($section, $answers, $target, $this->ats->safeAiContext($resume), Session::userId());
            $this->finalizeAiRequest($reservation);
        } catch (\Throwable $error) {
            $this->refundAiRequest($reservation);
            Http::json(['success' => false, 'message' => $error instanceof OpenAIServiceException ? $error->getMessage() : 'ReGen AI could not complete your draft. No Coin was charged. Please try again.', 'quota' => $this->aiQuota->status(Session::userId())], $error instanceof OpenAIServiceException ? $error->httpStatus() : 503);
        }
        Http::json(['success' => true, 'draft' => $draft, 'quota' => $this->aiQuota->status(Session::userId())]);
    }

    private function reserveAiRequest(string $operation, mixed $expectedCost = null): array
    {
        $reservation = $this->aiQuota->consume(Session::userId(), $operation);
        if(!empty($reservation['accessDenied']))$this->packageAccessError($reservation['price']);
        if (is_int($expectedCost) && isset($reservation['cost']) && $expectedCost !== $reservation['cost']) {
            $this->refundAiRequest($reservation);
            Http::json(['success' => false, 'message' => 'The Coin cost changed. Review the updated price and try again.', 'quota' => $this->aiQuota->status(Session::userId())], 409);
        }
        if (!$reservation['allowed']) {
            $disabled = ($reservation['enabled'] ?? true) === false;
            Http::json(['success' => false, 'message' => $disabled ? 'ReGen AI is currently paused.' : 'This action needs ' . ($reservation['cost'] ?? 1) . ' Coin. Check your balance in K-Store.', 'quota' => $this->publicAiQuota($reservation)], $disabled ? 503 : 429);
        }
        return $reservation;
    }

    private function suggestResumeSection(int $id): never
    {
        RateLimiter::enforce(
            'ai-suggest-user-minute',
            (string) Session::userId(),
            max(1, (int) Config::get('openai.suggest_user_minute_limit', 8)),
            60
        );
        RateLimiter::enforce(
            'ai-suggest-ip-minute',
            RateLimiter::clientIdentity(),
            max(1, (int) Config::get('openai.suggest_ip_minute_limit', 24)),
            60
        );
        $row = $this->resumeOr404($id);

        $body = Http::jsonBody();
        $section = Sanitizer::cleanText($body['section'] ?? '', false, 40);
        $supported = [
            'summary' => true,
            'experience' => true,
            'projects' => true,
            'extracurricular' => true,
            'skills' => true,
            'achievements' => true,
            'certifications' => true,
        ];

        if (!isset($supported[$section])) {
            Http::json([
                'success' => false,
                'message' => 'This resume section cannot use AI assistance.',
            ], 400);
        }
        $resumeData = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $sectionData = $this->sanitizeAiSectionData($section, $body['data'] ?? null);
        $encodedSection = json_encode(
            $sectionData,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
        );
        if (!is_string($encodedSection) || strlen($encodedSection) > self::AI_SECTION_MAX_BYTES) {
            Http::json([
                'success' => false,
                'message' => 'This section contains too much text for one AI request.',
            ], 413);
        }
        if ($this->containsSensitiveAiText($encodedSection, $resumeData)) {
            Http::json([
                'success' => false,
                'message' => 'Remove contact or personal details before asking ReGen AI.',
            ], 422);
        }
        $professionalContext = $this->ats->safeAiContext($resumeData);
        if (!$this->hasAiSectionEvidence($section, $sectionData, $professionalContext)) {
            Http::json([
                'success' => false,
                'message' => match ($section) {
                    'summary', 'skills' => 'Add professional experience, project details, achievements, certifications, or a few skills first so ReGen has evidence to use.',
                    default => 'Add a short rough note first so ReGen can improve your facts without guessing.',
                },
            ], 422);
        }
        if (!$this->openai->enabled()) {
            Http::json([
                'success' => false,
                'message' => 'ReGen AI is not configured yet.',
                'quota' => $this->publicAiQuota($this->aiQuota->status(Session::userId())),
            ], 503);
        }

        $previous = [];
        if (is_array($body['previousSuggestion'] ?? null)) {
            $previous = $this->sanitizePreviousAiSuggestion(
                $section,
                $body['previousSuggestion']
            );
            $previousJson = json_encode(
                $previous,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            if (
                !is_string($previousJson)
                || strlen($previousJson) > self::AI_PREVIOUS_MAX_BYTES
                || $this->containsSensitiveAiText($previousJson, $resumeData)
            ) {
                $previous = [];
            }
        }

        $reservation = $this->reserveAiRequest('refine', $body['expectedCost'] ?? null);
        if (!$reservation['allowed']) {
            $disabled = ($reservation['enabled'] ?? true) === false;
            Http::json([
                'success' => false,
                'message' => $disabled
                    ? 'ReGen AI is currently paused by an administrator.'
                    : $this->aiQuotaMessage($reservation),
                'quota' => $this->publicAiQuota($reservation),
            ], $disabled ? 503 : 429);
        }

        try {
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
            $suggestion = $this->openai->suggestSection(
                $section,
                $sectionData,
                $professionalContext,
                $previous,
                Session::userId()
            );
        } catch (OpenAIServiceException $error) {
            $this->refundAiRequest($reservation);
            $quota = $this->aiQuota->status(Session::userId());
            Http::json([
                'success' => false,
                'message' => $error->getMessage(),
                'quota' => $quota,
            ], $error->httpStatus());
        } catch (\Throwable $error) {
            $this->refundAiRequest($reservation);
            error_log('[ReGen AI] Unexpected section failure: ' . $error::class);
            Http::json([
                'success' => false,
                'message' => 'ReGen AI is temporarily unavailable. Please try again.',
                'quota' => $this->aiQuota->status(Session::userId()),
            ], 503);
        }

        $this->finalizeAiRequest($reservation);
        Http::json([
            'success' => true,
            'suggestion' => $suggestion,
            'quota' => $this->aiQuota->status(Session::userId()),
        ]);
    }

    private function atsReviewState(int $id): never
    {
        $row = $this->resumeOr404($id);
        $resume = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $review = $this->ats->analyze($resume);
        $stored = is_array($resume['_regenReview'] ?? null) ? $resume['_regenReview'] : [];
        $sourceHash = AtsService::fingerprint($resume);
        $isCurrent = isset($stored['sourceHash'], $stored['reviewVersion'])
            && (string) $stored['reviewVersion'] === self::ATS_REVIEW_VERSION
            && hash_equals((string) $stored['sourceHash'], $sourceHash);
        $savedComment = $isCurrent && (bool) ($stored['aiEnhanced'] ?? false)
            ? Sanitizer::cleanText($stored['comment'] ?? '', true, 420)
            : '';

        $review['comment'] = $review['summary'];
        $review['aiEnhanced'] = false;
        $review['isCurrent'] = $isCurrent;
        $review['hasPriorReview'] = $stored !== [];
        $review['hasSavedAiComment'] = $savedComment !== '';
        $review['savedComment'] = $savedComment;
        $review['reviewedAt'] = $isCurrent ? (string) ($stored['reviewedAt'] ?? '') : '';
        $review['reviewVersion'] = self::ATS_REVIEW_VERSION;

        Http::json([
            'success' => true,
            'review' => $review,
            'aiEnabled' => $this->openai->enabled()
                && (($this->aiQuota->status(Session::userId())['enabled'] ?? true) === true),
            'quota' => $this->aiQuota->status(Session::userId()),
        ]);
    }

    private function atsReview(int $id): never
    {
        $row = $this->resumeOr404($id);
        $resume = is_array($row['resume_data'] ?? null) ? $row['resume_data'] : [];
        $review = $this->ats->analyze($resume);
        $sourceHash = AtsService::fingerprint($resume);
        $stored = is_array($resume['_regenReview'] ?? null) ? $resume['_regenReview'] : [];
        $storedComment = Sanitizer::cleanText($stored['comment'] ?? '', true, 420);
        $storedIsCurrent = $storedComment !== ''
            && (bool) ($stored['aiEnhanced'] ?? false)
            && (string) ($stored['reviewVersion'] ?? '') === self::ATS_REVIEW_VERSION
            && isset($stored['sourceHash'])
            && hash_equals((string) $stored['sourceHash'], $sourceHash);

        if ($storedIsCurrent) {
            $review['comment'] = $storedComment;
            $review['aiEnhanced'] = true;
            $review['sourceHash'] = $sourceHash;
            $review['reviewedAt'] = (string) ($stored['reviewedAt'] ?? '');
            $review['reviewVersion'] = self::ATS_REVIEW_VERSION;
            Http::json([
                'success' => true,
                'review' => $review,
                'cached' => true,
                'usedAiRequest' => false,
                'aiEnabled' => $this->openai->enabled(),
                'generationFailed' => false,
                'quotaExceeded' => false,
                'quota' => $this->aiQuota->status(Session::userId()),
            ]);
        }

        RateLimiter::enforce('ats-review-minute', (string) Session::userId(), 4, 60);
        RateLimiter::enforce('ats-review-hour', (string) Session::userId(), 20, 3600);
        $cacheKey = hash(
            'sha256',
            $id . '|' . $sourceHash . '|' . self::ATS_REVIEW_VERSION
        );
        $cached = Session::cachedAtsComment($cacheKey);
        $aiEnhanced = false;
        $usedAiRequest = false;
        $generationFailed = false;
        $quotaExceeded = false;
        $quota = $this->aiQuota->status(Session::userId());
        $reservation = null;

        if ($cached !== null) {
            $review['comment'] = $cached;
            $aiEnhanced = true;
        } elseif ($this->openai->enabled() && (($quota['enabled'] ?? true) === true)) {
            $reservation = $this->aiQuota->consume(Session::userId(), 'review');
            $expectedCost = Http::jsonBody()['expectedCost'] ?? null;
            if (is_int($expectedCost) && isset($reservation['cost']) && $expectedCost !== $reservation['cost']) {
                $this->refundAiRequest($reservation);
                Http::json(['success' => false, 'message' => 'The AI allowance cost changed. Review the updated cost and generate again.', 'quota' => $this->aiQuota->status(Session::userId())], 409);
            }
            $quota = $this->publicAiQuota($reservation);
            if (!$reservation['allowed']) {
                $review['comment'] = $review['summary'];
                $generationFailed = true;
                $quotaExceeded = true;
            } else {
                $usedAiRequest = true;
                try {
                    $comment = $this->openai->atsComment(
                        $this->ats->safeAiContext($resume),
                        $review,
                        Session::userId()
                    );
                    $review['comment'] = $comment;
                    $aiEnhanced = true;
                } catch (OpenAIServiceException) {
                    $this->refundAiRequest($reservation);
                    $quota = $this->aiQuota->status(Session::userId());
                    $usedAiRequest = false;
                    $review['comment'] = $review['summary'];
                    $aiEnhanced = false;
                    $generationFailed = true;
                } catch (\Throwable $error) {
                    $this->refundAiRequest($reservation);
                    $quota = $this->aiQuota->status(Session::userId());
                    $usedAiRequest = false;
                    $review['comment'] = $review['summary'];
                    $aiEnhanced = false;
                    $generationFailed = true;
                    error_log('[ReGen AI] Unexpected ATS failure: ' . $error::class);
                }
            }
        } else {
            $review['comment'] = $review['summary'];
        }

        $review['aiEnhanced'] = $aiEnhanced;
        $storedReview = $review;
        $storedReview['sourceHash'] = $sourceHash;
        $storedReview['reviewedAt'] = gmdate(DATE_ATOM);
        $storedReview['reviewVersion'] = self::ATS_REVIEW_VERSION;
        try {
            $this->resumes->saveAtsReview($id, Session::userId(), $storedReview);
            if ($usedAiRequest && $aiEnhanced && is_array($reservation)) {
                $this->finalizeAiRequest($reservation);
                Session::cacheAtsComment($cacheKey, $storedReview['comment']);
                $quota = $this->aiQuota->status(Session::userId());
            }
        } catch (\Throwable $error) {
            if (is_array($reservation)) $this->refundAiRequest($reservation);
            throw $error;
        }
        Http::json([
            'success' => true,
            'review' => $storedReview,
            'cached' => $cached !== null,
            'usedAiRequest' => $usedAiRequest,
            'aiEnabled' => $this->openai->enabled(),
            'generationFailed' => $generationFailed,
            'quotaExceeded' => $quotaExceeded,
            'message' => $quotaExceeded ? $this->aiQuotaMessage($quota) : '',
            'quota' => $quota,
        ]);
    }

    /**
     * @param array<string, mixed> $resume
     */
    private function containsSensitiveAiText(string $text, array $resume): bool
    {
        $phoneText = preg_replace('/(?<!\d)(?:19|20)\d{2}(?:[-–](?:19|20)\d{2}|[-\/]\d{1,2}(?:[-\/]\d{1,2})?)(?!\d)/u', ' ', $text) ?? $text;
        if (
            preg_match('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u', $text)
            || preg_match('/(?<!\d)(?:\+?\d[\s().-]*){8,15}(?!\d)/u', $phoneText)
        ) {
            return true;
        }

        $personal = is_array($resume['personal'] ?? null) ? $resume['personal'] : [];
        foreach (['fullName', 'email', 'phone', 'linkedin', 'portfolio', 'address'] as $key) {
            $value = trim((string) ($personal[$key] ?? ''));
            if (mb_strlen($value) >= 5 && mb_stripos($text, $value) !== false) {
                return true;
            }
        }
        return false;
    }

    /** @return array<string, mixed> */
    private function aiStatusPayload(): array
    {
        $quota = $this->aiQuota->status(Session::userId());
        return [
            'enabled' => $this->openai->enabled() && (($quota['enabled'] ?? true) === true),
            'provider' => 'OpenAI',
            'privacy' => 'Contact details, locations, photos, and references are excluded. Professional resume content is sent to OpenAI only after an explicit AI request.',
            'requestUnit' => 'Package uses first, then base Coin, then bonus Coin. Failed AI actions are not charged.',
            'costs' => $this->aiQuota->costs(),
            'assistance' => ResumeAssistance::catalogue(),
            'quota' => $this->aiQuota->status(Session::userId()),
        ];
    }

    /** @param array<string, mixed> $quota */
    private function aiQuotaMessage(array $quota): string
    {
        return 'Insufficient Coin for this action. Check your base and saved balances in K-Store.';
    }

    /** @param array<string, mixed> $quota */
    private function refundAiRequest(array $quota): void
    {
        if (isset($quota['benefitReservation'])) { (new \ReGen\FeaturePricing($this->db))->settle([$quota['benefitReservation']],false); return; }
        try {
            $this->aiQuota->refund(
                Session::userId(),
                is_string($quota['windowStartedAt'] ?? null)
                    ? $quota['windowStartedAt']
                    : null,
                is_string($quota['reservationToken'] ?? null)
                    ? $quota['reservationToken']
                    : null
            );
        } catch (\Throwable $error) {
            error_log('[AI Quota] Request refund failed: ' . $error::class);
        }
    }

    /** @param array<string, mixed> $reservation */
    private function finalizeAiRequest(array $reservation): void
    {
        try {
            if (isset($reservation['benefitReservation'])) { (new \ReGen\FeaturePricing($this->db))->settle([$reservation['benefitReservation']],true); return; }
            $this->aiQuota->finalize(
                Session::userId(),
                is_string($reservation['windowStartedAt'] ?? null)
                    ? $reservation['windowStartedAt']
                    : null,
                is_string($reservation['reservationToken'] ?? null)
                    ? $reservation['reservationToken']
                    : null
            );
        } catch (\Throwable $error) {
            error_log('[AI Quota] Request finalization failed: ' . $error::class);
            $this->refundAiRequest($reservation);
            throw new OpenAIServiceException('The request could not be completed. No Coin was charged. Please try again.', 503);
        }
    }

    /**
     * @param array<string, mixed> $quota
     * @return array<string, mixed>
     */
    private function publicAiQuota(array $quota): array
    {
        return [
            'costs' => $quota['costs'] ?? $this->aiQuota->costs(),
            'reserved' => max(0, (int) ($quota['reserved'] ?? 0)),
            'limit' => max(0, (int) ($quota['limit'] ?? 0)),
            'used' => max(0, (int) ($quota['used'] ?? 0)),
            'remaining' => max(0, (int) ($quota['remaining'] ?? 0)),
            'baseRemaining' => max(0,(int)($quota['baseRemaining']??$quota['remaining']??0)),
            'bonusBalance' => max(0,(int)($quota['bonusBalance']??0)),
            'bonusRemaining' => max(0,(int)($quota['bonusRemaining']??0)),
            'windowStartedAt' => is_string($quota['windowStartedAt'] ?? null)
                ? $quota['windowStartedAt']
                : null,
            'resetAt' => is_string($quota['resetAt'] ?? null)
                ? $quota['resetAt']
                : null,
            'exhausted' => (bool) ($quota['exhausted'] ?? false),
            'enabled' => (bool) ($quota['enabled'] ?? true),
            'renewalHours' => max(1, (int) ($quota['renewalHours'] ?? 24)),
            'renewable' => (bool)($quota['renewable'] ?? true),
        ];
    }

    /** @param array<string, mixed> $value
     *  @return array<string, mixed>
     */
    private function sanitizePreviousAiSuggestion(string $section, array $value): array
    {
        $claimedSection = Sanitizer::cleanText($value['section'] ?? $section, false, 40);
        if ($claimedSection !== $section) {
            return [];
        }
        if ($section === 'summary') {
            return [
                'section' => $section,
                'summary' => Sanitizer::cleanText($value['summary'] ?? '', true, 1200),
            ];
        }
        if ($section === 'skills') {
            return [
                'section' => $section,
                'skills' => $this->sanitizeAiSectionData(
                    $section,
                    is_array($value['skills'] ?? null) ? $value['skills'] : []
                ),
            ];
        }
        $safe = $this->sanitizeAiSectionData($section, $value);
        return ['section' => $section, ...$safe];
    }

    /** @return array<string, mixed> */
    private function sanitizeAiSectionData(string $section, mixed $value): array
    {
        $data = is_array($value) ? $value : [];
        if ($section === 'summary') {
            return [
                'summary' => Sanitizer::cleanText($data['summary'] ?? '', true, 1200),
            ];
        }

        if (in_array($section, ['experience', 'projects', 'extracurricular'], true)) {
            $entries = [];
            $seenEntries = [];
            foreach (array_slice(is_array($data['entries'] ?? null) ? $data['entries'] : [], 0, 8) as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $index = max(0, min(50, (int) ($entry['index'] ?? count($entries))));
                if (isset($seenEntries[$index])) {
                    continue;
                }
                $seenEntries[$index] = true;
                $safe = ['index' => $index, 'bullets' => []];
                if ($section === 'experience') {
                    $safe['role'] = Sanitizer::cleanText($entry['role'] ?? '', false, 140);
                    $safe['company'] = Sanitizer::cleanText(
                        $entry['company'] ?? '',
                        false,
                        180
                    );
                    $safe['employmentType'] = Sanitizer::cleanText(
                        $entry['employmentType'] ?? '',
                        false,
                        80
                    );
                } elseif ($section === 'projects') {
                    $safe['title'] = Sanitizer::cleanText($entry['title'] ?? '', false, 160);
                    $safe['type'] = Sanitizer::cleanText($entry['type'] ?? '', false, 100);
                    $safe['description'] = Sanitizer::cleanText(
                        $entry['description'] ?? '',
                        true,
                        260
                    );
                } else {
                    $safe['role'] = Sanitizer::cleanText($entry['role'] ?? '', false, 140);
                    $safe['organization'] = Sanitizer::cleanText(
                        $entry['organization'] ?? '',
                        false,
                        180
                    );
                }

                $seenBullets = [];
                foreach (array_slice(is_array($entry['bullets'] ?? null) ? $entry['bullets'] : [], 0, 10) as $bullet) {
                    if (!is_array($bullet)) {
                        continue;
                    }
                    $bulletIndex = max(0, min(50, (int) ($bullet['index'] ?? count($safe['bullets']))));
                    $text = Sanitizer::cleanText($bullet['text'] ?? '', true, 320);
                    if ($text === '' || isset($seenBullets[$bulletIndex])) {
                        continue;
                    }
                    $seenBullets[$bulletIndex] = true;
                    $safe['bullets'][] = ['index' => $bulletIndex, 'text' => $text];
                }
                $hasProjectContext = $section === 'projects' && (
                    trim((string) ($safe['title'] ?? '')) !== ''
                    || trim((string) ($safe['type'] ?? '')) !== ''
                    || trim((string) ($safe['description'] ?? '')) !== ''
                );
                if ($safe['bullets'] !== [] || $hasProjectContext) {
                    $entries[] = $safe;
                }
            }
            return ['entries' => $entries];
        }

        if ($section === 'skills') {
            $custom = [];
            $seen = [];
            foreach (array_slice(is_array($data['custom'] ?? null) ? $data['custom'] : [], 0, 8) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $index = max(0, min(50, (int) ($item['index'] ?? count($custom))));
                if (isset($seen[$index])) {
                    continue;
                }
                $seen[$index] = true;
                $label = Sanitizer::cleanText($item['label'] ?? '', false, 80);
                $skillValue = Sanitizer::cleanText($item['value'] ?? '', false, 500);
                if ($label !== '' || $skillValue !== '') {
                    $custom[] = ['index' => $index, 'label' => $label, 'value' => $skillValue];
                }
            }
            return [
                'technical' => Sanitizer::cleanText($data['technical'] ?? '', false, 500),
                'software' => Sanitizer::cleanText($data['software'] ?? '', false, 500),
                'interpersonal' => Sanitizer::cleanText($data['interpersonal'] ?? '', false, 500),
                'language' => Sanitizer::cleanText($data['language'] ?? '', false, 500),
                'custom' => $custom,
            ];
        }

        $items = [];
        $seen = [];
        foreach (array_slice(is_array($data['items'] ?? null) ? $data['items'] : [], 0, 12) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $index = max(0, min(50, (int) ($item['index'] ?? count($items))));
            $text = Sanitizer::cleanText($item['text'] ?? '', true, 320);
            if ($text === '' || isset($seen[$index])) {
                continue;
            }
            $seen[$index] = true;
            $items[] = ['index' => $index, 'text' => $text];
        }
        return ['items' => $items];
    }

    /** @param array<string, mixed> $sectionData */
    private function hasAiSectionEvidence(
        string $section,
        array $sectionData,
        string $professionalContext,
    ): bool {
        if ($this->hasMeaningfulAiValue($sectionData)) {
            return true;
        }
        if (!in_array($section, ['summary', 'skills'], true)) {
            return false;
        }
        $decodedContext = json_decode($professionalContext, true);
        if(is_array($decodedContext))unset($decodedContext['targetRole'],$decodedContext['targetJobDescription'],$decodedContext['writing']);
        return $this->hasMeaningfulAiValue($decodedContext);
    }

    private function hasMeaningfulAiValue(mixed $value): bool
    {
        if (is_string($value)) {
            return mb_strlen(trim($value)) >= 2;
        }
        if (!is_array($value)) {
            return false;
        }
        foreach ($value as $item) {
            if ($this->hasMeaningfulAiValue($item)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param array<string, mixed> $resume
     */
    private function buildWritingContext(string $fieldType, mixed $localContext, array $resume): string
    {
        $allowedByField = [
            'summary' => [],
            'experience_bullet' => ['jobTitle', 'employmentType'],
            'project_description' => ['projectTitle', 'projectType'],
            'project_bullet' => ['projectTitle', 'projectType'],
            'extracurricular_bullet' => ['role'],
            'achievement' => [],
            'certification' => [],
            'skills_list' => ['skillCategory'],
        ];
        $local = is_array($localContext) ? $localContext : [];
        $safeLocal = [];
        foreach ($allowedByField[$fieldType] ?? [] as $key) {
            $value = Sanitizer::cleanText($local[$key] ?? '', false, 180);
            if ($value !== '') {
                $safeLocal[$key] = $value;
            }
        }

        $parts = [
            'Resume context (contact details, locations, personal information, and references excluded):',
            $this->ats->safeAiContext($resume),
        ];
        if ($safeLocal !== []) {
            $encoded = json_encode(
                $safeLocal,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            $parts[] = 'Current item context:';
            $parts[] = is_string($encoded) ? $encoded : '{}';
        }
        return mb_substr(implode("\n", $parts), 0, 14000);
    }

    /** @param array<string, mixed> $resume */
    private function hasSkillSuggestionEvidence(array $resume, string $draft): bool
    {
        if (mb_strlen(trim($draft)) >= 2) {
            return true;
        }
        $safe = Sanitizer::sanitizeResume($resume);
        $skills = is_array($safe['skills'] ?? null) ? $safe['skills'] : [];
        $sources = [
            $safe['summary'] ?? '',
            array_map(
                static fn (mixed $item): array => is_array($item)
                    ? ['bullets' => $item['bullets'] ?? []]
                    : [],
                is_array($safe['experience'] ?? null) ? $safe['experience'] : []
            ),
            array_map(
                static fn (mixed $item): array => is_array($item)
                    ? [
                        'description' => $item['description'] ?? '',
                        'bullets' => $item['bullets'] ?? [],
                    ]
                    : [],
                is_array($safe['projects'] ?? null) ? $safe['projects'] : []
            ),
            array_map(
                static fn (mixed $item): array => is_array($item)
                    ? ['bullets' => $item['bullets'] ?? []]
                    : [],
                is_array($safe['extracurricular'] ?? null) ? $safe['extracurricular'] : []
            ),
            $skills,
            $safe['achievements'] ?? [],
            $safe['certifications'] ?? [],
        ];
        $hasEvidence = false;
        array_walk_recursive($sources, static function (mixed $value) use (&$hasEvidence): void {
            if (!$hasEvidence && is_string($value) && mb_strlen(trim($value)) >= 2) {
                $hasEvidence = true;
            }
        });
        return $hasEvidence;
    }
}
