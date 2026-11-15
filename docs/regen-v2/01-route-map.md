# Phase 00 · Route map and compatibility

## Phase 01 changes in use

- `php/src/Routes.php` declares the existing HTML pages, access class, legacy aliases and narrow operational exceptions. Both `public/router.php` and `public/.htaccess` pass `.html` requests to PHP. A known legacy GET/HEAD returns a temporary redirect with its query while the app is open. During maintenance, candidate and candidate-auth aliases return `503` directly. Unknown `.html` names use the existing branded 404.
- `/builder?id=…&section=…`, `/payments/result?order=…` and other known candidate destinations survive the redirect to sign-in. `Session` validates and consumes the saved local destination, with fallback for pre-update Store and payment session state. `/app/*` and nested admin navigation remain Phase 02 work.
- All admin API actions have explicit methods and capabilities in `AdminRoutes.php`. `/api/admin/users/{id}/export` keeps its URL and attachment shape. `GET` requests reauthentication (`428`). `POST` uses the existing CSRF header, `users.export` and the administrator’s current password. Restore at `POST /api/admin/recovery/{id}/restore` adds password confirmation to the existing `recovery.manage` and typed phrase requirements.
- `/api/health` checks application schema before session initialization and returns `503` with a request reference on connection or core-schema failure. `GET /api/admin/operations/health` additionally provides core and payment schema diagnostics with `operations.view`. Payment checkout declines new requests before provider I/O if required payment structures are missing. Callback URLs remain exact and still require the original raw-body signature and order validation.

## Phase 02 additions

| Route | Access | Handler and compatibility |
| --- | --- | --- |
| `GET /pricing` | Public | `PublicSite::dispatch()` serves published Store offers using the existing `/site/pricing.json` contract. The URL stays available when publication is off and explains availability. |
| `GET /resumes`, `GET /settings` | Candidate | `Routes::PAGES` uses the existing resume and account views. Existing dashboard, builder, templates and profile URLs remain valid. |
| `GET /tailor`, `/jobs/saved`, `/applications`, `/interview` | Candidate | `upcoming.html` describes planned tools and provides an Overview link. The standard sign-in and maintenance gates apply, including on matching `.html` aliases. |
| `GET /admin?view=…` | Administrator | Existing admin shell and API scopes. Phase 02 adds direct links, refresh and browser history for allowed views. |
| `GET /design-system` | Development or test | `PublicSite::dispatch()` serves the component showcase only when the runtime environment permits it. |

English and Bahasa Melayu use a `lang=en` or `lang=ms` query on localized page routes. A language change retains other query values and does not change the auth or maintenance classification. [Design system and verification](design-system.md)

The inventory below records the Phase 00 baseline. [Phase 01 completion report](06-phase-01-foundation.md)

This map reflects the working tree. `{id}` is the numeric ID accepted by the corresponding handler, `{design}` is a template ID, and comma-separated methods share a path. Prefixes named in subsection headings are part of the path. Statuses describe source behavior. The live web-server configuration and usage telemetry were unverified.

## Dispatch and guard order

1. `public/.htaccess` rewrites in DirectAdmin. `public/router.php` is the separate PHP development router. `public/index.php` locates deployed `_app/bootstrap.php` or local `php/bootstrap.php`. Static assets are served outside the PHP dispatcher.
2. `php/bootstrap.php` applies security headers and invokes `PublicSite::dispatch()` for public and SEO routes. It starts the PHP session before `RealtimeEndpoint::dispatch()`, which handles `/api/realtime/*` and can terminate before `Application::run()`.
3. `Application::run()` handles signed HitPay webhooks before normal request audit, IP blocks, origin/CSRF and maintenance. It handles `LiveActions::liveRoutes()` for status and maintenance HTML before the normal mutation gate. `GET /api/health` is available before the maintenance gate. A DB connection failure during bootstrap can occur before the health handler's own `503` handling.
4. Browser mutations go through same-origin checks and, for authenticated sessions, CSRF. Listed public auth mutations use their own validation/rate limits. Google identity callback substitutes Google's double-submit check. The candidate API uses `requireAuth()` for active, verified and active-device sessions. Page rendering uses `hasVerifiedSession()` for active, verified users, and individual APIs enforce device/ownership checks. `FeaturePolicy` handles availability. `FeaturePricing` and `TemplateAccess` handle commercial access where mapped.
5. Admin APIs use `requireAdmin()`, password-setup restrictions, then `AdminAccess::allows()`. GET typically requires `<module>.view`, writes require `<module>.manage`, and export routes use `<module>.export`. Special permissions and handler-level reauthentication still apply. Admin HTML checks the session flag and leaves the API to enforce stronger checks. Unrecognized admin prefixes map to `unassigned`, and module-free exceptions are individually listed. `GET`/`HEAD` apply where explicitly recognized; avoid assuming automatic HEAD support for APIs.

