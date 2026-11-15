# UAT status — 6 November 2026

This is the earlier local verification record, not production sign-off. The later [Live operations update](LIVE_OPERATIONS.md) replaces polling-only delivery with authenticated SSE and adds complete maintenance/private-resume controls; it requires migration 017. The production host has not been changed. Apply missing migrations through **016_campaigns_and_uat_controls.sql**; this design/delivery follow-up needs no further migration.

## Latest changes

- Login and registration now share a flat application story, local Inter typography and responsive forms. The decorative PDF iframe is removed from both authentication pages.
- The landing page leads with account creation and sign-in, then an optional sample workspace. Trust copy explains saved-document access, reviewing AI suggestions, support and email choice. No fabricated customer counts, endorsements or guarantees are used.
- Cover letters use a clearer opportunity form, optional background, separate writing area and save state. Search and pagination show six saved letters per desktop page and four per mobile page. Document confirmations use the shared dialog treatment.
- Management dialogs now give full-width sections their intended width. Fields align at the top instead of stretching to match neighboring content. Campaign reward inputs use consistent heights, with a preview and fixed action footer on mobile.
- Campaign management distinguishes Draft, Scheduled, Live, Paused, Ended and Archived. It explains visibility and shows inbox deliveries, dismissals and rewarded accounts. Start can be **When published** or **At a scheduled time**.
- Campaign banners and the inbox refresh while visible, on focus and after returning to a saved browser page. Checks coalesce, pause in hidden tabs and back off after errors. This is visibility-aware polling, usually within 30 seconds, not a WebSocket push service. Known schedule transitions use the server time to check at the transition.
- Scheduled campaign details also stay hidden at guessed URLs. Previously delivered messages remain readable after pausing or ending. Claims retain database transactions, caps and retry references.
- Email workers distinguish permanent SMTP rejection, retryable failures and uncertain final acknowledgement. Retry starts after 30 minutes with increasing delays and jitter; five attempts is the ceiling. Uncertain delivery is held for review to avoid duplicate emails. A database-specific worker lock prevents overlapping deliveries. Consent is checked again before sending.

### Why the existing campaign was not visible

A read-only local check found the existing testing-phase campaign scheduled for **6 November, 8:05 pm–11:10 pm Asia/Kuala_Lumpur**. It was inspected before its start. Its timing was preserved. Scheduled notices become visible at their start, rather than when their publication setting first changes to Published. Choose When published for an immediate announcement.

## Earlier UAT checklist

“Implemented” describes the current code and local checks. It does not certify every browser, hosting service or subjective design preference.

| Finding | Current result | Local evidence |
| --- | --- | --- |
| Support label in account menu | Implemented: Support under Profile | Shared server-rendered header; browser review |
| Notification card/read action | Implemented: compact category, destination and read button | Inbox browser review; count updates |
| Closed support requests | Implemented: both roles read-only until explicit administrator reopen | Campaign/lifecycle suite |
| Appearance menu and landing toggle | Implemented: Light/Dark/Device menu outside header | Mobile theme changed body colors; keyboard controls retained |
| Appearance/bell/account sizing | Implemented: each 44 × 44 | Mobile computed-layout inspection |
| Remove Every step / A stronger application | Removed | Public site checks; fresh landing browser review |
| User Feedback / Support labels and icons | Implemented | Admin browser review; asset checks |
| Duplicate admin password page | Removed from Administrators; kept in My profile | Admin navigation and own-profile routes |
| Campaign messages/rewards/colors/limits | Implemented | Scheduled live arrival without reload; inbox detail and claim; isolated concurrency suite |
| Admin logo | Shared real ReGen wordmark | Client and admin browser review |
| Temporary administrator access layout | Implemented readiness panel and explicit confirmation | Prior UAT browser review; permission suite |
| Administrator login | Refined portal, separate from client login | Prior browser review; source/asset checks |
| User management activity layout | Account/AI & bonus/Devices/Activity tabs and pagination | Admin-control suite and prior browser review |
| Renewable token control | Implemented: configurable renewable or fixed base allowance | Fixed-allowance regression checks |
| Combine related modules | Analytics, User accounts, System settings and Email groups | Admin browser review; underlying permissions remain separate |
| Admin profile/preferences/notification count | Implemented | Own-profile, notification and permission checks |
| Long tables/conversations | Paged admin tables, device/activity history, support messages and saved letters | Database and browser pagination checks |
| Analytics charts | Implemented chart summaries with readable values and filtered reports | Report suite; prior dashboard browser review |
| Optional OpenAI prepaid balance | **Not implemented**: Billing/Usage links provided | Separate provider integration; see ADMIN_UAT_NOVEMBER.md |
| Resume management/reports stuck loading | Working with local fixtures | Isolated report/template suites and prior real HTTP checks |
| Logout confirmation | Implemented for admin; consistent workspace confirmation | Prior browser review; shared dialog handling |
| Feedback reward/count controls | Implemented; default five once, every rating eligible | Feedback/access suite; transactional bonus ledger |
| User browser/device in audit/support | Implemented parsed browser/OS/device plus request context | Access/admin-control suite; context snapshots |
| Latest client authentication and landing redesign | Implemented; requires your visual acceptance | Desktop/mobile screenshots in output/uat-nov6-review |
| Cover-letter layout and management dialog widths | Implemented | Desktop/mobile browser review; actual letter save/search/pagination |

## Validation and limits

Reusable local checks:

```text
composer check
php scripts/check-admin-control-centre.php
php scripts/check-feedback-and-access.php
php scripts/check-campaigns.php
php scripts/check-launch-delivery.php
php scripts/check-smtp-delivery.php
node scripts/check-pwa.mjs
node scripts/check-mobile-viewport.mjs
node scripts/check-api-client.mjs
composer release
php scripts/check-release-templates.php
```

The launch-delivery check creates 100 fixture accounts, checks 70 opted-in recipients, overlaps two mocked workers, verifies campaign inbox deduplication, consent withdrawal and email retry outcomes. This is **not** a benchmark of 100 simultaneous browser users. SMTP protocol tests use localhost only; no real email or paid AI request is sent by these checks.

Security and audit controls cover application activity. Device information is parsed from browser-supplied headers and is helpful context, not proof of a physical device or a malware scan. The portal is not a host antivirus or network intrusion detection system.

Before production sign-off, verify the release on the intended HTTPS host: SMTP receipt/spam placement and SPF/DKIM, verification/reset links, Google/reCAPTCHA configuration, worker cron, backup/restore procedure, PWA installation on actual devices, and realistic concurrency/latency with that hosting plan. Requested verification/reset messages use their existing direct delivery path; queued alert delivery must have the cron worker. Campaign publishing creates in-app notices; email broadcasts are a separate opt-in operation.

The UAT implementation and local checks can be reviewed now. Production delivery, cross-device acceptance and your visual acceptance remain open; **all UAT cannot honestly be declared closed yet**.
