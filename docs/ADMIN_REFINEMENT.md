# Administration, feedback and reporting

This release extends the control centre with separate read, change and export permissions; customer satisfaction reporting; persistent bonus tokens; consent-based alerts; support configuration; and a consistent Inter typography and component system. The latest migration is **019_support_and_token_store.sql**. The permanent ReGen balance is now separate from AI allowance credits; see [the current store and support guide](TOKEN_STORE_PHASE_ONE.md). See [Live operations](LIVE_OPERATIONS.md) for the managed delivery, maintenance and private-resume controls.

## Deployment

1. Back up the database, uploads and protected storage before upgrading. Apply missing migrations in order through 019, once each. Fresh installations use the current `database/schema.sql` instead of replaying migrations.
2. Upload `release/regen-php.zip`. The standard archive excludes `.env`, user uploads, storage contents, QA fixtures and local scripts. Preserve those existing directories and credentials. Migration files are packaged under `_app/database/migrations/`.
3. Keep the minute-by-minute notification worker described in [the control-centre guide](ADMIN_CONTROL_CENTRE.md). That worker also scans application issues and processes administrator alerts. A portal visit scans issues at most once per minute. The worker needs PHP 8.3+ and the same database/configuration access as the website.
4. In **Email delivery → Configure email**, enter the host's authenticated SMTP settings, confirm your administrator password, then send a delivery test. Saving configuration is audited. The SMTP password is never returned to the browser; leaving it blank preserves the existing secret. TLS is required by this form. The protected `storage/configuration/mail.json` override takes precedence over `.env` mail values.
5. Back up `storage/configuration/mail.key` with the encrypted configuration. Losing that key prevents recovery of the saved SMTP password. Keep both private and outside public access through the supplied server rules. Initial hosting, database migration, HTTPS, scheduled jobs, provider credentials and disaster backups still require deployment setup.
6. Create a personal super administrator, finish its initial password setup and disable shared bootstrap access. Verify an actual production verification email, requested password reset and opted-in ticket email after deployment. Local delivery tests use a mock transport and cannot establish production inbox placement.

The local development database has received migrations through 019. The production host has not been changed by this work.

## Administrator access

New delegated administrators start without module access. A super administrator opens **Administrators → Module access**, records the person's responsibility and purpose, optionally chooses an expiry, selects permissions and confirms with their current password. The review step explains the resulting assignment before applying it. Signing out from administration or the customer account menu asks for confirmation and keeps the session open if sign-out fails. Assignments reject conflicting edits from another session.

- **Read** permits inspection of that module.
- **Change** permits its operational actions and requires read access. Purely informational modules do not offer this option.
- **Export** separately permits downloads of users, feedback, reports or audit data and also requires read access.

Permissions and expiry are evaluated on every server request, including existing sessions. Administrator management, irreversible deletion and global sign-out retain their super-administrator restrictions. Bonus changes require both user-account change access and AI change access. A delegated administrator can always manage their own password and notification preferences. Existing grants from migration 012 retain their previous view/change scope during migration; newly introduced reporting and feedback modules require an explicit assignment. Export access requires a new explicit grant.

## Template collection management

**Resume templates** has separate read/change access. Administrators can preview each design, see current customer selections, review recorded adoption, hide or show a design, add a Popular badge and set display order. Changes use a review step, revision checking and an audit event. At least one design must remain visible, including when two administrators edit at the same time.

Hiding a design removes it from the landing collection and customer picker and prevents new direct selections. Existing saved resumes and matching letters can still be edited, rendered and downloaded. Static sample PDFs remain public examples; visibility is a catalogue control, not a content secrecy or payment mechanism.

Current usage counts each customer's latest resume once. Recorded usage counts distinct retained customers since tracking began and includes the active selections present during migration 014. It does not reconstruct earlier template changes. Popular is a manually selected editorial badge. The catalogue and its permissions provide the management foundation for later pricing; payment collection remains disconnected. The separate Feature pricing module now controls token access, as described in the current store guide.

The landing page receives the active catalogue in its first HTML response, eliminating a duplicate catalogue request and avoiding a flash of hidden designs. Thumbnails load lazily. Customer and administrator API clients combine simultaneous identical reads without storing completed private responses; mutations invalidate pending-read reuse. Admin lists remain paginated, reports are bounded, and stale view responses are ignored. Runtime page rendering applies content hashes to every local CSS/JavaScript URL, including development views, so older cached admin bundles cannot persist behind fixed version strings. Failed module initialization or rendering displays a recoverable error instead of an indefinite loading state.

## User Feedback and bonus credits

Customers can use **Give feedback**, their account menu or `/feedback` at any time. A successful resume PDF download can also invite feedback. The invitation is limited to once in the current page session and avoids prompting again within seven days of a submitted response. It never blocks the download.

The form asks for an overall one-to-five-star rating, optional feature/ease ratings, an area and at least ten characters of honest feedback. There is no preselected star rating. Positive and critical ratings receive exactly the same first-feedback reward.