## Existing public pages, auth and integration routes

| Method and path | Route source and handler | Gate and downstream |
| --- | --- | --- |
| GET/HEAD `/` | `PublicSite.php` → `dispatch()` → `landing.html` | Public. `TemplateManagement`, `TokenStore`, `FeaturePricing`, `MochiPolicy`. `bootstrap.php` records GET traffic through `OperationsMonitor` when DB is available. |
| GET/HEAD `/offline`, `/robots.txt`, `/sitemap.xml` | `PublicSite::dispatch()` | Public reconnect HTML or generated SEO response. |
| GET/HEAD `/site/pricing.json`, `/site/mochi.json`, `/site/templates.json` | `PublicSite::dispatch()` | Public published-package presentation, Mochi preview settings, and design catalog with fictional sample, respectively. |
| GET/HEAD `/demo/templates/{design}`, `/demo/letters/{design}` | `PublicSite::dispatch()` | Public, selectable designs only, fictional data. `TemplateCatalog`, `TemplateManagement`, `ResumeTemplate`, `CoverLetterTemplate`. |
| GET/HEAD `/manifest.webmanifest`, `/sw.js`, `/samples/{design}.pdf`, public assets | Static `public/` and both server routers | Public. `public/sw.js` allowlists assets and offline behavior. Production CSP/headers also apply at web server. |
| GET/HEAD `/favicon.ico` | `Application::run()` fallback → `/img/favicon-logo.png` | Public `308` if PHP handles it. An existing static favicon can be served ahead of PHP. |
| GET `/login`, `/register` | `Application::servePage()` → `login.html`, `register.html` | Guest entry, verified users redirect to dashboard. Registration has a feature gate. |
| GET `/verify-email`, `/reset-password` | `Application::servePage()` → matching view | Public verification and token reset, maintenance applies. |
| GET `/admin/login`, `/admin` | `Application::servePage()` → `admin-login.html`, `admin.html` | Separate admin session; `303` between login and shell based on session flag. Module views have no dedicated PHP path. |
| GET `/maintenance`, `/api/system/status` | `Actions/LiveActions.php` → `liveRoutes()` | Public, `MaintenanceService::render()` or `status()`. |
| GET `/api/health` | `Application.php` → `health()` | Public read, also behind bootstrap DB connection. Table/column subset checks; this is not a payment or provider readiness check. |
| GET `/api/capabilities` | `Application.php` → `ControlCentreActions::controlCentreRoutes()` | Public feature/visibility data, maintenance protected. |
| GET `/api/auth/recaptcha/config`, `/api/auth/google/config` | `Application.php` → `AuthActions::recaptchaConfig()`, `googleConfig()` | Public config, Google feature/settings and public provider IDs. |
| POST `/api/auth/register`, `/api/auth/login` | `Application.php` → `AuthActions::register()`, `login()` | Public auth mutations. `RateLimiter`, `UserRepository`, reCAPTCHA, verification delivery for registration, `Session` and `AccountRepository` for login. |
| POST `/api/auth/email-verification/verify`, `/api/auth/email-verification/resend`, `/api/auth/google` | `Application.php` → `AuthActions::verifyEmail()`, `resendEmailVerification()`, `googleLogin()` | Token or signed Google identity, with provider and settings guards. `UserRepository`, `EmailVerificationService`, `GoogleIdentityService`, `Session`. |
| POST `/api/auth/password-reset` | `Application.php` → `ControlCentreActions::controlCentreRoutes()` | Rate-limited token consumption via `PasswordResetService`. No public request-for-email route found; admin sends the link. |
| POST `/api/admin/auth/login` | `Application.php` → `AdminActions::adminLogin()` | Public admin sign-in with throttling and status checks in `AdminRepository`. |
| POST `/api/webhooks/hitpay/{sandbox\|live}` | `Application.php` → `PaymentActions::paymentWebhook()` | No browser session required. `HitPay` validates HMAC/mode and bounded raw input; `PaymentOrders::applyEvent()` validates order and fulfills. Preserve both literal URLs. |

