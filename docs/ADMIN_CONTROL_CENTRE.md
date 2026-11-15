# Admin control centre

Implemented 5 November 2026 for the PHP/MySQL application. The update extends the existing portal and adds the user support and notification destinations. It does not deploy to the hosting account automatically.

The follow-up release is documented in [Administration, feedback and reporting](ADMIN_REFINEMENT.md). Apply migration 013 after 012; the notes below describe the original control-centre foundation.

## Install and release

For an existing installation, back up the database and import `database/migrations/012_admin_control_centre.sql` after migrations 002–011. Migration 012 creates new tables without altering existing accounts or documents. A fresh import of `database/schema.sql` includes these tables. The local development database has received migration 012.

Upload the rebuilt `release/regen-php.zip`. The release includes the new pages, assets, private classes, migration and `_app/jobs/process-notifications.php`. It preserves the server `.env` and uploads. `release.json` now identifies migration 015. No new API provider or paid dependency is required.

In DirectAdmin, add a cron job that runs once per minute. Follow the [step-by-step setup and read-only diagnostic](EMAIL_DIRECTADMIN.md#start-the-directadmin-worker). Use the hosting account's actual PHP 8.3+ binary and absolute home directory:

```text
* * * * * /path/to/php /home/ACCOUNT/domains/DOMAIN/public_html/_app/jobs/process-notifications.php >> /home/ACCOUNT/regen-notifications.log 2>&1
```

Place the log outside `public_html`. DirectAdmin's minute, hour, day, month and weekday fields should each contain `*`; its command field contains the PHP command after the five scheduling fields. Local development can run `php scripts/process-notifications.php`. This command sends queued real email when SMTP is configured, so use it intentionally. The worker also expands in-app broadcasts when SMTP is unconfigured and leaves email queued.

Keep the existing `MAIL_*`, HTTPS `APP_URL`, database and session configuration. See [email setup](EMAIL_DIRECTADMIN.md). The portal reports the worker heartbeat, queue states and SMTP acceptance. This update was tested using an isolated database and mocked delivery; production SMTP acceptance and inbox placement still need verification on the host.

Create a personal super administrator and complete its password setup before disabling temporary shared access. The existing shared bootstrap account remains available until disabled according to the earlier deployment requirement. Administration has no public self-registration endpoint: super administrators provision administrator accounts, and new accounts must change their initial password.

## Access control

Super administrators have all modules. Delegated administrators, including existing delegated accounts, start with **no module permissions**. In Administrators, use **Module access** to assign only the required read, change and export permissions, with a stated purpose and optional expiry. Changes take effect on the next request, including already signed-in sessions. Hidden navigation is supplemented by server checks on every administrator API route. Unknown routes receive no permission by default.

| Module | Access granted |
| --- | --- |
| Overview | Aggregate account, session, AI, support, queue and landing totals |
| Traffic analytics | Landing views, daily visitor estimates and registration series |
| User accounts | Account details, statuses, AI overrides, device revocation, verification resend, password reset and personal-data export |
| AI usage | Global AI availability, credit allowance, renewal window and operation prices |
| Feature availability | Per-feature visibility, availability, messages and downtime schedules |
| System settings | Existing registration, identity, maintenance and session policies |
| Email delivery | SMTP readiness, delivery history and test email |
| Notifications | Broadcasts, email rules, delivery exceptions and failed-mail retry |
| Support inbox | Ticket records, customer replies, staff notes, status, priority and assignment |
| Security monitor | Recorded application security events and temporary network restrictions |
| Server and session controls | Live application health and existing session operations |
| Data recovery | Document recovery points, restoration and history policy |
| Activity log | Audited authentication and administrative operations |

Administrator provisioning, permission grants, administrator status changes, global sign-out and irreversible account deletion remain restricted to super administrators. Permanent account deletion also requires the current administrator password and an exact confirmation phrase. Last-super-admin checks use database locks. A delegated administrator can change their own password without receiving other modules.

Account edits, feature changes and ticket updates reject conflicting changes rather than overwrite another administrator's work. Authentication, CSRF, same-origin checks and rate limits remain active.

## Features and AI allowances

The catalogue currently covers 21 operations: registration, Google sign-in, resume creation/editing/renaming, templates, cover letters, four AI operations, PDF downloads, previews, portrait uploads, profile editing/email/password changes, device controls, document appearance, account deletion and support.

Each feature has enabled and visible states, a customer message, optional start/end downtime and a revision. Hidden features are unavailable through direct API/page access as well as navigation. Schedules use the administrator browser's local time and are stored/evaluated in UTC. An empty end time pauses indefinitely after the start. Existing global AI, registration, Google, email-change and self-deletion switches still apply; the feature screen identifies policy blocks. Local writing checks remain available when only AI review is paused.

User navigation refreshes feature state after returning to the tab and once per minute. The server evaluates availability on every request. Pausing a feature prevents subsequent requests; it does not cancel work already accepted by the server. Global maintenance preserves support, notifications and identity checks so users can still report problems.

An empty user AI override uses the global allowance. A value of **0 blocks all AI operations for that account**, including free operations. Values 1–1,000 set the account's allowance. These are the existing application credits, priced per successful operation, rather than the provider's input/output token counts. Failed generations retain the existing refund behavior. Usage displays exclude expired windows.

## Support and notifications

Users can open `/support` and `/notifications` from workspace navigation or their account menu. Support requests include a subject, category and description. Users see only their own requests and public messages. An administrator can assign the request to an active administrator with support access, set its priority/status, reply publicly or add an internal note. Internal note text is omitted from user responses and email. Public status changes still notify the user. A customer reply reopens a resolved/closed ticket. Stale conversation updates preserve the unsent reply and require a refresh.

Ticket creation and public staff updates create in-app notifications and queue email. Account updates, quota resets, device revocation, sign-ins, password changes, identity linking and document recovery also create relevant notifications. Document autosaves do not send repetitive emails. Optional account/support/announcement email preferences are user controlled; administrators can pause these categories globally. All alert emails, including security alerts, require user consent. Notification email is sent only to a verified current account address; verification and password-reset mail use their dedicated flows.

Broadcasts require an audience, message, explicit email choice and typed confirmation. Recipient expansion uses batches and an upper account-ID boundary captured when the campaign is queued. Per-recipient deduplication prevents repeated expansion. SMTP runs outside the user request under an exclusive worker lock. Failed attempts retry after five minutes, up to five attempts. SMTP acceptance and inbox delivery are distinct states. Interrupted attempts or a lost final SMTP acknowledgement become **uncertain** and are not automatically resent. Check provider logs before taking further action. The portal retries definite failures only.

Administrator-triggered password resets email a 30-minute, single-use link. Only a hash is stored, the raw token stays out of query strings/logs, and completing the reset revokes existing device sessions. Account-data exports exclude password hashes, identity credentials and verification/reset tokens.

## Recovery and monitoring scope

Recovery points contain the account's current resume and saved cover letters. Defaults are automatic capture before edits at most once every ten minutes, ten points per account and 90-day retention. Administrators can change automatic capture, interval, point limit and retention. The worker removes expired points in bounded batches. Deleting a cover letter creates a recovery point before deletion. Restoration creates a safety copy, updates owned documents transactionally, restores deleted letters with their original IDs, retains newer letters and notifies the user.

A document generation number changes after recovery. Writes are serialized with recovery using the account row lock. An editor opened before recovery receives a conflict instead of overwriting the restored document; its current unsaved text remains in the tab so the user can copy it before reopening. A browser refresh loads the new generation.

Deleting an account cascades its document history, support conversations, notification preferences, notifications and queued emails. Recovery points cannot recover a deleted account. Recovery points share the primary database and are **not disaster backups**. Configure separate database/filesystem backups and a tested restoration procedure through the hosting provider.

The security monitor covers authentication failures, rate-limit rejection, invalid origins/CSRF, denied admin modules and temporary restrictions on recorded hashed network identities. Repeated request-guard events are sampled per network/event per minute to limit log flooding. Blocks expire automatically and cannot target the administrator's current network. They apply to application routes; they are not a host firewall.

Server status measures database connectivity/latency/size, PHP request memory and limits, storage capacity/writability, support/mail totals and the last completed worker run. Host load is shown only if the platform exposes it. OS health, malware/antivirus, infrastructure attacks, firewall telemetry, CPU utilisation and historical uptime require hosting-level monitoring. The portal does not fabricate those measurements.

Landing analytics count server-rendered GET visits, exclude recognized bots/HEAD requests and estimate distinct daily network/browser combinations using a keyed daily hash. No analytics cookie or raw address is stored. Daily identity hashes are removed after 30 days; daily aggregates remain. The sum of daily visitor estimates is not a count of distinct people across the month, and cached offline visits are not counted. Collection starts with this update.

## Verification

`composer check` covers PHP syntax/autoloading, page assets, public pages, templates, writing, assistance and mail configuration. `php scripts/check-admin-control-centre.php` creates and removes an isolated local database to check new permissions, conflicts, schedules, quota blocks, ticket ownership/internal notes, preferences, broadcast deduplication, retries/uncertain delivery, recovery, stale-editor protection, password reset and analytics. It refuses non-local or production database configuration. No live AI credits or real email are used.

Additional HTTP checks used an isolated local preview and separate test cookies to exercise actual authentication, immediate permission revocation, CSRF/origin denial, all module reads, support updates, feature/page gates, maintenance exceptions, exports, recovery confirmation, stale editor conflicts and mocked reset-mail delivery. Browser checks exercised admin navigation, account drawers, module selection, ticket replies, all added modules, user ticket submission, notifications, light/dark surfaces and narrow layouts. Production email and host-level monitoring remain deployment checks.

`php scripts/check-smtp-delivery.php` uses a localhost-only SMTP fixture to verify message acceptance even when QUIT is interrupted, explicit rejection, lost acknowledgement, Unicode subjects and dot-stuffing. It does not connect to a real mailbox or mail relay.
