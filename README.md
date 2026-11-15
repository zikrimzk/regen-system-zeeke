# ReGen Resume Builder

**Commercial pricing refresh:** one Pricing module manages packages, individual prices and promotions. Each package chooses a large Hero card or a One-line offer, with separate Store sections, landing visibility and six theme-aware coin colours. User accounts now has a Packages tab for multiple grants, adjustments, replacements and revocations, including explicit, balance-checked token corrections. Unlimited functions, Basic/Premium collections and limited free claims remain available. Features now require their explicit package benefits by default. Token fallback must be enabled per feature. [HitPay checkout and payment history](docs/HITPAY_CHECKOUT.md) can be enabled after sandbox verification. The cover-letter layout, saved dates and recipient address have also been revised. See [strict access and cover letters](docs/STRICT_PACKAGES_AND_COVER_LETTERS.md), [account packages and layouts](docs/ACCOUNT_PACKAGES_AND_LAYOUTS.md), [package offers and the landing refresh](docs/PACKAGE_OFFERS_AND_LANDING.md) and [template packages and token protection](docs/TEMPLATE_PACKAGES_AND_SECURITY.md). Existing installations must apply missing migrations through **027_mochi_personal_coach.sql**. Pricing keeps promotions inside the package editor and includes a Payment history tab, and notification preferences are in Profile.

The admin control centre now includes scoped read/change/export access, reporting, support workflows, consent-based alerts, persistent bonus credits, User Feedback and configurable campaigns. **Existing installations require migrations through 027; notification delivery requires the cron worker.** See [the refinement and deployment guide](docs/ADMIN_REFINEMENT.md). The latest authentication, landing, cover-letter and campaign updates are in [the November 6 UAT status](docs/UAT_STATUS_2026-11-06.md). Managed private-channel delivery, complete maintenance controls and private saved-resume viewing are documented in [Live operations](docs/LIVE_OPERATIONS.md), including PHP-only DirectAdmin prerequisites and the managed service setup guide.

The latest update adds [permanent ReGen tokens, configurable feature pricing, token packages and private support attachments](docs/TOKEN_STORE_PHASE_ONE.md), along with user-side live alert feedback and a simpler maintenance editor. AI allowance credits stay separate from the permanent balance. Payment checkout remains disconnected.

The November 2026 template redesign keeps the same **16 designs: 6 Standard and 10 Premium**, with equal quality standards, 12 text-only layouts and 4 dedicated portrait layouts. It adds sharper density-aware PDF previews, lossless high-resolution thumbnails, tighter default spacing, six genuine bundled font families and controls for typography, margins, spacing, dates and portrait framing. See [the design standard, research and validation](docs/TEMPLATE_DESIGN_STANDARD.md). No database migration is required.

The public page now demonstrates the writing workflow instead of promoting appearance modes, uses consistent local typography and adds restrained pointer depth. Mobile input handling adapts to software-keyboard viewport changes. See [the landing and mobile update](docs/LANDING_MOBILE_UPDATE.md), including the remaining physical-device UAT scope.

The writing update adds saved application context, summary/objective choices, optional academic CV sections and a more honest local writing review. It also updates the AI editing rules and cover-letter guidance. See the [tip-by-tip writing standard](docs/WRITING_STANDARDS.md) and [exact runtime prompts](docs/AI_WRITING_PROMPTS.md). No database migration is needed for these writing features.

The resume engine now uses consistent spacing, full-width reading flow and bundled document fonts. The collection has **16 designs: 6 Standard and 10 Premium**, all currently available. See [the resume engine update and validation notes](docs/RESUME_ENGINE_UPDATE.md) for PDF checks, preview generation and compatibility details. This template update needs no additional database migration.

The latest UAT follow-up makes Assist me a prominent optional dialog with simpler questions, fixes Next-button validation, and restores account photos across the workspace. No new migration is required beyond **011_assistance_and_admin_access.sql**. Follow [the Assist me update notes](docs/ASSIST_ME_UPDATE.md) before uploading the rebuilt ZIP. Earlier device-history changes are covered in [the UAT checklist](docs/UAT_UPDATE.md). Optional integration checks run with `php scripts/check-ai-database.php` and `php scripts/check-session-history.php` against a local development database.

ReGen runs on PHP 8.3+ and MySQL/MariaDB. The frontend is plain HTML, CSS and browser JavaScript. Production does not need React, Node.js, npm, a frontend build, Composer commands or terminal access.

## Local development

1. Run `composer install` on your development computer.
2. Import `database/schema.sql` into your local database. For an existing database, apply only the migrations it has not received.
3. Configure the single root `.env`. The current local development settings have been retained. `.env.example` is a blank production template, not a second configuration source.
4. Run `php -S localhost:8080 -t public public/router.php` and open `http://localhost:8080`.

