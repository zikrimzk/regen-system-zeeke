# Phase 02A · Release gate

**Phase 03 is held for design sign-off.** Phase 02A is implemented in the current working tree. The visual evidence and remaining testing below determine whether this revision is suitable for acceptance.

## Scope and compatibility

| Area | Changed files |
| --- | --- |
| Public | `php/views/landing.html`, `php/src/PublicSite.php`, `public/js/landing.js`, `public/css/landing.css`, `public/css/public-interface.css`, and the two new `public/img/kl-skyline-*.webp` renditions. |
| Shared visuals, navigation and writing | `php/src/{InterfaceText,Navigation,PageRenderer,WorkspaceShell}.php`, `public/css/{tokens,interface,site}.css`, `public/js/{feature-access,mochi}.js`. |
| Candidate workspace | `php/views/dashboard.html` and `public/js/dashboard.js`. |
| Resume Studio | `php/views/builder.html`, `public/js/{app,stepper,assist-me}.js` and new `public/js/studio.js` and `public/css/studio.css`. |
| Supporting screens | `php/views/{cover-letters,templates,mochi}.html`. |
| Checks and reports | `scripts/{check-page-assets,check-site}.php` and the five Phase 02A documents under `docs/regen-v2`. |

The verified architecture is the existing custom PHP 8.3, browser JavaScript, MySQL and DirectAdmin setup. No database migration is required. Existing account, resume, cover-letter, template, quota and payment records use the same storage. The legacy aliases, signed-in registration redirects, maintenance and ownership policies continue to govern the original routes. The explicit preview pane uses the same document endpoint and access checks as the PDF preview workflow.

## Checks performed

- Composer checks passed for syntax, versioned assets, the public asset budget, route policy, all 16 templates, writing, mocked assistance, Mochi and mail configuration.
- The isolated Phase 01 HTTP and Store HTTP suites passed with synthetic accounts and local MySQL.
- The Node client, commerce, mobile viewport, PWA and realtime suites passed 100 assertions.
- The integrated Chrome run passed 48 assertions and reported no page-script errors. Expected 401 responses followed clearing the candidate session. The visual review covered the rendered landing, workspace, Studio, letters, Mochi and admin captures. The focused follow-up passed four assertions covering dark layouts, dashboard retry and the phone template picker.
- A local public release ZIP was built and checked for integrity, inclusion of the Studio and skyline assets, and exclusion of local configuration and the development router. See the visual QA record for the bounds of local browser evidence.

## Remaining gates

1. Obtain Phase 02A design acceptance after reviewing desktop and phone captures.
2. Verify physical-device keyboard behavior, assistive technology and the provider-enabled writing workflow in a suitable staged setup.
3. Keep missing Malay legacy copy and provider messages visible in the handoff.
4. Verify production-only integrations with the approved staging environment when available. This phase used synthetic local data and an isolated runtime.

See [design audit](02a-design-audit.md), [design system](02a-design-system.md), [UX decisions](02a-ux-decisions.md) and [visual QA](02a-visual-qa.md).

## Function reports

### Public discovery

- **User** Compare designs and start a resume from the first screen.
- **Result** The same fictional candidate appears in actual published layouts. Each selection points to its real PDF sample.
- **Admin** Manage published designs and offers through existing controls.
- **Result** Catalogue settings determine which real content appears.
- **UI/UX** A strong reading order puts the task and action before the Kuala Lumpur illustration on phones. A small comparison makes choices manageable.
- **Backend** `PublicSite` reads `TemplateManagement` and existing pricing services. The sign-up action uses existing signed-in and guest handling.
- **Testing** Compare the desktop and phone visual evidence and the publication/offer results in the QA record.

### Candidate workspace

- **User** Continue a saved resume or start with a published design, open saved letters, and use preview or download where available.
- **Result** The saved title, next incomplete section, template and saved time are visible. Empty and error states have a specific action.
- **Admin** Apply existing availability and account entitlements.
- **Result** Writing-assistance copy reflects provider availability and the actions still use the server's checks.
- **UI/UX** The document owns the main column. Secondary lists are disclosed when useful, and the template thumbnail contains fictional sample data.
- **Backend** `/api/dashboard`, existing pricing UI and protected PDF routes.
- **Testing** The visual QA record distinguishes browser states from server-side payment and ownership assertions.

### Resume Studio

- **User** Work in the real sections, track or retry saves, change a permitted template and check the saved PDF or current draft before export.
- **Result** A section, the form and the saved-preview pane have separate regions. On phones the section picker and draft preview leave the form at full width.
- **Admin** Keep existing template visibility, pricing and private-document access.
- **Result** The same protected endpoints authorize each action.
- **UI/UX** Named commands, visible save feedback and an explicit stale-state message help the user distinguish edits from the actual saved page.
- **Backend** Existing `Stepper`, `Api.saveSection`, `ReGenTemplates`, document settings, PDF.js and PHP document handlers. The dashboard's design link opens the existing picker in an owned Studio using `designs=1`. The regular first-resume template route retains its original behavior.
- **Testing** The QA record covers actual saves, rendered PDF text and responsive layout. Check the remaining provider and physical keyboard scenarios before release.

### Cover letters

- **User** Open, create and edit a letter, access optional recipient/job context, and save or review using existing controls.
- **Result** The letter body reads as the primary writing surface and keeps the existing resume relationship.
- **Admin** Retain existing letter creation and AI settings.
- **Result** The same limits continue to apply.
- **UI/UX** Shared typography and a quieter editing header give space to the letter. Optional details stay collapsed.
- **Backend** Existing `CoverLetterRepository`, letter handlers and PDF endpoint.
- **Testing** The letter lifecycle joins the isolated HTTP and browser checks. Visual QA records the settings used.

### Mochi and writing assistance

- **User** Open Mochi from the Studio or visit the room. Review writing drafts when the account and provider allow.
- **Result** The companion can be opened from a defined place and leaves the editing surface clear. A provider-unavailable message explains a disabled Assist Me action.
- **Admin** Retain assistant, Mochi and package controls.
- **Result** The clients continue to reflect the existing runtime policy.
- **UI/UX** A named action replaces the floating editor mascot. Instructions and unavailable states are close to the work.
- **Backend** Existing provider-status, AI and Mochi calls. Prompt and billing behavior stay in their established handlers.
- **Testing** Composer exercised mocked provider paths. Live provider interaction remains a staged check.

### Navigation and Malaysian copy

- **User** Find released tasks and switch the interface between EN and BM where supported.
- **Result** Deep links, direct refresh and document IDs/sections retain their route behavior. The interface can change language independently of authored documents.
- **Admin** Keep published offer names, contents and visibility.
- **Result** Prices and catalogue copy still come from existing data.
- **UI/UX** Use direct task names, consistent local vocabulary and Kuala Lumpur time for the saved timestamp.
- **Backend** Existing route and renderer metadata, `InterfaceText` and the current commerce formatter.
- **Testing** Browser checks include a Malay phone view and legacy editor deep link. Legacy module-local copy remains a documented design debt.

### Administration

- **User** The candidate application remains distinct from operational screens.
- **Result** Candidate navigation stays focused on available work.
- **Admin** Use scoped modules, live counts, alerts and maintenance controls in the existing separate portal.
- **Result** The dark rail and mobile account rows remain legible, with the existing capability checks.
- **UI/UX** Shared field sizes and dialog density support scanning operational information.
- **Backend** Existing admin routes, audited permissions and realtime signals.
- **Testing** The isolated HTTP suite exercised maintenance and protected actions. See Visual QA for the scope of admin browser review.
