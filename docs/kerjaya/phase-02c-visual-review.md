# Kerjaya. · Phase 02C visual review

## Design and scope

The [approved design handoff](approved-design-handoff.md) names B · Career Workspace and links the source prototypes. Delivery uses the existing PHP server, JavaScript clients, PDF services and database schema. Captures labelled before refer to the same working-tree predecessor documented in [Phase 02A visual QA](../regen-v2/02a-visual-qa.md). The [mobile and PWA baseline](mobile-pwa-baseline.md) includes the older install and privacy evidence.

## 1 · Brand tokens, wordmark and shared components

**User** · The public header and candidate shell show the Kerjaya. Inter wordmark. Forms, links and controls use consistent surface, text, action and focus tokens, including the existing dark palette.

**Admin** · Existing public custom names still take precedence over the fallback brand. Brand rendering delegates to `Brand`, `PublicSite`, `PageRenderer` and `WorkspaceShell`. It reads the existing setting and writes no settings or data. Admin navigation and permissions continue to use their existing paths and policies.

**Implementation** · `php/src/Brand.php`, `php/src/PageRenderer.php`, `php/src/PublicSite.php`, `php/src/WorkspaceShell.php`, `public/css/tokens.css`, `public/css/interface.css` and the generated `public/css/site.css`. The built stylesheet compacts whitespace around structural braces. The original install assets and manifest identity are the baseline. No routes, API contracts or database schema changed.

**QA** · PHP lint and the 67 public-asset and 31 navigation/asset checks passed. The public bundle measured 64,748 bytes after the landing changes, below the existing 65,000-byte budget.

## 2 · Public landing and responsive navigation

**User and result** · Visitors can open the sample PDF, compare published designs, follow existing sign-up and sign-in routes, and reach published pricing, privacy choices and the sample walkthrough. The landing leads with the document workspace and uses English or Bahasa Melayu. The sample uses fictional data.

**Admin and policy** · `PublicSite` still reads published catalogue, pricing and Mochi settings. Any feature that the existing settings hide stays hidden. Signed-in registration links still route to the real workspace and existing purchase rules are unchanged.

**Implementation** · `/` and `/pricing`, `php/views/landing.html`, `php/src/PublicSite.php`, `php/src/InterfaceText.php` and `public/css/public-interface.css`. Existing `landing.js`, public preview endpoints and the template, package and account services still drive the controls. The workspace composition replaces the skyline as the main public image.

**QA** · Isolated Chrome passed 13 assertions with no script or HTTP errors. Its six-width sweep covered 360, 390, 430, 768, 1024 and 1440 px. The test changed the active sample and its PDF destination, rendered three published offers, and opened registration. The Malay phone view was captured separately.

| Evidence | Before | After |
| --- | --- | --- |
| Landing desktop | [ReGen desktop](../../output/regen-v2/phase-02a/01-landing-desktop.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/01-landing-desktop.png) |
| Landing phone | [ReGen phone](../../output/regen-v2/phase-02a/02-landing-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/02-landing-phone.png), [Bahasa Melayu](../../output/kerjaya/phase-02c/03-landing-bm-phone.png) |

## 3 · Candidate dashboard

**User and result** · The workspace shows an owned resume, save time, an unfinished section or a writing-review action, and links to real documents. A new candidate can pick a first design. Empty, loading, retry, expired-session and paid action states use the existing API, with unavailable writing assistance below documents.

**Admin and policy** · Account, maintenance, document ownership and price controls remain on the existing guards. The visual layout does not preload candidate PDFs. It uses a labelled public design thumbnail and requests the actual PDF after the candidate selects Preview.

**Implementation** · `/dashboard`, `/resumes`, `dashboard.html`, `dashboard.js`, `WorkspaceShell.php`, and shared workspace styles. The desktop navigation uses the top bar and More menu. The dashboard uses the existing `Api.getMe()`, `Api.listResumes()` and `PdfPages`. The letter link reflects the server count under the existing cover-letter access policy.

**QA** · Chrome passed the isolated dashboard suite, including six widths, actual owner-PDF rendering, focus return, first-resume creation, an incomplete next step and expired-session handling. The forced expiry produced expected `401` responses.

| Evidence | Before | After |
| --- | --- | --- |
| Workspace desktop | [ReGen desktop](../../output/regen-v2/phase-02a/04-workspace-desktop.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/04-workspace-desktop.png) |
| Workspace phone | [ReGen phone](../../output/regen-v2/phase-02a/05-workspace-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/05-workspace-phone.png), [empty](../../output/kerjaya/phase-02c/12-empty-workspace.png), [next task](../../output/kerjaya/phase-02c/18-workspace-next-task.png) |

## 4 · Resume Studio

