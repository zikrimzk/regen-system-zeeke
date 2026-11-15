# ReGen UAT update

## Existing installation

1. Back up your database and files.
2. In phpMyAdmin, select the ReGen database and run:

   ```sql
   SHOW COLUMNS FROM account_sessions LIKE 'history_hidden_at';
   ```

   If no row is returned, import `database/migrations/010_session_history.sql` from this checkout, or `_app/database/migrations/010_session_history.sql` from the upload ZIP. Apply it once. A fresh installation using the new `schema.sql` already includes this column; do not apply migration 010 again after a fresh schema import.
3. Upload and extract the complete `release/regen-php.zip`, preserving the server's `.env` and uploads. No email or Google configuration change is required for this update.
4. Verify `/api/health`, the profile's device history, both color themes, resume review and PDF preview. If the host disables OPcache timestamp checks, refresh OPcache through the hosting panel.

The health endpoint checks the new history column. A missing migration produces a safe 503 and a request ID for the PHP log.

## Changes

### Authentication and PWA follow-up — 30 October 2026

- Public pages now open in light appearance by default and offer the same light/dark/system control as the app. Existing remembered choices are honored only when preference storage is accepted.
- Registration has a wider desktop form, clearer spacing and full-width password fields. Mobile fields stack at 16 px. Google buttons use the supported dark outline theme, correct embedded color scheme and a visible keyboard focus ring. The floating reCAPTCHA badge is hidden only where its visible inline disclosure is present, following Google's current guidance.
- Removed the authentication sample-caption link, “Free to start. No card needed.” and the collection note about matching resume/letter designs. Removed additional redundant landing-page notes.
- Cover letters without a resume now show a dedicated starting card. Header controls fit narrow screens; letter actions use equal 48 px heights and a compact, labelled PDF action.
- Added granular cookie/storage choices, optional public caching, storage revocation, safe inline offline fallback, installation screenshots, theme-aware native launch assets and draft-aware update handling. See `PWA_READINESS.md` for the implementation, verified checks and device checks still required. This follow-up adds no SQL migration.

### Earlier UAT work

- Restored the exact supplied logo without a backing plate. Its original geometry and lettering are preserved; a CSS color filter adapts the dark artwork to dark surfaces. Light surfaces use the original colors. Native startup images use the original silhouette in white on a dark canvas.
- Removed the "Who is behind ReGen?" FAQ and "Saved document" preview label. Account menus now contain only Profile and Log out. Installation is available in Profile and on the public website.
- Increased popover separation and contrast. Workspace return controls use labelled icons. Save timestamps use subdued readable text, valid UTC parsing and the viewer's local timezone.
- Rebuilt account identity, Google linking, password disclosure and device layouts. History is paginated on the server, five entries per page. Clearing history hides signed-out or expired entries while preserving active sessions and revocation records.
- Session ID rotation now preserves the same device row, its creation time and its revoked state. An inactive history entry is not deleted from the security ledger, so clearing it cannot make a revoked cookie valid again.
- Added a dashboard overview with real cover-letter counts and direct account access. Mobile review uses full-width stacked panels and a readable score summary.
- Dashboard readiness distinguishes core detail completion from optional sections. Its current local checks are labelled accurately; a missing or older AI comment no longer makes a fresh local score appear out of date.
- Added startup images for common iPhone/iPad sizes and both orientations. An installed-app launch transition uses the original artwork and does not impose a fixed wait. Browser/OS support controls the native launch screen; physical-device verification is still needed, especially on device sizes outside the supplied image set.
- Refined the writing guide across all ten resume sections. Added live missing-detail shortcuts, summary outlines by career stage, qualification-specific guidance, bullet counts, long-point hints, skill-list cleanup and structured award/certification entry tools. Helpers run locally and do not use AI tokens. They never invent qualifications or replace existing text.
- Added keyboard-friendly entry ordering for education, work, projects, activities and references. The order is saved with the document. Adding/removing entries and normalizing field values now trigger autosave. Helper-only drafts do not mark the resume as unsaved.
- Removed nested padding from repeatable mobile forms, made skip controls leave room for subtitles, unified skill category colors, and linked field labels and hints for assistive technology.

## Validation

Browser checks use fictional local accounts. They cover 320/390 px mobile and desktop layouts, both themes, menu keyboard operation, Google-button sizing, history pagination/clearing, final review, PDF preview, and launch asset delivery. Transactional integration checks cover session ownership, bounded pagination, retained revocations and session rotation. HTTP checks cover CSRF, wrong Origin, foreign-session revocation and preservation of current access. Sample text and button contrast pairs meet a 4.5:1 threshold. These checks are not a complete accessibility, penetration or physical-device audit.

The final editor pass also checked all ten sections at 320 px with their guides open: no horizontal overflow and no unlabelled form fields. Ordering, removal autosave, skill cleanup and award/certification output were checked after reload. Summary guide choices and unfinished helper drafts leave the saved document unchanged. The final PDF rendered successfully. Automated checks passed: JavaScript syntax, Composer/PHP asset checks, 24 mail configuration assertions, 19 transactional session assertions and eight HTTP security assertions. No live AI requests or emails were sent.

Design references: [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials), [Apple web-app configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
