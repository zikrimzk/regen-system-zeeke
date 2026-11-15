# ReGen 2.0 · Design system

Phase 02 applies the visual system to the existing PHP and native JavaScript app. The document templates, PDF typography, feature access and checkout still use their existing rendering and business logic.

## Type and layout

| Role | Style | Example |
| --- | --- | --- |
| Public display | 36–58 px, tight line-height | A resume for your next application |
| Page title | 28 px, 1.18 | Overview |
| Section title | 22 px, 1.18 | Resume sections |
| Dialog title | 20 px, 1.18 | Review changes |
| Body and form input | 16 px, 1.5 | Add your experience, then review the wording. |
| Navigation, labels and supporting text | 14 px | Continue editing |
| Secondary metadata | 13 px | Updated 15 November |

The interface uses the existing bundled Inter font with a system fallback and swap. Document fonts are separate. `public/css/tokens.css` defines layout, color, type, motion and layering. `public/css/main.css` binds the shared application properties. `interface.css` styles the authenticated and form layouts, and `public-interface.css` supplies the public treatment through `scripts/build-site-css.php`.

| Token | Use |
| --- | --- |
| Canvas and neutral panel | Light `#f4f6f3` and `#fff`, dark `#111b16` and `#1a2720` |
| Text and muted text | Light `#182820` and `#495b52`, dark `#eaf2ec` and `#b4c8bb` |
| Action and focus | Forest green `#166047` in light mode, jade `#8fd1ae` in dark mode, with a separate visible focus outline |
| Admin navigation | Dark forest `#152c23`, muted light text, a light readable ReGen wordmark, and a tonal active row |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40 and 48 px. Page gutters grow with available space |
| Radius | 8 px controls, 12 px panels, 16 px dialogs |
| Layering | Persistent rail, header, mobile nav and menu use named layers. Native dialogs use the browser's top layer. |
| Motion and targets | 140–200 ms for small transitions, 0 ms with reduced motion. Primary controls target 44 px. |

Use one direct heading for each task. Add a description when it helps decision-making, as on offer comparison. Use neutral lines and whitespace to separate rows, reserving color for selection, focus and status. Prefer a short summary above a dense table, a visible labelled action, an inline form error beside its input and a skeleton that resembles the loaded content. Avoid repeated uppercase eyebrows, decorative row numbers, color outlines on each panel, giant heading jumps, background glass and hover-only document actions.

The Overview keeps the active resume, progress and three existing document actions together. Section status is expressed in words and linked to the corresponding editor section. Quick links and real token balances are secondary. Loading uses a shaped placeholder, the empty state leads to the actual template catalogue, and failures provide retry. Preview uses a native dialog with Escape and focus return. Billing shows existing one-time offers, validity periods and real balances. Shared native inputs, confirmations, upload controls, toasts and tabs keep their workflow-specific behaviour.

## Navigation and compatibility

- Public home leads with the bundled fictional resume for Zamir Zaini, operations specialist in Melaka. Its interactive resume and cover-letter sample uses the existing renderer and clearly describes the sample writing action. `/pricing` reads the same published catalogue and marketing policy as the Store. It shows up to three featured packages first and offers more only when more exist. Admin-maintained copy and offers are rendered from their existing records. A custom display name is read from existing System settings. Canonical links use the configured application URL.
- At 1024 px and wider the candidate workspace uses a rail and one header notification bell. From 761 to 1023 px it uses labelled icon controls in the compact header. At 760 px and below it uses Overview, Resumes, Letters and More in a bottom rail with safe-area padding. More is a native dialog and exposes profile, billing, settings and upcoming destinations. The resume editor keeps its dedicated section and preview controls. Small sign-in screens put the form first.
- Admin navigation uses grouped modules backed by the permissions returned from the existing `/api/admin/me` endpoint. Scoped reads, writes, reauthentication and audit still rely on server checks. Links in admin view history use `/admin?view=…` and can be reloaded. Feedback/support work counts and the single alert bell use their existing data and live updates. Straightforward tables stack their labelled rows at 640 px and below. Dense comparisons retain a contained scroll area.
- `/resumes` uses the existing primary resume and template workflows. `/profile` and `/settings` enter the existing account settings surface. The new `/tailor`, `/jobs/saved`, `/applications` and `/interview` pages identify upcoming features. They offer a way back to Overview and do not create data or send requests for future capabilities. Existing candidate URLs, payment return queries and editor IDs/sections keep their same endpoints and access rules.
- EN and BM are selected through the shared language keys. The switch keeps the active URL and query, and an explicit choice persists through the browser session. A click also keeps the current fragment. RM uses the catalogue currency and dates introduced here use Asia/Kuala_Lumpur. Saved candidate text, authored brand and package copy, fixed document examples and existing provider responses retain their saved language. Interior legacy editor, admin, help and recovery workflow copy is only partially translated.
- `/design-system` is available in the development and test environments. It exercises typography, form states, a real native dialog and the appearance control.