**User and result** · Desktop keeps the outline, editor and saved PDF panel. Phones switch between Write and the actual draft PDF, retain the section and editor data, and keep the existing save control in the footer. Candidates can still change designs and open review and export.

**Admin and policy** · Preview and download still call the existing owner-checked document routes and server-side entitlement logic. Expiry clears the displayed draft preview and its in-memory PDF while keeping form inputs available for the existing session recovery flow.

**Implementation** · `/builder` and its legacy alias, `builder.html`, `studio.css`, `preview.js`, `stepper.js` and the existing `Studio`, `Api.documentDraft()` and `PdfPages` helpers. `preview.js` reuses the renderer for phone inline and desktop modal views.

**QA** · Chrome navigated the legacy builder URL, checked six viewports, loaded a saved PDF, edited and saved in the database, recovered an offline edit, checked required-field validation, rendered a real draft PDF in phone Preview and switched back to Write. The candidate suite passed 38 assertions. Mobile viewport checks passed 13 synthetic assertions; physical keyboard behavior requires a device run.

| Evidence | Before | After |
| --- | --- | --- |
| Studio desktop | [ReGen desktop](../../output/regen-v2/phase-02a/06-studio-desktop.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/06-studio-desktop.png), [saved PDF](../../output/kerjaya/phase-02c/07-studio-saved-preview.png) |
| Studio phone | [ReGen phone](../../output/regen-v2/phase-02a/08-studio-phone.png) | [Write](../../output/kerjaya/phase-02c/08-studio-phone.png), [draft PDF](../../output/kerjaya/phase-02c/19-studio-preview-phone.png) |

## 5 · Cover letters, templates and Mochi presentation

**User and result** · Candidates can draft, edit, save, and preview matching cover letters linked to their resume styling. Letters feature word-count feedback, search over saved letters, optional AI generation with review/apply/discard workflow, and PDF export. The template gallery presents all 16 Malaysian career designs with clear responsive cards, 320/640/1280 px WebP thumbnails, direct sample PDF links, and entitlement indicators. Mochi provides coaching access in a dedicated conversational room without floating over or obscuring active editing forms or document actions.

**Admin and policy** · Cover letter creation, storage, and export limits remain governed by `CoverLetterRepository` and server-side feature access rules. Template access and visibility remain strictly enforced via `TemplateCatalog`, `TemplateAccess`, and `TemplateManagement`. Mochi coaching interactions follow `MochiPolicy` and strict daily token quotas via `AiQuotaService`.

**Implementation** · `/cover-letters`, `/templates`, `/mochi`, `php/views/cover-letters.html`, `php/views/templates.html`, `php/views/mochi.html`, `public/css/cover-letters.css`, `public/css/templates.css`, `public/css/mochi.css`, `public/js/cover-letters.js`, `public/js/templates.js`, `public/js/mochi.js`, `public/js/mochi-activities.js`, `public/js/mochi-assist.js`, `public/js/mochi-avatar.js`, and `public/js/mochi-play.js`. Backed by `CoverLetterRepository.php`, `CoverLetterTemplate.php`, `TemplateCatalog.php`, `TemplateAccess.php`, `MochiCoach.php`, and `MochiPolicy.php`.

**QA** · The isolated Chrome documents suite passed 19 assertions. In addition, `check-templates.php` passed 182 assertions covering design catalog integrity and typography, while `check-mochi.php` passed 51 assertions. Viewports at 360, 390, 430, 768, 1024, and 1440 px demonstrated zero horizontal overflow and proper control clearances.

| Evidence | Before | After |
| --- | --- | --- |
| Cover letters desktop | [ReGen desktop](../../output/uat-nov6-review/cover-letters-desktop.jpg) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/20-letters-desktop.png) |
| Cover letters phone | [ReGen phone](../../output/regen-v2/phase-02a/09-letters-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/09-letters-phone.png) |
| Templates desktop | [ReGen desktop](../../output/resume-engine/premium-desktop-light.jpg) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/22-templates-desktop.png) |
| Templates phone | [ReGen phone](../../output/regen-v2/phase-02a/10-templates-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/10-templates-phone.png) |
| Mochi room desktop | [ReGen desktop](../../output/assist-me-desktop.jpg) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/21-mochi-desktop.png) |
| Mochi room phone | [ReGen phone](../../output/regen-v2/phase-02a/11-mochi-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/11-mochi-phone.png) |

## 6 · Supporting candidate screens and visual consistency

**User and result** · Candidate supporting flows—including Profile (`/profile`), Settings (`/settings`), Support Tickets (`/support`), Notifications (`/notifications`), Token Store (`/store`), Token Activity (`/token-activity`), Payments & Invoices (`/payments`), Sign In (`/login`), and Registration (`/register`)—render with the cohesive Kerjaya. workspace chrome. All screens feature 44 px interactive targets, accessible typography tokens, localized RM currency and MYT timestamps, consistent form card containers, and responsive layouts.