## Existing candidate pages and API

`Application::servePage()` dispatches these private views via `PageRenderer`. `WorkspaceShell` supplies shared navigation. Each requires the verified/active user session rule, with feature/entitlement conditions where applicable.

| Path | View and page client | Surface |
| --- | --- | --- |
| `/dashboard` | `dashboard.html`, `dashboard.js` | Saved resume, onboarding, writing review entry. |
| `/builder?id={id}` | `builder.html`, `app.js`, `stepper.js`, `assist-me.js`, `ai-enhance.js` | Editor, section writes, preview/export and review. Current `section` and `review=1` query values drive substate. |
| `/templates` | `templates.html`, `templates.js` | Design selection, sample preview, pricing and apply. |
| `/cover-letters?id={id}` | `cover-letters.html`, `cover-letters.js` | Saved letters/create/edit, preview and export. ID optional. |
| `/profile` | `profile.html`, `profile.js` | Account, security, preferences and devices. |
| `/support`, `/notifications`, `/feedback` | Matching views, `service-centre.js`, `live-notifications.js`, `feedback.js` | Ticket and attachment access, inbox and feedback. |
| `/store`, `/token-activity` | Matching views, `store.js`, `points.js` | Package purchase/claim, wallet, usage/activity. |
| `/payments`, `/payments/result` | `payments.html`, `payments.js` | History and read-only result, with validated `order` reference. |
| `/mochi` | `mochi.html`, `mochi.js`, `mochi-play.js` | Coach room, interactions, optional preferences and coaching. The shell loads before coach feature/benefit status. |

All rows below use the candidate guard unless noted. `Application.php` is the primary route source. A trait filename names the secondary dispatch or implementation in `php/src/Actions/`.