## Reproduce the visual review

Use a local environment with disposable synthetic accounts, one saved resume, a support-only administrator and three published synthetic offers. Enable reduced motion and test both color schemes. Exact sizes below are CSS viewport widths. Reject or dismiss optional storage in the public flow before capturing the full page.

| Screen | Widths | Verify |
| --- | --- | --- |
| Home and pricing | 360, 390, 768, 1024, 1440 | Wordmark and menu fit. Real sample and writing preview load. Choose BM and check the localized shell, RM and offer limits. Confirm a disabled publication flag hides offers. |
| Sign-in, registration and verification | 360, 390, 768, 1440 | Form is first on a phone, labels remain visible, errors stay near their input. Toggle password visibility and tab through the fields. |
| Overview and resume library | 360, 390, 768, 1024, 1440 | Compare empty and saved accounts. Test More, each destination, active state and one bell. Open Preview and close it via Escape, then confirm focus returns. |
| Resume editor and cover letters | 360, 390, 768, 1024, 1440 | Refresh a legacy editor URL with a document ID and section. Confirm editor controls remain reachable, type in a form, open or close preview and check it returns to the canvas. |
| Admin overview and accounts | 360, 390, 768, 1024, 1440 | Check dark sidebar contrast in light mode, drawer closes and focus returns, scoped menus, readable table labels, pending counts, alert bell, and Back/refresh on `?view=users`. |
| Showcase | 390, 1440 | Toggle appearance, focus the controls, inspect disabled and error styles, open and close the native dialog. |

## Before and after

The previous Overview spread the active resume, status and destinations across separate command and destination cards. The new document summary puts the next editor action, preview and download in a single group and places completion immediately above those actions. The row list helps a candidate jump to an unfinished section without inspecting a grid. Mobile keeps the document actions in the reading order and moves secondary destinations into More.

## Implementation scope

New files are `php/src/InterfaceText.php`, `php/src/Navigation.php`, `php/views/pricing.html`, `php/views/upcoming.html`, `php/views/design-system.html`, `public/css/tokens.css`, `public/css/interface.css`, `public/css/public-interface.css` and `public/js/interface.js`.

| Modified area | Files |
| --- | --- |
| PHP routing and rendering | `php/src/{Http,PageRenderer,PublicSite,Routes,WorkspaceShell}.php` |
| Public and auth views | `php/views/{landing,login,register,verify-email,reset-password,admin-login}.html` |
| Candidate and admin views | `php/views/{admin,builder,cover-letters,dashboard,feedback,mochi,notifications,payments,profile,store,support,templates,token-activity}.html` |
| Shared and page scripts | `public/js/{admin,auth,commerce-ui,dashboard,landing,landing-pricing,mochi,theme}.js` |
| Existing CSS and public asset build | `public/css/{landing,main,site}.css` and `scripts/build-site-css.php` |
| Test and route documentation | `scripts/check-page-assets.php` and `docs/regen-v2/01-route-map.md` |

Database migration count is zero. Existing maintenance, ownership, admin capability and payment controls still run at their usual entry points.

Production checkout, Google sign-in, mail and managed realtime require staging verification with their normal approved configuration. Navigation and presentation are Phase 02. Career profile data, job storage, applications, interview tools and changing how paid PDF exports are settled belong to later phases.


## Local verification

- `composer check` passed PHP syntax and assets, the 27 navigation and localization assertions, the 139 access and route assertions, and the template, writing, assistance, Mochi and mail configuration suites.
- The Node API, commerce, mobile viewport, PWA and realtime checks passed 100 assertions with simulated events or transport.
- The Phase 01 HTTP suite passed 90 assertions against disposable MySQL and local PHP, including maintenance protection for the new candidate routes and the existing PDF accounting path. The Store HTTP suite also passed against synthetic records.
- Chrome exercised landing, RM pricing, sign-in, Overview, library, editor aliases, cover letters, profile, billing and the upcoming routes. The separate administrator run exercised accounts, search layout, the management drawer, Templates, Support, Announcements, System settings, maintenance, alerts, the design showcase and a delegated support account. The responsive layout checks used 360, 390, 768, 1024 and 1440 px. A focused candidate run checked the painted PDF and its accessible text, Escape and focus return, and the system dark theme. The completed checks reported no page-script errors.
- A disposable public release ZIP was checked for archive integrity, the new views and assets, and exclusion of local-only configuration and the development router. Verification used only the local release artifact.

Manual release QA still includes iOS Safari and physical-phone keyboard behaviour, a screen-reader pass, and staging-managed Google sign-in, mail, payments and realtime. The bilingual shell is ready for use. A translation pass for the interior of older workflows remains open.