**User Feedback → Feedback settings** controls availability, the download invitation and the reward amount (default five, configurable from zero to 1,000) and maximum rewarded responses (default one). Changes affect subsequent submissions. By default, one response per account can earn a reward. Administrators can set the maximum rewarded responses from zero to 100 and the token amount per eligible response. A limit of zero pauses rewards. Increasing the limit allows previously rewarded accounts to earn again until the new limit is reached. A response counted at a zero-token reward still consumes an opportunity. Duplicate request retries do not consume another opportunity.

Bonus tokens persist until spent. Base allowance is used first, then bonuses. Active requests reserve credits; failed or expired reservations release them, successful operations charge once. Retries and concurrent first-feedback submissions cannot duplicate rewards. A disabled user AI allowance also blocks spending bonuses. Administrators can make reasoned adjustments in **User accounts → account details → Bonus token balance**. Adjustments retain a credit ledger and cannot remove reserved credits or make the balance negative.

Feedback can be marked new, reviewed, planned or resolved. Each follow-up preserves the previous notes, status, administrator and timestamp. Comments and internal follow-up are visible only to authorised administrators.

## Reports and support

**Analytics → Reports** provides UTC date filtering, rating distribution, average experience, positive-rating share, optional quality/ease ratings, feedback by area/day, support first-response timing and backlog information. Current unresolved workload is distinguished from requests created within the selected period. Satisfaction describes respondents, not the entire customer base.

Report periods are limited to 367 days. CSV exports neutralise formula-like values. Detailed feedback/audit exports include up to 10,000 records per export; select a narrower period for larger datasets. Current totals and record retention determine what can be reported.

**Support → Support settings** configures the customer welcome message, an internal first-response target and up to twenty saved replies. Selecting a saved reply inserts a draft for staff to review before sending. First-response reporting counts public staff replies and excludes internal notes. Ticket status, priority, assignment and reply actions are recorded; optimistic revision checks prevent silent overwrites.

## Notification consent and monitoring

Every customer and administrator controls their own on-screen, browser and email alerts. The customer bell shows unread inbox state independently of pop-up consent; it refreshes every thirty seconds while visible, on return to the page and after reads, including changes from other open tabs. All channels start off. **All alert emails, including security alerts, require opt-in.** Requested verification/password-reset messages remain separate transactional flows. Legacy email defaults are not treated as explicit consent. Customers must save their new choices before alert email is enabled; security and browser channels also start off.

Portal inbox records and audit/security records remain available when alert channels are disabled. Browser permission is requested only from the explicit permission button. Browser alerts work while the portal is open; this release does not provide a closed-browser push service. Delivery rechecks consent, account status and module permissions before sending queued messages. Withdrawing consent suppresses a queued alert that has not yet been delivered.

The application monitor records repeated failed sign-ins, email failures/uncertain outcomes, stalled notification processing, low application filesystem space, audit fallback records and application exceptions. Authorised administrators see issues and can acknowledge or resolve them with investigation notes. Duplicate issue keys prevent repeated notices within a detection interval. Alerts respect the administrator's chosen topics and channels. PHP logs remain the source of protected diagnostic codes, linked by request ID.

This is application monitoring. Hosting-level malware scanning, operating-system patching, external uptime monitoring and database/filesystem backups remain hosting responsibilities. Document recovery points are useful application history and do not replace disaster backups.

## Shared customer interface and investigation context

Dashboard, resume editor, letters, templates, profile, Support, Notifications and Feedback use one server-rendered workspace header, icon set and account menu. Resume and Cover letters are the primary header links. The notification bell sits next to appearance controls; Support is below Profile in the account dropdown, followed by feedback. Notification links are not duplicated in the dropdown or mobile navigation. Mobile workspace pages share Resume, Letters and Account destinations; the editor keeps its section controls while exposing the same account menu and header actions. Feedback dialogs use explicit viewport centering, keyboard focus handling and safe-area spacing. Private pages remain excluded from service-worker storage.

New support submissions retain browser/version, device family, operating system, page, CSS viewport, display mode and time zone where available. The form explains that these details accompany a ticket. Support staff can inspect this snapshot and recent retained sign-ins, then open the customer's recorded actions. Legacy tickets have no submission snapshot. Audit entries expose readable actor names, browser/device context, method, HTTP result, duration and request ID, with the underlying redacted data available for investigation. Browser/device labels are inferred from headers and are not verified hardware identities.

## Audit and validation

Authenticated API requests record actor, route, method, completion/denial/failure, status, duration and request ID. Semantic events record business changes, permission purpose, bonus reasons and support/feedback follow-up. Guest authentication failures are sampled per route/network/minute to limit log flooding. Passwords, request bodies and SMTP secrets are excluded. Database audit failures produce a minimal record in protected fallback storage for investigation. Audit records have no edit/delete interface; stronger external retention guarantees require a separate append-only log destination and database access policy.

Run `composer check`, `php scripts/check-feedback-and-access.php`, `php scripts/check-admin-control-centre.php`, `php scripts/check-ai-database.php`, `php scripts/check-template-management.php`, `php scripts/check-session-history.php`, and `php scripts/check-smtp-delivery.php` before release. Database checks create and remove isolated local databases and require a local development configuration. No AI credits or real email are used by these test scripts. Build the archive with `composer release`.

The November 6 UAT changes, campaign controls, fixed allowances and verification details are documented in [the UAT delivery notes](ADMIN_UAT_NOVEMBER.md).