| Method and path | Handler → downstream | Extra gate or behavior |
| --- | --- | --- |
| GET `/api/auth/me`; POST `/api/auth/activity` | `AuthActions::me()` → `UserRepository`, `ResumeRepository`; inline → `Session::recordUserActivity()` | Verified and active session. |
| POST `/api/auth/logout` | `Application::run()` inline → `AccountRepository::revokeCurrentSession()`, `Session::destroy()` | Conditional CSRF for signed-in caller, no candidate guard requirement. |
| GET/PATCH `/api/profile`; GET `/api/profile/photo`; PUT `/api/profile/password`, `/api/profile/email` | `ProfileActions::profile()`, `updateProfile()`, `profilePhoto()`, `changePassword()`, `changeProfileEmail()` → `AccountRepository`, `UserRepository`, `ResumeRepository`, verification | Owner, sensitive operations have additional validation and account/session effects. |
| GET `/api/profile/sessions`; DELETE `/api/profile/sessions/history`, `/api/profile/sessions/{id}`, `/api/profile/account` | `ProfileActions::profileSessions()`, `clearProfileSessionHistory()`, `revokeProfileSession()`, `deleteProfileAccount()` → `AccountRepository` | Owner; account deletion checks confirmation and existing password where applicable. |
| GET/POST `/api/dashboard`; PATCH `/api/dashboard/{id}/title` | `ResumeActions::listDashboard()`, `createResume()`, `renameResume()` → `ResumeRepository`, `TemplateAccess` | Creation and rename pricing; ownership. |
| DELETE `/api/dashboard/{id}` | `Application::run()` inline | Explicit `405`; old Express implementation had user delete. Preserve refusal while primary policy holds. |
| GET `/api/resume/{id}`; POST `/api/resume/{id}/section`; POST/DELETE `/api/resume/{id}/photo` | `ResumeActions::getResume()`, `saveSection()`, `uploadPhoto()`, `deletePhoto()` → `ResumeRepository`, `Sanitizer`, `PortraitImage`, `DocumentWriteGuard`, `TemplateAccess` | Owner and per-operation input, generation, photo and document configuration checks. |
| GET `/api/ai/status`; POST `/api/resume/{id}/ai-assist`, `/api/resume/{id}/ai-suggest`; GET/POST `/api/resume/{id}/ats-review` | `AiActions::aiStatus()`, `assistResumeSection()`, `suggestResumeSection()`, `atsReviewState()`, `atsReview()` → `AiQuotaService`, `ResumeAssistance`, `OpenAIService`, `AtsService`, `ResumeReview`, `ResumeRepository` | Owner. Permission, usage and provider checks per action. Existing review state can be read without a new paid review. |
| GET `/api/pdf/{id}/generate`, `/api/pdf/{id}/preview`; GET/POST `/api/pdf/{id}/document`; POST `/api/pdf/{id}/preview-data` | `DocumentActions::generatePdf()`, `preview()`, `previewDocument()`, `previewDraft()` → `PdfService`, `TemplateAccess`, `ResumeRepository` | Owner; `/preview` redirects to inline PDF, `/preview-data` is a draft adapter. Generate may settle a priced use. |
| GET/POST `/api/cover-letters`; GET/PUT/DELETE `/api/cover-letters/{id}`; POST `/api/cover-letters/{id}/ai-suggest`; GET `/api/cover-letters/{id}/preview`, `/pdf`, `/document` under the same ID prefix | `DocumentActions::coverLetters()` → `CoverLetterRepository`, `CoverLetterTemplate`, `PdfService`, `OpenAIService`, `AiQuotaService` | Requires user's primary resume; letter owner and resume relationship. `/preview` redirects to `/document`. `/pdf` may settle a priced use. |
| GET `/api/templates`, `/api/templates/{design}/preview` | `Application::run()` inline → `TemplateManagement`, `TemplateAccess`, `TemplateCatalog`, `ResumeTemplate` | Catalog with access flags and fictional HTML preview. Actual apply runs via resume section save. |
| GET `/api/lookups/institutions`, `/api/lookups/locations` | `Application::run()` inline → `LookupService`, `InstitutionDirectory` | Account/IP limits. Institution data local, locations may query Wikidata. |
| GET `/api/support/configuration`; GET/POST `/api/support/tickets`; GET/PATCH `/api/support/tickets/{id}`, POST multipart to same; GET `/api/support/tickets/{id}/attachments/{attachmentId}` | `ControlCentreActions::controlCentreRoutes()` → `SupportConfiguration`, `SupportRepository`, `SupportAttachments` | Owner check on ticket and attachment, throttled writes. |
| GET `/api/notifications`, `/api/notifications/count`; GET/PUT `/api/notifications/preferences`; POST `/api/notifications/read`; DELETE `/api/notifications/{id}` | `ControlCentreActions::controlCentreRoutes()` → `NotificationService`, `CampaignService` | Scoped inbox and preference state; GET inbox/count may sync campaign notifications. |
| GET `/api/campaigns`, `/api/campaigns/{id}`; POST `/api/campaigns/{id}/claim`, `/api/campaigns/{id}/dismiss` | `AdminWorkspaceActions::workspaceRoutes()` and `campaignUserAction()` → `CampaignService` | Audience/window, claim key and limits. |
| GET/POST `/api/feedback` | `InsightActions::insightRoutes()` → `FeedbackRepository` | Candidate eligibility, rate and idempotency rules. |
| GET `/api/store`, `/api/store/activity`, `/api/store/prices`; POST `/api/store/packages/{id}/claim`, `/api/store/access`, `/api/store/credits/{id}/refund` | `CommerceActions::commerceRoutes()` → `TokenStore`, `FeaturePricing`, `PackageClaims`, `PackageAccess`, `BonusCreditService` | Owner, config/balance/offer version/cap enforcement. |
| POST `/api/store/checkout`; GET `/api/store/payments` | `PaymentActions::paymentRoutes()` → `HitPay`, `PaymentOrders` | Conditional checkout, user-owned history/result. Same path+method in commerce is shadowed. |
| GET `/api/mochi/status`; PUT `/api/mochi/preferences`; POST `/api/mochi/comment`, `/api/mochi/chat` | `Application::mochiRoutes()` → `MochiPolicy`, `MochiProfile`, `PackageAccess`, `MochiCoach`, `OpenAIService` | Package and account mode gates, opt-in and budget checks, throttled AI. Status is readable to signed-in users to describe access. |
| GET `/api/realtime/session`, `/api/realtime/changes`, `/api/realtime/events`; POST `/api/realtime/authorize` | `RealtimeEndpoint::dispatch()` → `LiveActions::liveRoutes()` → `RealtimeConnection`, `RealtimeEvents`, `ManagedRealtime`, `MaintenanceService` | Separate verified user/active admin principal and topic authorization. POST also checks same-origin/CSRF. `/events` returns `410` after auth. |