`Config` reads only `.env`; it does not load PHP configuration files, production override files or inherited shell configuration. Values can be quoted. Double quotes and backslashes inside double-quoted values use `\"` and `\\`. Secrets stay out of Git and browser assets.

## Deployment

The prepared upload archive is `release/regen-php.zip`. Extract its contents directly into `public_html`. Dependencies and the browser PDF library are already included. Follow [the first-install and update instructions](DEPLOYMENT_DIRECTADMIN.md).

For future releases, run these commands on your development computer:

```powershell
composer install --no-dev --prefer-dist --classmap-authoritative
composer release
```

The archive excludes your `.env`, Node packages, test scripts, temporary output, Git history, development router and user uploads. A normal update therefore preserves the server configuration and uploaded files. Do not zip the entire development checkout.

Every push to `main` builds a downloadable ZIP in GitHub Actions. FTPS deployment remains available through **Run workflow → deploy**; it is an explicit action and requires the existing production FTP secrets. CI audits locked dependencies before packaging.

## Code structure

```text
php/
  bootstrap.php          Runtime startup and error handling
  src/Application.php    Request dispatch and access checks
  src/Actions/           Auth, profile, admin, resume, document and AI actions
  src/                   Repositories, validation and integrations
  views/                 Private HTML page templates
public/
  index.php              HTTP entry point
  router.php             Local development router
  css/                   Shared design tokens and page styles
  js/                    Browser interactions and section editors
  fonts/, img/, lib/     Local assets, PDF.js and required licences
database/
  schema.sql             Fresh installation schema
  migrations/            Existing database upgrades
scripts/
  check.php              PHP syntax, autoload and asset validation
  build-release.php      Upload ZIP builder
  create-admin.php       Local helper generating administrator SQL
```

Actions are grouped by feature using PHP traits; they keep the same authorization and repository boundary as the dispatcher. Add database access to repositories and validation to the existing sanitizers. Use brief uppercase comments for security or non-obvious decisions. PHPDoc type annotations retain their standard syntax. Avoid commenting obvious operations.

## Design and administration

The public website defaults to light and offers the shared light/dark/system appearance picker. Neutral surfaces, green accents, system-first typography with the bundled Inter fallback, translucent glass navigation and reduced-motion-aware transitions provide one visual language. `main.css` owns semantic theme tokens; `appearance.css` owns the current materials and component treatments; `theme.js` applies appearance before first paint. Optional storage consent controls whether appearance is remembered between visits. The landing collection scrolls horizontally, and its separate sample theme switch affects only the illustrative workspace.

Email now supports Laravel-style `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME`. Existing email keys remain supported. See [the DirectAdmin mailbox guide](docs/EMAIL_DIRECTADMIN.md).

All pages use the same self-hosted Inter typography, green actions, neutral surfaces, spacing tokens, buttons and visible keyboard focus. User screens keep task-oriented navigation; admin screens keep a sidebar because they manage eight operational modules. The template gallery, resume editor, document preview, cover letters and profile each retain layouts suited to their tasks. The shared dialog helper contains keyboard focus and returns it when dialogs close.

Administrators retain account management, account status, per-user AI limits and resets, global AI policy, registration and Google login controls, maintenance mode, account feature controls, session limits and revocation, SMTP diagnostics, administrator roles and audit history. Super-admin restrictions remain in place. Connection feedback reports actual request outcomes; delayed requests cannot overwrite a newly selected admin view.

## Security and performance

The release blocks HTTP access to `.env`, private application code, dependencies, templates and SQL. Uploaded executable file types are blocked. Authenticated mutations retain CSRF protection, ownership checks and shared rate limits. Production suppresses exception details and records a request identifier for diagnosis. Forwarded HTTPS headers are trusted only when `TRUST_PROXY=true` is deliberately configured behind a trusted proxy.

Settings and repeated authorization checks are cached within each request. Session revocation is checked every request, while device activity writes at most once per minute. Routine user reads no longer create audit inserts; authentication, mutations and administrative access remain recorded. PDF generation and section/cover-letter AI requests release the session lock before expensive work. Existing lazy PDF loading, progressive page rendering and draft reuse remain intact. Text assets are compressed by Apache. The ZIP builder fingerprints CSS/JavaScript references automatically, so changed assets refresh on each release. Protected application storage supplies caches and file-session fallbacks without depending on the host’s system temporary folder.

The obsolete Express backend, its npm manifests and packages, migration-era configuration files, unused DOCX runtime template, test suites and generated test output were removed after verification. Browser JavaScript remains essential, and PDF.js, fonts and their licences remain bundled. Google ID-token verification explicitly requires `phpseclib/phpseclib` v3 for RSA key handling, even though Google Auth lists it as optional package metadata. It and its supporting libraries are bundled in the upload ZIP. The locked release is checked for current dependency advisories before packaging.

## Validation record

