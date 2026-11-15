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
