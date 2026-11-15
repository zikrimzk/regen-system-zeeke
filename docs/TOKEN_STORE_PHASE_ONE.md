# Token store, private support files and live notifications

This update adds the first commercial configuration layer. **No payment gateway is connected, no money can be collected, and checkout cannot create tokens.** Existing features remain free until an authorized administrator changes their prices. The user store is `/store`.

## Balances and access

- **ReGen tokens:** a permanent account balance for earned rewards, manual adjustments and future purchases. Existing feedback and campaign rewards keep their balance and history. Their existing wallet tables are reused, preserving data.
- **AI allowance:** a separate allowance, with the existing per-user overrides, operation costs and optional renewal. AI operations no longer spend the permanent balance automatically when this allowance runs out. The interface calls allowance units **AI credits** to distinguish them from ReGen tokens. A separately priced AI feature requires its configured access and sufficient AI allowance.
- **Feature pricing:** administrators choose free access, a permanent unlock, or per-use access where supported. Editing, template browsing, previews, document settings and the cover-letter workspace support unlocks; automatic saves and background refreshes cannot spend per-use credits. Account access, password/device security, support and feedback have no token charge.

Configure prices in **Feature pricing**. All 14 product controls show their current model and cost. Changes require `pricing.manage`; viewing requires `pricing.view`. Previous permanent unlocks are honored after a price change.

Users review a server-supplied price and explicitly confirm before spending. A per-use purchase creates one credit for the named feature. The next successful action consumes that credit. A failed action leaves it available; users can return an unused credit in the store for the exact original amount. An interrupted reservation becomes available after 15 minutes. This is separate from returning money; money is not collected in this phase.

Wallet debits, purchase references and entitlements are committed in database transactions with row locks. Retrying a purchase reference cannot debit twice. The confirmation dialog retains its reference across a failed response/retry. Price revisions reject stale confirmations. Concurrent requests cannot use the same credit simultaneously or overdraw a balance. Domain actions themselves do not promise exactly-once execution after an indeterminate network failure.

## Token packages

Open **Token packages** to create drafts, publish/unpublish packages, set token quantities and bonus quantities, choose MYR/USD/SGD prices, add a badge, highlight a package and set its display order. Prices are stored as integer minor units. Lists paginate and configuration includes a live preview. **Store settings** controls the heading, introduction, availability message and catalogue visibility. Hiding packages retains wallet history and previously purchased feature access.

Only active packages appear to users. Purchase buttons clearly state that buying opens later. `/api/store/checkout` refuses attempts to self-credit an account. Future payment integration must verify payment server-side, use unique provider payment references and credit the existing ledger transactionally. Do not enable a button as a substitute for that integration.

Package permissions (`store.view` / `store.manage`) are separate from feature pricing. Newly delegated administrators receive neither automatically. Super administrators assign the required scope and purpose. Package, price and wallet changes are recorded in the audit log; numeric package quantities are retained while credential fields remain redacted.

## Support attachments

Users can add **four files per message by default**, including the initial request and subsequent replies. Supported formats are JPG/JPEG, PNG, WebP and PDF. **System settings → Attachments** controls the maximum file count, individual size and combined size. Defaults are four files, 5 MB each and 20 MB combined; supported configuration ranges are 0–12 files, 1–8 MB per file and at most 30 MB combined. Zero disables new uploads. Existing attachments remain available.

The server enforces the configured limit and the hosting limit. It checks uploaded-file provenance, MIME content, extension, PDF signature, byte sizes and image dimensions. Images are decoded and re-encoded; images above 12 megapixels are rejected. SVG and executable content are not accepted. Files have random storage names in **`storage/support-attachments`**, outside public uploads. Back up this directory with the database and other protected storage.

Attachment routes recheck the ticket owner or staff `support.view` permission. Internal-note files are excluded from user responses. Images open in a private viewer; PDFs are served as downloads. Responses use `no-store`, and file access is audited. These checks do not constitute antivirus scanning or content disarm for arbitrary PDFs.