## Existing admin API

All paths below start with `/api/admin`. `Application::run()` enters the admin guard before the listed handler. `Self` denotes an explicit authenticated exception to module permission, with actor/own-inbox handling inside the endpoint. `Super` denotes added super-admin requirements. `view/manage/export` follow the convention above unless the row qualifies it.

| Method and suffix | Handler and source | Module and downstream |
| --- | --- | --- |
| GET `/me`; POST `/auth/logout` | `AdminActions::adminMe()`; `Application::run()` inline | Self. `AdminRepository`, `AdminAccess`, `Session`. |
| PUT `/profile`, `/password`; POST `/session/active` | `AdminWorkspaceActions::updateAdministratorProfile()`, `AdminActions::adminChangePassword()`, `LiveActions::adminLiveRoutes()` | Self. `AdminRepository` and profile/audit; current password policy. |
| GET `/dashboard`, `/reports`, `/reports/export`, `/analytics` | `AdminActions::adminDashboard()`, `InsightActions::insightRoutes()`, `ControlCentreActions::controlCentreRoutes()` | Overview, Reports, Analytics. `AdminRepository`, `AdminReportRepository`, `OperationsMonitor`. |
| GET/POST `/users`; GET/PATCH `/users/{id}` | `AdminActions::adminUsers()`, `adminCreateUserAccount()`, `adminUpdateUser()`; GET detail in `ControlCentreActions` | Users. `AdminRepository`, `UserRepository`, sessions, quota and owned document summaries in detail. |
| GET `/users/{id}/sessions`, `/users/{id}/export`; POST `/users/{id}/verification`, `/password-reset`, `/delete` under same ID prefix | `AdminWorkspaceActions::administratorUserSessions()`, `ControlCentreActions` | Users, export requires separate grant, deletion Super with password. Account repository, mail, reset and full document export. |
| POST `/users/{id}/reset-quota`, `/users/{id}/revoke-sessions`, `/operations/revoke-all-sessions` | `AdminActions::adminResetQuota()`, `adminRevokeUserSessions()`, `adminRevokeAllSessions()` | Users or Operations. Global revoke also requires Super and typed confirmation. `AiQuotaService`, `AccountRepository`, audit. |
| GET/POST `/users/{id}/bonus` | `InsightActions::insightRoutes()` | Users, POST additionally `ai.manage`. `BonusCreditService`, audit. |
| GET/POST `/users/{id}/packages`; GET `/users/{id}/packages/catalogue`; POST `/users/{id}/packages/{grantId}/{adjust\|replace\|revoke}` | `CommerceActions::commerceRoutes()` | `users.view` for history; catalogue and writes additionally require `users.packages`. `AccountPackages`, `TokenStore`, `PackageAccess`. |
| GET/POST `/admins`; PATCH `/admins/{id}/status`; GET/PUT `/admins/{id}/permissions` | `AdminActions::adminListAdmins()`, `adminCreateAdmin()`, `adminUpdateAdminStatus()`; `InsightActions` permission branch | Administrators, Super, assignment write reauth. `AdminRepository`, `AdminAccess`. |
| GET `/templates`, `/templates/{design}/preview`; PATCH `/templates/{design}` | `InsightActions::insightRoutes()` | Templates. `TemplateManagement`, `TemplateCatalog`, `ResumeTemplate`, sample render. |
| GET `/templates/{design}/resumes`, `/templates/{design}/resumes/{id}/preview`, `/templates/{design}/resumes/{id}/pdf` | `InsightActions::insightRoutes()` | `templates.view` + `templates.resumes`. `TemplateManagement`, `ResumeTemplate`, `PdfService`, `AuditLogger`. |
| GET/PUT `/settings/ai`, `/settings/system`, `/settings/mochi`, `/settings/mochi/user/{id}`; PUT `/settings/bootstrap-access` | `AdminActions::adminAiSettings()`, `adminUpdateAiSettings()`, `adminSystemSettings()`, `adminUpdateSystemSettings()`, `adminMochi()`, `adminUpdateMochi()`, `adminMochiAccount()`, `adminBootstrapAccess()` | AI or System. Bootstrap change requires a personal admin and enabling additionally requires Super. `AdminRepository`, quota policy, `MochiPolicy` and audit. |
| GET `/features`; PUT `/features/{key}`; GET/PUT `/maintenance`; GET `/maintenance/preview` | `ControlCentreActions::controlCentreRoutes()`, `LiveActions::adminLiveRoutes()` | Features or System. `FeaturePolicy`, `MaintenanceService`, `ManagedRealtime` status. |
| GET `/email`; POST `/email/test`; GET/PUT `/email/config` | `AdminActions::adminEmailStatus()`, `adminEmailTest()`, `InsightActions::insightRoutes()` | Email. `EmailDeliveryRepository`, `EmailVerificationService`, `RuntimeMailSettings`. Configuration write additionally requires current admin password and has a rate limit. |
| GET `/notifications`; PUT `/notifications/policy`; POST `/notifications/campaigns`, `/notifications/retry` | `ControlCentreActions::controlCentreRoutes()` | Notifications. `NotificationService`, worker outbox, audit. |
| GET/POST `/campaigns`; PUT `/campaigns/{id}` | `AdminWorkspaceActions::workspaceRoutes()` | Campaigns. `CampaignService` for announcements and rewards. |
| GET `/tickets`; GET/PATCH `/tickets/{id}` and POST multipart; GET `/tickets/{id}/attachments/{attachmentId}`; POST `/tickets/{id}/reopen`; GET/PUT `/tickets/configuration`; GET/PUT `/settings/support-attachments` | `ControlCentreActions`, `AdminWorkspaceActions`, `InsightActions`, `CommerceActions` | Support except `/settings/support-attachments` (System). `SupportRepository`, `SupportAttachments`, `SupportConfiguration`. |
| GET `/feedback`, `/feedback/summary`, `/feedback/{id}/reviews`, `/feedback/export`; PATCH `/feedback/{id}`; PUT `/feedback/policy` | `InsightActions::insightRoutes()` | Feedback. `FeedbackRepository`, `AdminReportRepository`, reward and audit logic. |
| GET `/alerts`, `/work-queues`; POST `/alerts/read`; DELETE `/alerts/{id}`; GET/PUT `/preferences` | `InsightActions::insightRoutes()`, `LiveActions::adminLiveRoutes()` | Self, with `AdminAlertService` recipient filters and per-module queue counts. |
| GET `/operations/health`, `/security`; POST `/security/blocks`; DELETE `/security/blocks/{hash}`; PATCH `/security/incidents/{id}` | `ControlCentreActions`, `InsightActions` | Operations or Security. `OperationsMonitor`, incident state and audit. |
| GET/POST `/recovery`; GET `/recovery/{id}`; PUT `/recovery/policy`; POST `/recovery/{id}/restore` | `ControlCentreActions::controlCentreRoutes()` | Recovery. `RecoveryService`, document generation and audit. |
| GET `/audit`, `/audit/search`, `/audit/export` | `AdminActions::adminAuditLogs()`, `InsightActions::insightRoutes()` | Audit. `AuditLogger`, `AdminReportRepository`. |
| GET `/store`, `/store/accounts`, `/pricing`; PUT `/store/policy`, `/pricing/{key}`, `/store/packages/{id}`; POST `/store/packages`, `/store/packages/{id}/grant` | `CommerceActions::commerceRoutes()` | Pricing. `TokenStore`, `FeaturePricing`, `PackageAccess`; direct SQL for account-picker matches. |
| GET `/store/payments`, `/store/payment-analytics` | `PaymentActions::paymentRoutes()` | Pricing. `PaymentOrders::history()` and `analytics()`. |