**Admin and policy** · Authentication lifecycle (`AuthActions`, `Session`, `DeviceContext`), rate limits (`RateLimiter`), support ticket management with protected attachments (`SupportRepository`, `SupportAttachments`), commercial token packages and checkout orders (`TokenStore`, `PaymentOrders`, `HitPay`) retain server-enforced security boundaries.

**Implementation** · `php/views/profile.html`, `php/views/settings.html`, `php/views/support.html`, `php/views/notifications.html`, `php/views/store.html`, `php/views/token-activity.html`, `php/views/payments.html`, `php/views/login.html`, `php/views/register.html`, `public/css/auth-journey.css`, `public/css/workspace-shell.css`, `public/css/token-store.css`, `public/css/support-attachments.css`, `public/js/profile.js`, `public/js/auth.js`, `public/js/store.js`, `public/js/payments.js`, `public/js/support-attachments.js`, and `public/js/live-notifications.js`.

**QA** · Isolated Chrome supporting suite passed 51 assertions across 7 authenticated candidate modules and 2 public auth routes. Swept across 360, 390, 430, 768, 1024, and 1440 px with zero horizontal overflow, zero console errors, and zero uncaught exceptions.

| Evidence | Before | After |
| --- | --- | --- |
| Candidate registration | [ReGen phone](../../output/uat-nov6-review/register-mobile.jpg) | [Kerjaya. phone](../../output/kerjaya/phase-02c/23-registration-phone.png) |
| Candidate sign-in | [ReGen phone](../../output/regen-v2/04-sign-in-mobile.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/24-login-phone.png) |
| Candidate profile | [ReGen profile](../../output/uat-fixes/profile-light.jpg) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-1-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-1-phone.png) |
| Account settings | [ReGen settings](../../output/writing-review/desktop-settings.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-2-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-2-phone.png) |
| Candidate support | [ReGen support](../../output/admin-review/feedback-confirmation.jpg) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-3-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-3-phone.png) |
| Notifications | [ReGen notifications](../../output/admin-review/uat-mobile-notifications.jpg) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-4-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-4-phone.png) |
| Token store | [ReGen store](../../output/store-uat/store-mobile.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-5-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-5-phone.png) |
| Token activity | [ReGen activity](../../output/store-uat/token-packages-desktop.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-6-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-6-phone.png) |
| Payment history | [ReGen payments](../../output/store-uat/user-live-update.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/supporting-7-desktop.png), [phone](../../output/kerjaya/phase-02c/supporting-7-phone.png) |

## 7 · PWA regression fixes and performance improvements

**User and result** · The progressive web app installs cleanly with standalone display mode, updated brand theme color, responsive Web App Manifest, and full portrait/landscape Apple touch startup images. Consenting users benefit from offline public landing capability, while private document workspaces show an informative offline reconnect prompt rather than broken requests. Users retain explicit control over privacy choices; revoking consent immediately purges public Cache Storage.

**Admin and policy** · The security and privacy policy guarantees that candidate private documents, personal profile fields, uploaded images, and auth tokens are never stored in Cache Storage or exposed offline.

**Implementation** · `public/sw.js` (cache version `regen-public-20261115-kerjaya`), `public/manifest.webmanifest`, `public/js/pwa.js`, `public/js/privacy.js`, and `php/views/offline.html`.

**QA** · `check-pwa.mjs` passed 43 assertions without external network dependencies. Chrome installability verification confirmed zero installability errors. Offline navigation correctly served the styled cached landing page and the private reconnect screen when network disconnected.

| Evidence | Before | After |
| --- | --- | --- |
| PWA offline landing | [ReGen offline](../../output/pwa-audit/offline-public-final.jpg) | [Kerjaya. offline landing](../../output/kerjaya/phase-02c/25-pwa-offline-landing.png) |
| Private reconnect screen | [ReGen reconnect](../../output/pwa-audit/preview-mobile.jpg) | [Kerjaya. offline reconnect](../../output/kerjaya/phase-02c/26-pwa-private-offline.png) |

## 8 · Admin brand updates without disrupting operations

**User and operator result** · Administrators manage the platform through a focused workspace featuring the Kerjaya. brand in the dark navigation rail. On small screens, the rail collapses into a touch-friendly drawer (`#admin-menu-toggle`) with 44 px targets. Management views—including Accounts, Feedback, Support, System Settings, Templates, Campaigns, and Maintenance—retain responsive data tables with reflow formatting. Super admins possess complete system oversight; delegated roles (e.g. support agents) are restricted to assigned modules, with server-side redirects on unauthorized deep links.

