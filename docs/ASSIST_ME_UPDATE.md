# Assist me and admin access — 5 November 2026

Assist me sits inside ReGen AI alongside Refine. It can draft into empty fields from guided notes in any language; output follows the existing professional English writing policy. A prominent Assist me button opens a separate dialog with two short questions and examples. Two extra questions are available under Add more detail (optional). Users review a draft before applying it, choose an existing entry or skill group, and can add to or replace its wording. Editing or removing the target before applying protects the newer text. Notes stay in memory during section navigation and are not saved into resume content or browser storage.

There are 15 question sets: summary/objective, experience, projects, activities, skills, achievements, certifications, research, publications, teaching, presentations, grants/funding, affiliations, interests and custom CV sections. The first two answers are required only when Generate draft is selected; they are outside the resume form and never block Next, saving or section navigation. The other two provide optional detail. Contact fields, references and structured education details stay manually entered. Project descriptions and contribution bullets have separate targets. CV question sets follow each selected subsection, including publication status, author order and funding status. Publication author names explicitly supplied as citation facts are allowed; contact details remain blocked.

Generation uses the existing Responses API integration and key. It uses strict structured output, bounded notes, privacy checks, redacted writing preferences, and validation against unsupported numeric claims, repeated or empty results and invalid formatting. The model is instructed to translate faithfully, preserve qualification status and support roles, and avoid invented accomplishments. Users still review factual accuracy.

## Token accounting

Default cost is 1 token for each successful Assist me, Refine, cover letter or new review comment. Admins can change each price independently (whole numbers 0–1,000), alongside the allowance, renewal period and per-user overrides. The UI shows current prices. Assist me, Refine, cover letters and new review comments reject a changed displayed price before generating and refresh it for review.

Requests hold capacity for at most ten minutes while the provider runs. They do not increment charged usage until validated success. Failure releases the hold; a crashed worker's hold expires without charge. Parallel workers lock the usage row before reserving and cannot spend the same capacity. Settlement is idempotent and preserves the price reserved at request time. Legacy pending reservations retain their previous refund behaviour during upgrade. Cached reviews and applying a draft are free.

## Upgrade and temporary login

Apply `database/migrations/011_assistance_and_admin_access.sql` once, after missing earlier migrations, before replacing the PHP application. Do not apply it after importing the fresh schema. Upload the new `release/regen-php.zip`; the package contains no `.env` or user uploads. The existing API key and hosting configuration are preserved.

The migration provisions the reserved temporary account `admin@regen.com` with the requested password `Abcd@1234` as a normally hashed, rate-limited admin login. It works even when other admins exist, until a registered admin disables it in System settings. A personal super admin must have completed password setup first, preventing lockout. Temporary access cannot manage its own toggle or change its fixed password; create a personal account instead. Only a personal super admin can re-enable it. Disabling checks every subsequent admin API request and rejects existing shared sessions as well as new logins. Access changes are audited. The local development database has been migrated; production still requires the migration and deployment.

## Photo settings and PDF check

Photo visibility comes entirely from the selected template. The old checkbox and standalone photo-visibility write are removed, including the legacy document-settings persistence. Four portrait templates retain framing, placement and crop controls. Text-only designs ignore any old saved photo flag. Updated asset versions and the release's content fingerprints refresh old scripts and styles.

All 16 sample PDFs were regenerated. Checks verified embedded fonts and selectable text; all four sample portraits are 480 × 640 at 576 DPI in their 60-point frames. Rectangle checks across 36 sample and customization documents found no text/image overlaps. The source photo still determines its real detail; increasing a small upload cannot restore missing image information.

## Verification

- `composer check`: PHP syntax/autoload/assets; 63 public site checks, 182 template checks, 41 writing checks, 241 Assist me checks and 24 mail checks. Provider fixtures use mocked transport and spend no API credits.
- `php scripts/check-ai-database.php`: 34 isolated database assertions, including eight simultaneous workers competing for three tokens, success/error/expiry/idempotence, independent prices and bootstrap lockout prevention. Requires a local development database and create/drop permissions; removes its uniquely named test database.
- Browser checks use the real action routes and an isolated database with mocked provider responses: Malay notes to English summary, an empty work entry, selected-entry isolation, draft review/application, edit protection, different CV questions, and changed-price rejection before a new generation. Errors leave the balance unchanged. The real local development admin credentials also opened the dashboard.
- Twelve HTTP checks verified admin sign-in, registered-admin disabling, existing shared-session rejection, re-enabling and price validation. No live user content was changed.
- One live OpenAI request using generic Malay sample notes and the approved existing key produced a valid English objective. No personal resume content was sent for that check.
- The actual 390-pixel frame had no horizontal overflow. Mobile viewport regression checks passed 13 assertions; PWA privacy/cache checks passed 36.

Temporary browser fixtures and their database are removed after verification. No production deployment is performed by these checks.

## UAT usability fixes — 5 November 2026

This follow-up needs no new database migration beyond 011. Deploy the refreshed ZIP; existing configuration and photos are preserved.

Assist me is now a visible primary action in each supported section. Refine has a separate explanation for users who already have text. The dialog asks two plain-language questions, each with a concrete example. Optional detail stays collapsed. Only Generate validates the assistance answers. Closing with blank or partial answers leaves Next and the resume form usable. Dialog notes remain in memory during navigation; results that complete after closing can be reviewed when the same target is reopened. The review has a separate bordered draft, readable line spacing and a dedicated footer for Edit answers and Use this draft. Escape closes the dialog and returns focus to Assist me. A request is charged only after valid success, as before.

The blank account avatar came from a background shorthand resetting the portrait's crop settings, plus dashboard initialization discarding the photo. Avatars now use a properly cropped image element with initials while loading and on error. Builder, dashboard and account settings receive the current photo consistently. An authenticated `/api/profile/photo` endpoint serves only the signed-in account's uploaded image with private, no-store caching; account metadata sends a URL instead of repeating the full image payload. Resume photo visibility still follows the selected template independently.

Browser regressions covered Next before opening assistance, after empty Generate validation and after closing partial answers; draft generation/application; answer persistence; avatar load; light/dark themes; and 320/390 px mobile bounds. A pending draft survived closing and switching sections without enabling a duplicate generation; a simulated provider error retained answers, left the token balance unchanged and allowed Next afterward. A deliberately broken photo displayed initials instead of an empty circle. The first two required fields are in the dialog, with zero assistance inputs inside the resume section's validation scope. Eight HTTP assertions covered photo authentication, ownership, delivery, no-photo fallback, private caching and compact metadata. Five additional isolated database assertions cover account-photo lookup and ownership. No real user records were modified and no AI credits were used for these UI checks.