Closed requests are read-only for users and staff. Staff must reopen the request before adding a reply or changing it. Live conversation refreshes preserve reply text and selected files. Files are saved with the message transaction; failed transactions discard staged files. The existing cron worker also checks for old unreferenced attachment files at most once daily, in database batches, excluding files younger than 24 hours and limiting deletions per run.

For the full default limits, configure PHP through DirectAdmin, for example:

```ini
file_uploads = On
upload_max_filesize = 8M
post_max_size = 32M
max_file_uploads = 12
memory_limit = 256M
```

Keep any web-server upload limit at least as large as the PHP request limit. ReGen caps request bodies at 32 MiB and reserves multipart overhead when presenting the effective combined upload limit. Smaller hosting settings automatically lower the user-facing limit. The administration page displays the effective limits for the saved configuration.

## Live delivery and maintenance

Both user and administrator portals use the same nonblocking managed-delivery/recovery architecture. Inbox records, unread badges and authorized ticket changes synchronize independently of optional alert consent. **On-screen popups, browser alerts and all alert emails require opt-in.** Users configure this in Notifications; administrators use My profile. Consent does not disable the persistent inbox.

Without a configured managed service, short adaptive checks keep visible pages current. This is automatic refresh, not instant push. Configure the Pusher Channels app using [the DirectAdmin setup guide](MANAGED_REALTIME_DIRECTADMIN.md) for instant managed wakeups. Hidden tabs pause their transport; supported browsers share checks/connections between tabs. Private event payloads contain invalidation signals rather than messages, files or resume contents. Closed-tab operating-system Web Push remains a separate, unimplemented capability.

**System settings → Maintenance** now separates the current access status, timing choices and user-facing message. Choose Keep open, Start now or Schedule for later. Dates explicitly use Malaysia time. Automatic restoration and an estimated return time are distinct options, with duration shortcuts, a user-page preview and a confirmation before applying changes. The preview stays within its layout column and cannot cover the apply button. Draft edits survive live status updates.

## Deployment and validation

1. Back up the database, private configuration, uploads and protected storage.
2. Apply missing migrations in numeric order through **019_support_and_token_store.sql**, once each. Migration 019 is additive and does not reset wallet balances or enable feature prices. Fresh installations use the current complete schema.
3. Upload the rebuilt ZIP, preserving `.env`, uploads and storage. Reset OPcache if timestamp validation is disabled, then reload existing browser tabs.
4. Keep the existing notification cron running once per minute. The packaged entry point is `_app/jobs/process-notifications.php`. It processes delivery and performs the guarded daily attachment cleanup; no additional long-running PHP process is required.
5. Grant any delegated store/pricing permissions explicitly. Configure package drafts and prices before publishing. Verify that no paid feature unexpectedly restricts a user workflow.
6. Verify HTTPS, hosting upload limits, actual email delivery for an opted-in account and real Pusher connectivity on the production host. The local work does not deploy or certify that host's capacity.

Development checks are repeatable without production data:

```powershell
composer check
php scripts/check-store-and-attachments.php
php scripts/check-store-http.php
php scripts/check-feedback-and-access.php
php scripts/check-ai-database.php
php scripts/check-managed-realtime.php
php scripts/check-live-operations.php
php scripts/check-campaigns.php
node scripts/check-api-client.mjs
node scripts/check-realtime-client.mjs
node scripts/check-pwa.mjs
node scripts/check-mobile-viewport.mjs
```

The store HTTP check creates and removes its own local database, PHP server, cookies and upload fixtures. Mail, AI and external managed delivery are disabled there. Additional real-browser checks covered desktop/mobile store layouts, explicit price review, administrator package saving, maintenance scheduling review, user/staff image viewing and a live staff reply updating the user's conversation and unread count without losing draft text/files.

File-handling references: [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [PHP POST uploads](https://www.php.net/manual/en/features.file-upload.post-method.php).