**Admin and policy** · All operational workflows, maintenance scheduling, template catalog controls, campaign reward grants, transaction inspections, and audit logging (`AuditLogger`) operate with zero disruption. All server-side permission checks and database constraints remain in effect.

**Implementation** · `php/views/admin.html`, `php/views/admin-login.html`, `public/css/admin.css`, `public/css/admin-control-centre.css`, `public/css/admin-commerce.css`, `public/js/admin.js`, `public/js/admin-control-centre.js`, `public/js/admin-templates.js`, `public/js/admin-insights.js`, `public/js/admin-store.js`, `public/js/admin-campaigns.js`, `public/js/admin-maintenance.js`, and backend services `AdminAccess.php`, `AdminRepository.php`, `AdminRoutes.php`, `AdminActions.php`, and `AdminWorkspaceActions.php`.

**QA** · The isolated Chrome admin suite passed 8 assertions. Delegated support agent deep-link denial to `/admin?view=users` was verified. Full 6-viewport sweep (360, 390, 430, 768, 1024, and 1440 px) passed with zero horizontal overflow.

| Evidence | Before | After |
| --- | --- | --- |
| Admin accounts desktop | [ReGen desktop](../../output/regen-v2/09-admin-overview-desktop.png) | [Kerjaya. desktop](../../output/kerjaya/phase-02c/27-admin-accounts-desktop.png) |
| Admin accounts phone | [ReGen phone](../../output/regen-v2/phase-02a/13-admin-accounts-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/13-admin-accounts-phone.png) |
| Admin mobile rail | [ReGen rail](../../output/regen-v2/phase-02a/14-admin-rail-phone.png) | [Kerjaya. phone](../../output/kerjaya/phase-02c/14-admin-rail-phone.png) |

## Theme and edge states

| Scenario | Before | After |
| --- | --- | --- |
| Workspace dark mode | [ReGen dark](../../output/regen-v2/phase-02a/15-workspace-dark.png) | [Kerjaya. dark](../../output/kerjaya/phase-02c/15-workspace-dark.png) |
| Studio desktop dark mode | [ReGen dark](../../output/regen-v2/phase-02a/16-studio-dark.png) | [Kerjaya. dark](../../output/kerjaya/phase-02c/16-studio-dark.png) |
| Studio phone dark mode | [ReGen dark](../../output/regen-v2/phase-02a/17-studio-dark-phone.png) | [Kerjaya. dark](../../output/kerjaya/phase-02c/17-studio-dark-phone.png) |
| Incomplete next task | [ReGen workspace](../../output/regen-v2/phase-02a/05-workspace-phone.png) | [Kerjaya. next task](../../output/kerjaya/phase-02c/18-workspace-next-task.png) |
| Empty workspace state | [ReGen empty](../../output/regen-v2/phase-02a/12-empty-workspace.png) | [Kerjaya. empty](../../output/kerjaya/phase-02c/12-empty-workspace.png) |
| Studio phone draft PDF preview | [ReGen phone preview](../../output/pwa-audit/preview-mobile.jpg) | [Kerjaya. draft PDF](../../output/kerjaya/phase-02c/19-studio-preview-phone.png) |

## Final acceptance and regression summary

1. **Brand cohesion**: Kerjaya. Career Workspace (Concept B) is consistently implemented across public, candidate, and administrative surfaces, utilizing approved typography (Inter), neutral surfaces, forest accent (`#175543`), 44 px target dimensions, and 18 px dialog radiuses.
2. **Public integrity**: The landing page truthfully presents the career workspace and 16 template designs without fabricated claims or non-functional placeholder elements.
3. **Candidate workspace**: The dashboard surfaces real user documents, next useful actions, and live counts. Empty, loading, retry, and session-expired states handle errors gracefully with clear user guidance.
4. **Resume Studio**: Provides desktop side-by-side editing with live PDF preview pane, and phone Write vs. Preview mode toggling while preserving draft data, active section, and bottom save controls.
5. **Mobile and PWA**: Passes responsive checks across 360, 390, 430, 768, 1024, and 1440 px with zero horizontal overflow. PWA capabilities maintain strict privacy partitioning with standalone launch and offline public landing.
6. **Backend stability**: All critical PHP services, MySQL migrations (001–027), PDF generation engines, auth and session handlers, and administrative access controls pass automated verification suites with zero regressions.
7. **Release package**: Built package (`regen-php.zip`: 18.14 MB) verified with complete 16 PDF samples and 48 thumbnails; fresh-cache font rendering verified across all six bundled typography families.
8. **Phase boundary**: Phase 02C implementation is complete and ready for human review. Phase 03 will not start automatically.