**Duplicate, inactive and hard-coded cases.** `POST /api/store/checkout` resolves through `PaymentActions` first and always ends there for a recognized POST, making the `CommerceActions` stub unreachable. `/api/realtime/events` deliberately returns `410` for an authenticated principal. `/api/pdf/{id}/preview`, `/api/pdf/{id}/preview-data` and letter `/preview` have compatibility handlers. `api.js` still references `preview-data`; preserve it. The older `/api/admin/audit` is called by a built-in renderer in `admin.js`, while the insights module uses `/audit/search` and can take precedence; treat its client use as a retirement candidate, not proven absent. Historical Express `GET /api/auth/logout` has no PHP GET handler, and its resume DELETE has an explicit refusal. No caller telemetry was accessed. Hard-coded paths cross `WorkspaceShell.php`, `Session.php`, `FeaturePricing.php`, `FeaturePolicy.php`, `MaintenanceService.php`, `AdminAccess.php`, `auth.js`, `api.js`, `admin.js`, `store.js`, `payments.js`, `live-notifications.js`, `realtime.js` and manifest/service worker. Route, auth-return, notification-link and entitlement registries must agree before cutover.

## Target hierarchy and redirects

Public and auth routes remain server-rendered with native navigation. `/app/*` is the authenticated candidate scope. `/admin/*` is the permission-aware admin scope. `/api/v1/*` is the versioned application API. Existing provider callback paths stay exact, outside versioning; new first-party resources use versioned URLs immediately. All targets are proposals.

