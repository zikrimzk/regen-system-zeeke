**Commercial pricing refresh:** apply missing migrations **020_commercial_packages.sql**, **021_template_package_access.sql**, **022_package_claims_and_presentation.sql**, **023_package_layouts_and_account_management.sql**, **024_strict_package_access.sql** and **025_inbox_and_offer_copy.sql**, in order after 019, before replacing the application. They add package benefits, expiry, promotions, Unlimited functions, template collections, distinct unlocks, landing visibility, capped free claims, per-package layouts/coin colours and account grant management. Migration 021 preserves existing gallery unlocks and saved designs; do not rerun its one-time backfill. Migration 023 maps the old global display choice onto existing packages once; layouts are then configured per package. Migration 024 makes every commercial feature Package only by default, retains earlier rules for review, and adds saved letter dates/recipient addresses. Review existing package grants for access previously supplied by Free feature settings. Migration 025 adds personal inbox removal and configurable offer headlines and buttons. Migration 026 adds HitPay checkout and payment history. Follow [HitPay setup](docs/HITPAY_CHECKOUT.md) before enabling checkout. See [strict access and cover letters](docs/STRICT_PACKAGES_AND_COVER_LETTERS.md), [account package management](docs/ACCOUNT_PACKAGES_AND_LAYOUTS.md), [package offers and landing configuration](docs/PACKAGE_OFFERS_AND_LANDING.md) and [template packages and token protection](docs/TEMPLATE_PACKAGES_AND_SECURITY.md).

**Store and support update:** apply missing migrations through **019_support_and_token_store.sql** before replacing the application. See [the token store and support setup](docs/TOKEN_STORE_PHASE_ONE.md) for upload limits, feature prices, permanent balances and the phase-one checkout restriction. PHP-held SSE streams have been retired. See [managed live updates setup](docs/MANAGED_REALTIME_DIRECTADMIN.md) for Pusher Channels configuration and nonblocking recovery, and [Live operations](docs/LIVE_OPERATIONS.md) for maintenance and private resume access. Keep the existing notification cron enabled. Reload existing browser tabs once after this upgrade.

# Upload to DirectAdmin / public_html

Before inviting the first testers:

1. Upload the current ZIP while preserving `.env`, uploads and protected storage. Apply any missing migrations through `027_mochi_personal_coach.sql`; this update adds no migration. Confirm `/api/health`.
2. In **Pricing → Packages**, assign **Mochi chat and writing help** to premium testers. Use **Hide unavailable tools** for optional writing tools you want removed from the customer's workspace when they have no access. Access from another active package or a public rule still applies.
3. In **Mochi → AI spending**, check the daily limits. Try “Apa nak isi kat sini?” from a focused resume field, apply a shared-field suggestion, then open one exported resume PDF and one cover letter PDF.
4. Run the [notification cron every minute](docs/EMAIL_DIRECTADMIN.md#start-the-directadmin-worker). Check `--status` for configured mail and a recent heartbeat. Verify a new test account and check its welcome email. Complete a [HitPay sandbox checkout](docs/HITPAY_CHECKOUT.md) and check the package, order reference and receipt.
5. Reopen the installed app on a phone. After saving any work, use **Reload** if the update prompt appears. Check the header, bottom navigation, Mochi’s Room and chat with the keyboard visible.

**Earlier campaign update:** migration **016_campaigns_and_uat_controls.sql** adds campaigns with capped token claims, optional nonrenewing AI allowances, reorganized admin modules and shared UI refinements. Apply migrations **017–019** afterwards for this release. See [the refinement setup guide](docs/ADMIN_REFINEMENT.md) and [the earlier UAT status and production checks](docs/UAT_STATUS_2026-11-06.md). Fresh installations use the current schema.

For mailbox setup using the familiar Laravel-style `MAIL_*` variables, follow [Email on DirectAdmin](docs/EMAIL_DIRECTADMIN.md). It includes the exact File Manager steps and SSL/STARTTLS examples for limited hosting-panel access. See [Mochi coach setup](docs/MOCHI_COACH.md) to add the package benefit and use the existing OpenAI key for chat and live feedback.

## Hosting requirements

Use a currently patched PHP 8.3 or newer release, MySQL/MariaDB, HTTPS, and Apache or a compatible LiteSpeed configuration that honours `.htaccess`. Enable PHP curl, dom, fileinfo, gd, mbstring, openssl and pdo_mysql. OPcache is recommended. PHP 8.3 remains security-supported through 31 December 2027; PHP 8.1 is no longer supported ([PHP support dates](https://www.php.net/supported-versions.php)).

The host must permit rewrite, authorization, headers and the options used in the bundled `.htaccess`. Apache ignores those files when overrides are disabled ([Apache documentation](https://httpd.apache.org/docs/2.4/howto/htaccess.html)). Do not use this public_html package on Nginx without equivalent server rules; its private directories must be denied before serving requests.

## First installation

1. Upload `release/regen-php.zip` with File Manager and extract its **contents** into `public_html`. The result has `index.php`, `.htaccess`, `css`, `js` and `_app` directly under `public_html`. Delete the uploaded ZIP after extraction.
2. Copy `.env.example` to `.env` in `public_html`. Set `APP_ENV=production`, the exact HTTPS `APP_URL`, your database credentials and `SESSION_DRIVER=database`. Configure SMTP and reCAPTCHA for password registration/login. Google sign-in and AI are optional; leave their keys empty when unused. Keep `TRUST_PROXY=false` unless your host uses a trusted HTTPS-terminating proxy. This is the only live configuration file.
3. Create the database with the hosting panel and import `_app/database/schema.sql` through phpMyAdmin. The SQL file is available in File Manager and blocked from HTTP access.
4. The schema provisions the requested temporary shared account: `admin@regen.com` / `Abcd@1234`. It remains available alongside personal admins until disabled. Sign in, create a personal super admin in **Administrators**, finish its password setup, then use that personal account to disable temporary access in **System settings** before commercial release. Disabling also invalidates existing shared-account sessions. The reserved email belongs to this shared account. You can also create personal administrators with `php scripts/create-admin.php administrator@your-domain.example`; its unique 12–128 character password is read from standard input and only the password hash appears in its SQL output.
5. Visit `/api/health`, `/login` and `/admin/login`. Confirm that `/.env` and `/_app/bootstrap.php` return **403**. Check registration/email verification, sign-in, resume saving and PDF download before inviting users.

No Composer, npm, Node.js, SSH or terminal commands are needed on the hosting server. No web installer or publicly accessible migration endpoint is shipped.

For an additional personal admin without a local helper, register and verify a password user, then run the following in phpMyAdmin with your chosen email. The first admin login requires a separate administrator password change:

```sql
INSERT INTO admins
  (first_name, last_name, email, password_hash, role, status, must_change_password)
SELECT first_name, last_name, email, password_hash, 'super_admin', 'active', 1
FROM users
WHERE email = 'your-verified-email@example.com'
  AND email_verified_at IS NOT NULL AND password_hash IS NOT NULL;
```

## Updating an existing installation

1. Back up the database and current application files.
2. If the server still has `_app/config.local.php`, copy its key/value settings into the single `public_html/.env` before replacing the application. Set production, HTTPS and database sessions explicitly. Remove the obsolete PHP configuration file after confirming the update.
3. Apply only missing migrations from `_app/database/migrations` in numeric order, through **027_mochi_personal_coach.sql**. Migration 027 adds the account table for Mochi’s preferences. Do not rerun the fresh schema as an upgrade procedure.
4. Extract the new upload ZIP over the application files. It contains no `.env`, uploaded photos or licensed private document fonts, so those are preserved. Remove the old public `*.html` page copies from previous releases; the pages now live in `_app/views`. Also remove an old deployed `router.php` if present.
5. Repeat the health/private-file checks and one save/download. Keep your backup until the update is verified.

For releases without a database change, the normal update is simply **upload → extract → verify**. Hosting credentials, mail credentials and database provisioning cannot be supplied automatically by a generic ZIP.

## Troubleshooting

- **500 before the application loads:** ask the host to check permitted `.htaccess` directives and PHP extensions. Avoid world-writable permissions; typically folders use 755 and files 644, with `.env` restricted to the PHP account where supported.
- **Database connection failed / health 503:** check database name, host, user permissions and missing migrations. The protected `storage` folder must be writable by PHP; PDF/font/lookup caches and file-session fallbacks live there.
- **Resume opens but autosave fails after an upgrade:** open the application's database in phpMyAdmin and run `SHOW COLUMNS FROM cover_letters WHERE Field IN ('recipient_address', 'letter_date');`. This read-only query should return both columns. Resume autosave uses them when creating automatic document history. If either is missing, check whether migration 024 was skipped or only partially applied before completing the missing schema change. The migration also changes package access, so avoid replaying those steps on an installation where they already ran. After correcting the schema, confirm `/api/health` returns 200, click **Retry save** in the open editor and verify the edit after reloading. The editor shows a request reference when PHP supplies one, which can be matched in Administration → Activity log or the PHP error log.
- **Password registration/login unavailable:** configure valid reCAPTCHA keys for the exact hostname. SMTP must be ready for verification delivery; review its readiness in Administration → Email → Test Email.
- **Google sign-in:** configure the JavaScript origin and `/api/auth/google` redirect URI for the exact `APP_URL` in your existing Google OAuth client.
- **PDF font differs:** named proprietary fonts require licensed files in `storage/document-fonts`; otherwise the app uses bundled serif/sans fallbacks. Bundled fonts and PDF.js need no server downloads.
- **Older UI appears:** pages and APIs are not cached; assets have versioned URLs. If necessary clear a hosting/CDN cache once after deployment. Refresh OPcache through the hosting panel if timestamp validation is disabled.

Secrets are never included in the normal ZIP or CI artifact. `php scripts/build-release.php --with-env` is an optional local-only private package mode; it requires production settings and contains secrets, so use only a trusted transfer channel. The supplied ZIP uses the normal secret-free mode.

## Landing page, SEO and PWA update

The updated ZIP includes a public homepage, ten fictional template previews, `manifest.webmanifest`, install icons, `/sw.js` and an offline reconnect page. Keep these at the domain root when extracting. The supplied Apache rules set the manifest MIME type and prevent stale worker caching. There is no new database migration for the design, landing page or PWA changes.

Set `APP_URL` to the exact public HTTPS origin and keep `APP_ENV=production` on the server. Canonical URLs, share images, robots rules and the sitemap are generated from that configuration. Verify `/`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` and `/sw.js` after uploading. Submit the sitemap through your own search-engine account if desired. Development correctly requests no indexing.

Supported browsers can install ReGen. Safari users receive Add to Home Screen instructions when a native prompt is unavailable. Public offline assets are cached; personal documents, API responses and authenticated pages are excluded. Test offline mode after one online visit, then reconnect for account actions. The worker cache version is generated automatically per release. Existing open tabs can keep their current worker until closed; the app does not discard an active editor to force an update.

The landing AI rewrite and cover-letter actions are labelled simulations. Real AI remains behind sign-in and the existing usage controls. The website states that the system is free for now, with AI subscriptions coming soon; no billing or subscription feature is introduced by this update.

## Candidate UI and 24-hour PWA sign-in

This update changes the PWA entry to `/login?source=installed` and keeps user authentication for up to 24 hours from sign-in. The server enforces the deadline even if a browser keeps an old cookie. Login uses a persistent HttpOnly cookie and never stores a password in browser storage. Existing session revocation and logout controls remain active; administrators retain the configured idle timeout. No database migration is required.

An existing installed app may continue using its previously installed manifest until the browser refreshes it. Close and reopen the app after updating. If its launch URL remains the old homepage, reinstall it from the updated website. Public previews now use the real document renderer and a renderer version in their URLs, so new sample designs do not reuse old cached content. Private account pages, authentication responses and documents remain excluded from offline storage.

## Google sign-in configuration returns 500

A failed request at `auth.js`'s `fetch('/api/auth/google/config')` is a server response, not a JavaScript origin error. Check that endpoint separately from `/api/auth/recaptcha/config` and `/api/health`.

- **Google config 500, reCAPTCHA config 200, health 503:** investigate the deployed schema and PHP error log. Google configuration reads `app_settings`; reCAPTCHA configuration does not. A missing or inaccessible settings table can produce this exact pattern. Database connectivity alone does not establish that migrations have been applied.
- In phpMyAdmin, select the application's database and run this read-only check:

  ```sql
  SELECT setting_key, setting_value
  FROM app_settings
  WHERE setting_key = 'google_login_enabled';
  ```

  Error 1146 means the referenced table does not exist. `app_settings` is introduced by migration 007; migration 008 seeds the operational settings. Check and apply only missing migrations in order. An empty result for this particular setting does not itself cause a 500: the code defaults to enabled when the table exists. A value of `0` intentionally disables Google sign-in. Do not rerun the fresh-install schema over an existing installation, or blindly repeat a partially applied `ALTER TABLE` migration.
- **Google config 200 with `enabled: false`:** check `APP_URL`, the configured OAuth client ID and Administration's Google sign-in setting.
- **Google config 200 with `enabled: true`, but Google reports an origin/redirect error:** configure the exact HTTPS origin and callback in the Google Cloud Web application client. For `https://regenzeeke.appnest.my`, the JavaScript origin is `https://regenzeeke.appnest.my` and the authorized redirect URI is `https://regenzeeke.appnest.my/api/auth/google`. The client ID is the OAuth Web application client ID ending in `.apps.googleusercontent.com`. This ID-token sign-in flow does not use a client secret in browser code.

Keep `APP_ENV=production`. Errors now include an opaque request ID, while the hosting PHP log records the context, PHP source location, SQLSTATE and database error number without logging SQL or credentials. Search for `[ReGen PHP Error]` and the matching request ID. The login and registration pages now show an unavailable message and Retry after configuration/Google-library failures; they retain the intentional hidden state when Google sign-in is disabled. These changes improve diagnosis and recovery; they do not modify or migrate the hosting database.

Google's configuration reference: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

## Google button appears, but the account cannot be verified

Google ID-token verification does not use SMTP settings or email-verification delivery. Missing mail configuration does not cause `google_error=invalid`.

The 29 October 2026 auth correction restores an explicitly required runtime dependency: `phpseclib/phpseclib` 3.0.57. The selected `Google\Auth\AccessToken` RSA verification path requires this library, even when PHP OpenSSL is enabled. Its absence raises `Please require phpseclib/phpseclib v3 to use this utility.`, which the previous code reduced to a generic invalid-sign-in message. The earlier dependency cleanup incorrectly removed it. `composer check` now rejects a package missing that capability.

Upload and extract the complete rebuilt `regen-php.zip`, including `_app/vendor`, over the application while preserving `.env`. Updating HTML, JavaScript or PHP sources alone does not restore the missing library. Composer is not required on the hosting server. No additional database migration or SMTP change is needed for this correction. If the host disables OPcache timestamp checks, reset OPcache through the hosting panel after replacing files.

Tests use the actual Google verifier and locally signed RSA tokens with mocked public-key transport. Valid tokens pass; incorrect audience/issuer/signature, expired/future tokens, unverified email and malformed inputs are rejected. No Google account or production database is used by these tests. Live Google sign-in still needs a final check on the hosting server after uploading the repaired package. If it fails, use the PHP log entry with context `google.verify`; the public sign-in message remains generic. Network/TLS failures include the safe cURL transport error number. Never disable HTTPS certificate validation to resolve a certificate problem.
