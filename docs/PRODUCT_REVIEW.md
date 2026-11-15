# ReGen product quality review

## 29 October 2026: appearance refresh

The current experience replaces the earlier green/light presentation below with a fixed dark public website and light/dark/system choices inside the application. `main.css` owns semantic color and typography tokens. `appearance.css` owns material treatments and shared controls; legacy UI surfaces now consume the tokens. The system font is preferred on Apple devices, with bundled Inter as the cross-platform fallback. No framework, external font request or new design runtime was added.

The public hero uses actual document previews, a subtle illuminated backdrop and translucent controls. Template browsing uses a scrollable collection. Copy is shorter, the sample workspace can demonstrate both themes, and navigation has visible keyboard focus. Backdrop blur/saturation and specular gradients form the glass surfaces; solid-surface and reduced-motion fallbacks remain available. This is an Apple-inspired web treatment, not a native Apple UI framework.

Application changes cover authentication, dashboard, template selection, editor, letters, account settings, shared administration colors and offline pages. Mobile navigation floats above the safe area. The editor uses a bottom section sheet, a stable action footer and a compact AI refinement control with expandable usage details. Documents retain their print colors in either theme. Theme choice is the only new browser-stored preference; private documents and credentials are not stored by the appearance code.

Validation performed on the real local PHP application with a temporary fictional account:

- Desktop and phone layouts at 320, 390, 1280 and 1440 px; the public page was also inspected in the app's default preview width. The 320 px landing page and section sheet have no page-level horizontal overflow.
- Dark and light dashboard/editor/account/authentication layouts, persisted theme choice after navigation/reload, the fixed dark homepage with a light preference, and the official Google button switching theme.
- Mobile section selection, narrow-screen template chooser, saving contact details, reloading the saved job title, actual resume PDF preview, cover-letter save/reload and matching PDF preview. No real AI generation or external email was requested.
- PHP syntax/autoload/asset checks, all browser JavaScript syntax checks, strict Composer validation, 24 email configuration compatibility assertions and a locked dependency audit reporting no advisories.
- The upload ZIP includes fingerprinted appearance assets, the existing Google RSA verification repair and a protected `_app/EMAIL_SETUP.md`. It excludes `.env`, test helpers, test-account data and screenshots.

Email accepts Laravel-style `MAIL_*` names and retains the old aliases. The local `.env` keys were renamed without changing their values. The default example and the DirectAdmin guide cover 465/SSL and 587/STARTTLS, mailbox credentials, quoting and the existing administrator delivery test. No server-side Composer or Artisan command is required.

Live Google authentication and SMTP delivery still require verification on the deployed hostname. Physical iOS/Android installation, keyboard and safe-area behavior were not exercised in this refresh; browser responsive checks do not replace those device checks. No database migration is required. Earlier sections below describe the preceding implementation and its earlier test record.

## Audit and implementation order

The existing PHP routing, account ownership checks, CSRF protection, sanitization, actual PDF previews and 24-hour login lifecycle are worth preserving. This phase retains plain browser JavaScript and the existing PHP runtime. Administration is outside the redesign scope.

1. **Brand and layout:** replace competing blue overrides with green brand tokens, neutral surfaces and consistent readable control sizes. Consolidate the editor layout rules instead of appending another mobile override.
2. **Public product experience:** rebuild the landing composition around an interactive application desk, real documents, transparent sample writing and clear account creation. Use short transitions and intersection-based reveals with reduced-motion support.
3. **Mobile and editing:** replace the stacked mobile section/template header with compact contextual navigation and a native section sheet. Make photo entry secondary. Fix save feedback, repeated requests, navigation races and interrupted saves. Keep private writing in memory rather than browser persistence.
4. **Documents:** inspect all ten resume/letter designs and exercise normal, long and sparse content through the actual PDF renderer. Preserve pagination, extractable text and meaningful layout differences. Report any limits of ATS checks honestly.
5. **Security and performance:** test two-account document isolation, CSRF, upload rejection and private-cache exclusions. Remove the unconditional `auth.email_verified` audit write from the request dispatcher. Measure local loading and important actions; do not equate laboratory timings with production field percentiles.

## Specific findings

- `product.css`, `workspace.css` and `stepper.css` contain competing layout decisions. The mobile editor stacks branding, progress, section selection and two design controls before the form.
- The optional photo occupies the most prominent part of personal details.
- Autosave resets its deduplication state on section entry, saves again on navigation, and does not clearly expose a failed save. Rapid navigation has no common guard.
- Session expiry immediately navigates away from unsaved writing.
- `Application::run()` writes an email-verification audit event on every request, although the real verification action already writes its event.
- The shared variable TTF is 876,576 bytes. A locally generated WOFF version can reduce the transferred font without a runtime dependency.
- Template rendering and ownership boundaries already exist. These need regression checks rather than replacement with a new framework.

## Acceptance and evidence

Verification results and remaining limits are recorded here after implementation. Local browser checks cannot establish production p75 Core Web Vitals, physical iOS installation behaviour, legal compliance or universal ATS compatibility.