| Existing browser URL | Target | Browser compatibility |
| --- | --- | --- |
| `/`, `/offline`, `/robots.txt`, `/sitemap.xml`, `/site/*`, `/demo/*`, PWA/static URLs | Same | Keep. Update generated robots rules for `/app/` when introduced. |
| `/login`, `/register`, `/verify-email`, `/reset-password`; `/admin/login`; `/maintenance` | Same | Keep working email links, installed app URL and maintenance recovery links. Template onboarding, tokens and allowlisted return links retain current semantics. |
| `/index.html`; `/admin-login.html`; `/login.html`, `/register.html`, `/verify-email.html` | `/`; `/admin/login`; corresponding extensionless URLs | One explicit allowlisted redirect preserving expected query/fragment behavior, same in PHP dev and Apache. Verify fragment-carried tokens in a browser. |
| `/dashboard` or `/dashboard.html` | `/app` | Temporary redirect, preserve allowlisted dashboard state. |
| `/builder?id=42&section=…`, `/builder.html?id=42&section=…` | `/app/resumes/42/edit?section=…` | Preserve positive ID and supported section/review keys. Resolve no-ID requests after candidate auth, then continue editor/setup path. Opening an ID still checks ownership. |
| `/templates` or `/templates.html` | `/app/resumes/templates` | Keep eligible selection/onboarding context. |
| `/cover-letters`, `/cover-letters.html`, optional `?id=42` | `/app/cover-letters` or `/app/cover-letters/42/edit` | Keep saved selection, preserve supported search and page state, check both owners/relations. |
| `/profile` or `/profile.html`, `/mochi` | `/app/account`, `/app/mochi` | Signed-in redirects. Preserve non-sensitive deep-link state. |
| `/support`, `/notifications`, `/feedback` | `/app/support`, `/app/notifications`, `/app/feedback` | Retain old notification/support links and authorized IDs. |
| `/store`, `/token-activity` | `/app/store`, `/app/billing/tokens` | Retain valid feature focus and token/claim return. |
| `/payments`, `/payments/result?order=…` | `/app/billing/payments`, `/app/billing/payments/result?order=…` | Keep both old receipt/history/HitPay result URLs and the validated order lookup through sign-in. |
| `/admin` or `/admin.html` | `/admin` | Same landing chooses an allowed module after auth. Canonical children `/admin/{analytics,users,support,feedback,campaigns,pricing,templates,ai,settings,mochi,email,security,operations,recovery,administrators,audit,profile,alerts}`. Use subroutes such as `/admin/settings/maintenance`, `/admin/operations/sessions`, `/admin/pricing/payments` and `/admin/users/{id}/packages`. |
| New candidate routes | `/app/career-profile`, `/app/resumes/{id}/versions`, `/app/jd-analyses/{id}`, `/app/jobs`, `/app/jobs/saved`, `/app/applications`, `/app/interview-practice` | Register behind their phase gate. Link when real features and appropriate access exist. |

