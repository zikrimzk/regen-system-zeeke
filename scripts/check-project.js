const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const javascriptFiles = [
  path.join(root, 'server.js'),
  ...walk(path.join(root, 'app')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'public', 'js')).filter(file => file.endsWith('.js')),
];

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
  }
}

const personal = fs.readFileSync(path.join(root, 'public/js/sections/personal.js'), 'utf8');
const stepper = fs.readFileSync(path.join(root, 'public/js/stepper.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'public/js/dashboard.js'), 'utf8');
const previewClient = fs.readFileSync(path.join(root, 'public/js/preview.js'), 'utf8');
const previewProtection = fs.readFileSync(path.join(root, 'public/js/preview-protection.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'public/js/auth.js'), 'utf8');
const builderApp = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
const apiClient = fs.readFileSync(path.join(root, 'public/js/api.js'), 'utf8');
const skillsSection = fs.readFileSync(path.join(root, 'public/js/sections/skills.js'), 'utf8');
const publicIndex = fs.readFileSync(path.join(root, 'public/index.php'), 'utf8');
const phpApplication = fs.readFileSync(path.join(root, 'php/src/Application.php'), 'utf8');
const phpConfig = fs.readFileSync(path.join(root, 'php/src/Config.php'), 'utf8');
const resumeTemplate = fs.readFileSync(path.join(root, 'php/src/ResumeTemplate.php'), 'utf8');
const googleIdentity = fs.readFileSync(path.join(root, 'php/src/GoogleIdentityService.php'), 'utf8');
const recaptchaService = fs.readFileSync(path.join(root, 'php/src/RecaptchaService.php'), 'utf8');
const emailVerificationService = fs.readFileSync(path.join(root, 'php/src/EmailVerificationService.php'), 'utf8');
const userRepository = fs.readFileSync(path.join(root, 'php/src/UserRepository.php'), 'utf8');
const openAIService = fs.readFileSync(path.join(root, 'php/src/OpenAIService.php'), 'utf8');
const aiQuotaService = fs.readFileSync(path.join(root, 'php/src/AiQuotaService.php'), 'utf8');
const atsService = fs.readFileSync(path.join(root, 'php/src/AtsService.php'), 'utf8');
const phpConfigExample = fs.readFileSync(path.join(root, 'php/config.local.example.php'), 'utf8');
const http = fs.readFileSync(path.join(root, 'php/src/Http.php'), 'utf8');
const session = fs.readFileSync(path.join(root, 'php/src/Session.php'), 'utf8');
const aiEnhance = fs.readFileSync(path.join(root, 'public/js/ai-enhance.js'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
const publicFiles = walk(path.join(root, 'public'))
  .filter(file => /\.(?:html|js|css)$/.test(file))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');
const publicHtml = walk(path.join(root, 'public'))
  .filter(file => file.endsWith('.html'))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');
const faviconIco = fs.readFileSync(path.join(root, 'public/favicon.ico'));

if (personal.includes('id="p-city"') || personal.includes('id="p-address-line"')) {
  failures.push('Personal information still renders city or street-address fields.');
}
if (!personal.includes('[postcode, state, country]')) {
  failures.push('Personal address is not composed from postcode, state, and country.');
}
const previewDataBlock = stepper.match(/function getCurrentPreviewData[\s\S]*?\n  }\n/)?.[0] || '';
if (previewDataBlock.includes('sanitizeFields(')) {
  failures.push('Live preview still rewrites active form fields.');
}
for (const control of ['open-resume-preview', 'download-resume', 'dashboard-preview-modal']) {
  if (!dashboard.includes(control)) failures.push(`Dashboard document control missing: ${control}`);
}
if (
  dashboard.includes('open-resume-preview-secondary')
  || dashboard.includes('download-resume-secondary')
  || dashboard.includes('dashboard-zoom-out')
) {
  failures.push('Dashboard repeats document actions or restores the mobile-hostile zoom toolbar.');
}
if (!auth.includes('let countryInput = null;') || !auth.includes('validateRegistrationPostcode = function')) {
  failures.push('Registration location fields are not available to the submit handler.');
}
if (
  !auth.includes('/api/auth/google/config')
  || !auth.includes('https://accounts.google.com/gsi/client')
  || !publicFiles.includes('id="google-auth"')
) {
  failures.push('Google Identity Services is not wired into the authentication pages.');
}
if (
  !phpApplication.includes("'/api/auth/google'")
  || !phpApplication.includes("!($method === 'POST' && $path === '/api/auth/google')")
  || !googleIdentity.includes('AccessToken')
  || !googleIdentity.includes("'audience' => $this->clientId")
  || !googleIdentity.includes('validCsrfToken')
) {
  failures.push('Server-side Google credential verification is incomplete.');
}
if (
  !phpApplication.includes("'/api/auth/recaptcha/config'")
  || !phpApplication.includes('verifyRegistrationRecaptcha')
  || !phpApplication.includes('RecaptchaService::requiredForEnvironment')
  || !recaptchaService.includes('https://www.google.com/recaptcha/api/siteverify')
  || !recaptchaService.includes('hash_equals($expectedAction, $action)')
  || !recaptchaService.includes("$payload['challenge_ts']")
  || !recaptchaService.includes("$payload['hostname']")
  || !recaptchaService.includes('RESULT_UNAVAILABLE')
  || !recaptchaService.includes('CURLOPT_PROTOCOLS => CURLPROTO_HTTPS')
  || !recaptchaService.includes("!str_starts_with($normalized, 'replace-with-')")
  || !apiClient.includes('getRecaptchaConfig')
  || !auth.includes('window.grecaptcha.execute')
  || !auth.includes("getRecaptcha('register')")
  || !publicHtml.includes('id="register-recaptcha-status"')
  || !http.includes('https://www.google.com/recaptcha/')
  || !http.includes('https://www.gstatic.com/recaptcha/')
  || !envExample.includes('RECAPTCHA_SITE_KEY=')
  || !envExample.includes('RECAPTCHA_SECRET_KEY=')
) {
  failures.push('Server-verified, CSP-compatible reCAPTCHA authentication protection is incomplete.');
}
if (
  !phpApplication.includes("'/api/auth/email-verification/verify'")
  || !phpApplication.includes("'/api/auth/email-verification/resend'")
  || !phpApplication.includes("'EMAIL_NOT_VERIFIED'")
  || !phpApplication.includes("'/verify-email' => ['verify-email.html', false]")
  || !emailVerificationService.includes('random_bytes(self::TOKEN_BYTES)')
  || !emailVerificationService.includes("hash('sha256', $token, true)")
  || !emailVerificationService.includes("'/verify-email#token='")
  || !userRepository.includes('LIMIT 1 FOR UPDATE')
  || !userRepository.includes('email_verified_at = UTC_TIMESTAMP(3)')
  || !schema.includes('CREATE TABLE IF NOT EXISTS email_verification_tokens')
  || !schema.includes('token_hash     BINARY(32)')
  || !apiClient.includes('/api/auth/email-verification/verify')
  || !auth.includes("getRecaptcha('login')")
  || !publicFiles.includes('id="email-verification"')
) {
  failures.push('Single-use email verification or login reCAPTCHA wiring is incomplete.');
}
if (
  !phpApplication.includes("'/api/ai/status'")
  || !phpApplication.includes('/ai-suggest$#')
  || !phpApplication.includes('$this->openai->suggestSection')
  || !openAIService.includes('https://api.openai.com/v1/responses')
  || !openAIService.includes('Authorization: Bearer')
  || !openAIService.includes("'store' => false")
  || !openAIService.includes("'type' => 'json_schema'")
  || !openAIService.includes('gpt-5.4-mini')
  || !phpConfigExample.includes("'OPENAI_MODEL' => 'gpt-5.4-mini'")
  || !openAIService.includes("$payload['safety_identifier']")
  || !openAIService.includes('safetyIdentifier($userId)')
  || !openAIService.includes('Never invent metrics')
  || !openAIService.includes('keyword stuffing')
  || !aiEnhance.includes('Use Suggestions')
  || aiEnhance.includes('Use all suggestions')
  || !aiEnhance.includes('previousSuggestion')
  || !aiEnhance.includes('Improve this section')
  || publicFiles.includes('data-ai-kind=')
) {
  failures.push('OpenAI section-level resume assistance is not fully wired through the secure server-side flow.');
}
if (
  !aiEnhance.includes("section === 'skills'")
  || !openAIService.includes('For every suggested skill, return a short exact evidence quote')
  || !openAIService.includes('$groundedSkill')
  || !openAIService.includes('normalizeSkillList')
  || !openAIService.includes('skillIsGrounded')
  || !openAIService.includes('skillEvidenceIsGrounded')
  || !openAIService.includes('contextEvidenceValues')
  || !openAIService.includes('inferredSkillSupportedByQuote')
  || !aiEnhance.includes('#sk-lang')
) {
  failures.push('Evidence-grounded ReGen assistance is not fully wired into the Skills section.');
}
if (
  !phpApplication.includes('AI_SECTION_MAX_BYTES')
  || !phpApplication.includes('AI_PREVIOUS_MAX_BYTES')
  || !phpApplication.includes('strlen($encodedSection)')
  || !phpApplication.includes('sanitizePreviousAiSuggestion')
  || !phpApplication.includes("catch (\\Throwable $error)")
) {
  failures.push('AI input byte limits, prior-suggestion sanitization, or failure refunds are incomplete.');
}
if (
  !aiEnhance.includes("company: clean(value('.exp-company'")
  || !phpApplication.includes("$safe['company']")
  || !atsService.includes("'company' => Sanitizer::cleanText")
  || !openAIService.includes('Use supplied employer, organization, role, project, skill, and technology names as context anchors')
) {
  failures.push('Employer and organization context is not carried through the evidence-grounded AI flow.');
}
if (
  !phpApplication.includes('/ats-review$#')
  || !phpApplication.includes('safeAiContext')
  || !atsService.includes('Measurable impact')
  || !openAIService.includes('Personal details, locations, contact information, photos, and references are intentionally excluded')
) {
  failures.push('ReGen AI ATS review and privacy-safe context are incomplete.');
}
if (
  !phpApplication.includes("&& $method === 'GET'")
  || !phpApplication.includes('ATS_REVIEW_VERSION')
  || !apiClient.includes('getAtsReviewState')
  || !apiClient.includes('generateAtsReview')
  || !builderApp.includes('loadAtsReviewState();')
  || builderApp.includes('\n      loadAtsReview();')
  || !builderApp.includes('Generate ReGen comment')
  || !builderApp.includes('View saved comment')
) {
  failures.push('ATS comments must be loaded from saved/local state and generated only after an explicit click.');
}
if (
  !http.includes('Content-Security-Policy')
  || !http.includes('display-capture=()')
  || !http.includes('requireCsrfToken')
  || !session.includes('csrfToken')
  || !session.includes('session_regenerate_id')
) {
  failures.push('Session, CSRF, or content-security hardening is incomplete.');
}
if (
  resumeTemplate.includes('<script')
  || !previewProtection.includes('sanitizeHtml')
  || !previewProtection.includes("iframe.setAttribute('sandbox', 'allow-same-origin')")
  || !previewProtection.includes("blockedPointerEvents = ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart']")
  || !previewClient.includes('PreviewProtection.loadUrl')
  || !dashboard.includes('PreviewProtection.loadUrl')
  || !builderApp.includes('PreviewProtection.loadUrl')
  || faviconIco.length < 4
  || !faviconIco.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))
  || !fs.existsSync(path.join(root, 'public/favicon.svg'))
  || !phpApplication.includes("$path === '/favicon.ico'")
  || !phpApplication.includes("Http::redirect('/favicon.svg', 308)")
) {
  failures.push('CSP-safe preview rendering, best-effort preview protection, or favicon assets are incomplete.');
}
if (/on(?:click|change|input|submit|load|error)\s*=/i.test(publicHtml)) {
  failures.push('Inline script handlers remain and weaken the content-security policy.');
}
if (/OPENAI_API_KEY\s*[:=]\s*['"][^'"]{12,}/.test(publicFiles)) {
  failures.push('An OpenAI API key appears to be exposed in a public asset.');
}
if (
  fs.existsSync(path.join(root, 'php/src/GeminiService.php'))
  || fs.existsSync(path.join(root, 'php/src/GeminiServiceException.php'))
  || /gemini/i.test(openAIService + phpApplication + aiEnhance)
) {
  failures.push('Legacy Gemini integration files or references remain.');
}
if (
  !phpApplication.includes('$this->aiQuota->consume')
  || !aiQuotaService.includes('DAILY_LIMIT = 15')
  || !aiQuotaService.includes('FOR UPDATE')
  || !aiQuotaService.includes('public function refund')
  || !aiQuotaService.includes('public function finalize')
  || !aiQuotaService.includes('reservation_token')
  || !aiQuotaService.includes('window_started_at = ? AND request_count > 0')
  || !phpApplication.includes('refundAiRequest')
  || !phpApplication.includes('finalizeAiRequest')
  || !phpApplication.includes('publicAiQuota')
  || !schema.includes('CREATE TABLE IF NOT EXISTS ai_usage_windows')
  || !schema.includes('CREATE TABLE IF NOT EXISTS ai_usage_reservations')
  || !dashboard.includes('renderAiTokens')
  || !phpConfig.includes('$developmentMode ? 100 : 15')
  || !phpConfig.includes('$developmentMode ? 120 : 8')
  || !phpConfig.includes('$developmentMode ? 240 : 24')
  || !phpConfig.includes("$read('NODE_ENV', 'production')")
) {
  failures.push('The configured rolling AI limit, burst controls, or same-window failure refund are incomplete.');
}
if (
  !aiEnhance.includes('const quotaExhausted = result.quota')
  || !aiEnhance.includes('result.status === 429 && quotaExhausted')
  || !aiEnhance.includes("const QUOTA_SYNC_KEY = 'regen:ai-quota-sync'")
  || !aiEnhance.includes("document.addEventListener('visibilitychange', scheduleStatusRefresh)")
  || !builderApp.includes('window.ReGenAI?.setQuota(result.quota)')
) {
  failures.push('AI rate-limit messaging or shared quota refresh behavior is incomplete.');
}
if (
  !apiClient.includes('const supportsSelection =')
  || !apiClient.includes("['text', 'search', 'tel', 'url'].includes(type)")
) {
  failures.push('Paste sanitization can still call selection APIs on unsupported input types.');
}
if (
  !aiEnhance.includes('ReGen AI Tokens')
  || !dashboard.includes('ReGen AI Tokens')
  || !dashboard.includes('1 token is used per AI action')
  || !builderApp.includes('ReGen AI Tokens')
  || !phpApplication.includes('ReGen AI Tokens')
  || ['AI requests', 'AI allowance', 'Daily ReGen tokens'].some(
    copy => (aiEnhance + dashboard + builderApp).includes(copy)
  )
) {
  failures.push('ReGen AI Tokens branding or product-credit wording is incomplete.');
}
const productionBootstrap = publicIndex.indexOf("__DIR__ . '/_app/bootstrap.php'");
const developmentBootstrap = publicIndex.indexOf("dirname(__DIR__) . '/php/bootstrap.php'");
if (
  productionBootstrap === -1
  || developmentBootstrap === -1
  || productionBootstrap > developmentBootstrap
) {
  failures.push('Production must prefer the deployed _app bootstrap over legacy PHP files.');
}
if (
  !schema.includes('CREATE TABLE IF NOT EXISTS user_identities')
  || !schema.includes('provider_subject')
) {
  failures.push('Google identity persistence is missing from the database schema.');
}
if (/>\s*Remove\s*<\/button>/i.test(publicFiles)) {
  failures.push('A text-only Remove button remains in the interface.');
}
if (/Zeeke Resume Gen/i.test(publicFiles)) {
  failures.push('Legacy or promotional interface wording remains.');
}

JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Project checks passed (${javascriptFiles.length} JavaScript files).`);