The cleanup was checked with PHP syntax/autoload/asset validation, Composer validation and audit, mocked AI and deterministic ATS checks, ten-template PDF layout checks, local Google/email verification and quota integration checks, real browser workspace and editor flows, and all eight admin modules at desktop and mobile widths. A flattened release was also exercised under Apache, including private-path denial, route handling, MIME types and relocated Composer loading. Temporary database accounts were removed after checks; no live AI credits were used.

Run `composer check` before a release. Dependency and frontend behavior changes still need targeted verification during development; generated test artifacts do not belong in deployment archives.

## Public website and installed app

The root URL now serves a public landing page; sign-in remains at `/login`. Public pages, sample templates, `robots.txt` and `sitemap.xml` are dispatched before the database and session startup. The demo shows ten actual template previews plus fictional, browser-only editing, sample recommendations and a matching letter. It makes no AI requests and sends no entered demo details to the server. A chosen template follows the sign-up journey within the same browser tab.

`public/css/product.css` is the final shared UI layer for the landing page, user workspace and administration. It uses the existing self-hosted Inter family, neutral surfaces, deep green text and green actions. The document designs remain independently selectable; public template previews use each design's default document font. Keep semantic headings, visible focus and 44 px minimum primary touch controls when extending the UI.

`manifest.webmanifest`, install icons, `pwa.js` and the root `sw.js` provide progressive web app support. The install control uses a native browser prompt when available and platform instructions otherwise. Installation requires HTTPS in production and browser support. Private workspace pages, API responses, photos and generated PDFs never enter the service worker cache. Public landing/offline pages, explicitly allowed assets and fictional sample previews may be cached. Editing, saving, real AI and PDF downloads still require a connection. Workers update normally after open tabs release the previous worker; there is no forced reload of an editor.

The release builder fingerprints both page assets and the worker cache version. HTML contains canonical/Open Graph/Twitter metadata, a social image and factual SoftwareApplication/Offer/Organization microdata. Production robots/sitemap URLs use `APP_URL`; development stays `noindex`. Private pages and demo endpoints send indexing exclusions. Search ranking or rich-result appearance is not guaranteed.

October 2026 verification covered 320–2560 px public layouts, interactive template/detail/recommendation/letter flows, the actual user/admin views, authentication pages, installability checks, offline landing/fallback behavior, and inspection of Cache Storage for private data. Verification helpers and temporary accounts are removed after use.

## Candidate product design and remembered sign-in

The public website and application use a candidate-focused product layout with a green action palette, explicit resume-building steps and consistent Inter typography. Candidate starting points, actual template previews, sample writing reviews and matching cover letters form the public walkthrough. Ten expandable writing guides support the real editor. Samples use Zamir Zaini and are labelled fictional. Landing previews use `ResumeTemplate` output and matching demo letters use `CoverLetterTemplate`; login and registration now share a lightweight application story without a PDF iframe. The renderer fingerprint prevents an older cached sample appearing after a design update. Product copy does not use typographic em or en dashes; pasted text can still be normalised safely.

The PWA starts at `/login?source=installed`. A valid user session resumes the workspace. User authentication is kept in a persistent HttpOnly cookie for a maximum of 86,400 seconds from sign-in, including browser/app restarts and inactivity. Rotation preserves that original expiry. Passwords are never copied into local storage, IndexedDB or the service worker cache. Logout and revoked sessions still end access immediately. Administrators keep their configured shorter idle timeout. PHP file sessions use an isolated application directory so other applications cannot apply their garbage-collection timing to ReGen sessions.

Local checks verified the personalised demo workflow, guided editor sections, saved content, responsive layouts, restart persistence, 23-hour inactivity and forced reauthentication after 24 hours. The November authentication redesign preserves the existing sign-in and registration handlers. The later live-operations release requires migrations 017–018.

## Product experience refresh

The user experience now follows the logo's green identity. Shared semantic tokens live in `public/css/main.css`, reusable product components in `product.css`, the complete editor layout in `stepper.css`, and the public application desk in `landing.css`. The editor no longer relies on competing layout overrides in `workspace.css`. On small screens it uses one compact header, an accessible native section sheet, contextual navigation and secondary photo entry. Other workspace screens use a shared mobile destination bar. Administration retains its existing layout.

Autosave now serializes writes, skips unchanged payloads, guards rapid navigation and exposes pending, failed and retry states. Offline changes remain in the open page and retry on reconnection. Expired sign-in opens a recovery dialog so the user can authenticate in a separate tab without discarding the open draft. Recovery checks that the same account reconnects. Private writing is not put in local storage or the offline cache, so closing an unsaved page still risks losing it; the editor shows a browser leave-page warning.

Public template frames load close to the viewport. UI fonts use a 174 KB Latin WOFF2 subset and a full WOFF2 for other supported character ranges. PDF generation retains the original document font files. Export endpoints require contact details and reject an empty cover letter; previewing an incomplete resume remains available. See [the audit and verification record](docs/PRODUCT_REVIEW.md) for measured results and remaining work.