| Existing API group | Target handler family | Compatibility |
| --- | --- | --- |
| `/api/auth/*`, `/api/profile/*`, `/api/admin/auth/*` | `/api/v1/auth/*`, `/api/v1/account/*`, `/api/v1/admin/auth/*` | Internal aliases share session, CSRF, constraints and payloads. Keep Google POST callback exact until provider and browser verification permit any change. |
| `/api/dashboard`, `/api/resume/*`, `/api/templates*`, `/api/pdf/*`, `/api/cover-letters*`, `/api/ai/status` | `/api/v1/workspace`, `/api/v1/resumes/*`, `/api/v1/templates/*`, `/api/v1/resumes/{id}/preview`, `/api/v1/cover-letters/*`, `/api/v1/ai/status` | Map POST dashboard to resume create and PATCH title to equivalent action. Keep old response/error formats. New paid export creates an idempotent POST operation, followed by an authorized GET artifact. Deprecate charged GET only after legacy callers are mapped. |
| `/api/notifications*`, `/api/support/*`, `/api/campaigns*`, `/api/feedback`, `/api/lookups/*`, `/api/mochi/*` | `/api/v1/{notifications,support,campaigns,feedback,lookups,mochi}…` | Same handler/policy alias and real receipt/cursor behavior. |
| `/api/store/*`, `/api/admin/store/*`, `/api/admin/pricing*` | `/api/v1/store/*`, `/api/v1/billing/{orders,token-activity}…`, `/api/v1/admin/pricing/*`, `/api/v1/admin/billing/*` | Internal aliases for quote/claim/payment writes. Existing payment history and order IDs remain stable. |
| `/api/realtime/*`, `/api/system/status`, `/api/capabilities`, `/api/health` | `/api/v1/realtime/*`, `/api/v1/system/{status,capabilities,health}` alongside current endpoints | Preserve active old tabs and health probes; pin retired stream response. Preserve authenticated topics and maintenance status. |
| Other `/api/admin/*` | `/api/v1/admin/*` | Explicit route to capability per action, attach same handlers initially. Preserve admin self-service and password-setup exceptions. |
| `/api/webhooks/hitpay/sandbox`, `/api/webhooks/hitpay/live` | Same | Keep raw signed-body POST, idempotency and maintenance exemption. No client-side success mutation. |
| New API | `/api/v1/career-profile`, `/api/v1/jd-analyses`, `/api/v1/resumes/{id}/versions`, `/api/v1/{jobs,saved-jobs,applications,interview-sessions,subscriptions}` | Activate by phase behind ownership and plan checks. |

**Coordination and rollout.** Register canonical URLs and aliases in the same PHP dispatcher with route metadata for principal, maintenance, feature, entitlement, and admin scope. Use explicit 302/303 for page transitions first. Retain validated IDs and allowlisted query parameters; construct same-origin destinations. API writes use internal handler aliases rather than HTTP redirects. Never bounce `/api/*` or `/admin/*` into a generic client/app shell. Return JSON `401/403/404/405/503` where appropriate and HTML for browser requests. Give admin module changes real links; if the module loader intercepts an in-shell navigation, update history and handle `popstate` against the same server routes. Direct reload and new tabs should select the same authorized module. Keep external URLs, installed apps, worker offline routing, CSP, static asset handling and cookies functioning in both Apache and dev. Drop legacy aliases only after verified callers, compatibility logs stripped of sensitive identifiers, and an approved rollback window.

**First route gates.** Test maintenance on every canonical and alias path, including `/mochi`, `/token-activity`, `/payments` and result, with active admin and signed callback exceptions. Align page and API identity checks and route-level admin permission assertions. Test expired sessions, malformed IDs, unrelated records, disabled features, missing entitlement, entitlement replay, signed callbacks, direct/back/reload, saved filter state, PWA HTTP status and no-store, query/fragment retention, and offline/online return. Validate redirection and rewrites on the actual Apache-compatible host as well as the dev router.