Reference standards: [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Core Web Vitals](https://web.dev/articles/vitals), [OWASP object ownership guidance](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).

## Completed changes and verification

### Phase 1: shared foundation

- Green was selected from the existing mark, with a darker action color for readable white labels. Semantic tokens now live in `main.css`. Product components consume those tokens; the editor layout is owned by the rewritten `stepper.css`.
- Removed competing editor rules from `workspace.css`. No framework or runtime dependency was added. Admin layout was preserved.
- Existing Inter typography remains. The common Latin UI font now transfers 174,372 bytes instead of 876,576 bytes, an 80% reduction. A full WOFF2 serves other supported character ranges. Original static document fonts remain for PDFs; unused variable TTF and intermediate WOFF assets were removed.

### Phase 2: landing and mobile application

- Rebuilt the landing composition around an application desk, candidate starting points, actual template switching and a resume-to-letter walkthrough. Public examples are explicitly fictional; sample suggestions do not call an AI provider.
- Added short transform/opacity transitions, intersection-based section reveals and near-viewport template loading. Reduced motion bypasses animated reveals. Updated the social image to the green identity and actual Ashraf Zaini document.
- Mobile editing now uses a 56px header, a native bottom section sheet and contextual bottom controls. Contact details appear before the optional photo. Other workspace pages share a compact bottom destination bar.
- PWA checks passed in a regular local Chrome profile: installability diagnostics, standalone manifest, login start URL, offline reconnect screen and exclusion of private routes from caches. Installed-device behaviour on physical iOS/Android was not exercised.

### Phase 3: editing and account workflows

- Autosave serializes writes, skips unchanged content, guards rapid navigation and exposes pending/error/retry states. An unchanged section does not create another save request when the user continues. Incomplete personal details can be kept as a draft; validation still applies when continuing or exporting.
- Offline edits stay in the open page and retry when connectivity returns. Expired authentication opens a dialog, with sign-in in another tab and reconnection to the original account. No draft or password is persisted to browser storage. Closing an unsaved page still risks losing it; a browser leave-page warning is used.
- Section skipping no longer clears existing content. Writing guidance remains expandable and uses factual examples. Form errors are associated with inputs for assistive technology.
- Corrected asynchronous button/form references in template application, session reconnection and password updates. Guarded unavailable service-worker registration. The dashboard gives the saved resume priority over AI quota information, with readable foreground/background contrast.
- Browser checks passed at 320, 375, 390, 430, 768, 1440 and 2560px, including all ten sections, visible footer controls, section-sheet layout, duplicate-save prevention, simulated failed saves, offline retry, expired-session recovery, letter save/reload, actual PDF preview, template/content preservation, document settings, profile save and password form completion. No page exceptions remained in the passing suites.

### Phase 4: documents

- Inspected all ten designs. Their existing mastheads, typography, date columns and section-label treatments provide meaningful differences, so the renderer was preserved.
- Rendered and checked 31 actual PDFs: ten normal resumes, ten three-page resumes with longer content and names, ten matching letters and one sparse resume. Every file contained selectable/extractable text. No blank pages or text outside the checked page margins were found. The template collection and an individual cover letter were visually reviewed.
- Template selection now distinguishes side-column section labels and avoids a blanket ATS compatibility claim. Portal parsing varies, so the selection guidance suggests simpler options where appropriate.
- Server export endpoints now require name, valid email and phone; empty cover letters cannot be exported. Client errors display the server's explanation. Incomplete resume previews remain available.

### Phase 5: security, reliability and performance

- Removed the false email-verification audit insert from every API dispatch. The real verification action still records its event. Removed a duplicated template validation clause.
- Two temporary accounts verified that another user's resume, mutations, PDFs, letter read/edit/delete and letter previews/PDFs return 404. Missing CSRF and wrong Origin return 403. Invalid templates return 422 and invalid uploaded image bytes return 400. Private responses use `no-store`; private application paths are denied.
- Existing SQL parameterization, server sanitization, image validation, ownership checks, private storage, rate limits and AI context filtering were reviewed and retained. No live AI, external email or Google sign-in credential flow was exercised in this phase.
- `composer validate --strict`, PHP syntax/autoload/page assets, changed JavaScript syntax and the dependency audit passed. The advisory feed returned no advisories for the locked dependencies on 28 October 2026.
- Cold local Chrome measurements used 100ms network latency, about 1.6Mbps download and 4x CPU throttling. LCP was 2,068ms at 390px and 2,280ms at 1440px. CLS was 0.0449 and 0.0018 respectively. Sampled interaction durations were 64ms; these are lab interaction samples, not production INP percentiles. Local warm resume PDF and cover-letter PDF requests took 464ms and 304ms in the passing workflow run.

## Remaining verification and next work

- Production p75 Core Web Vitals require real field measurements after deployment; local results do not establish them.
- Physical iOS/Android installation, keyboard, safe-area and screen-reader checks remain. Automated responsive and keyboard/dialog checks are not a complete WCAG 2.2 AA audit.
- The document tests cover normal, sparse and longer Latin-script content. Additional fonts and tests are needed before promising CJK/Tamil or other script coverage, and unusual employer portals need their own parsing checks.
- Account recovery by email, external Google sign-in, live AI output and SMTP delivery retain their existing integration behaviour and need deployment-specific checks. No PDPA compliance certification is claimed.
- Administration remains a later design phase. No database migration is required for this update. The existing local `.env` settings have been retained.
