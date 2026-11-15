# UAT follow-up: 7 November 2026

This record covers the token-store and support-attachment phase, plus related live-delivery, maintenance and balance regressions. Earlier visual changes and UAT records remain documented separately; this is not a claim that every historical page has been retested on every production device.

| Request | Implemented and checked |
|---|---|
| Live notifications for users and administrators | Shared authorized delivery and recovery, persistent inbox/counts, and opt-in on-screen feedback. A real browser received a staff reply, updated the unread badge and preserved draft text and selected files. |
| Simpler maintenance configuration | Current status, three timing choices, MYT dates, optional automatic restoration, duration shortcuts, separate estimated return, message preview and apply confirmation. Fixed preview overlap that blocked pointer access to the review action. |
| Four support files, configurable | Default four images/PDFs per message, configurable count and size limits, server validation and private storage. Owner, other-user, anonymous, administrator and representative access are covered by HTTP checks. |
| Staff image viewing | User and staff private image viewers checked in the browser. PDFs download through authorized routes. |
| Closed-ticket restrictions | User and administrator replies are rejected until support reopens the request. |
| Configurable token packages | Draft/active packages, quantities, bonuses, price/currency, badges, highlighting, order and editable store copy. Only active packages appear to users. Administrator save and desktop/mobile configuration layouts checked. |
| Admin-selected unlock or per-use access | Server-enforced pricing, explicit review, durable unlocks, single-use credits and unused-credit returns. Editing and background reads use unlocks, avoiding automatic-save charges. |
| Permanent balance separate from AI | Existing rewards and balances preserved. AI allowance costs/renewal remain independent. User/admin wording now distinguishes AI credits from ReGen tokens. |
| Wallet stability and performance | Eight synchronized buyers compete for one remaining purchase; one succeeds and seven are rejected without an overdraft. Fixed duplicate-key lock upgrading, established consistent account/wallet lock order, and added an indexed wallet history path. Individual spending emits one private wallet signal instead of refreshing all users. |
| No payment gateway yet | Purchase buttons are disabled with an availability explanation. The checkout endpoint rejects attempts to create purchased tokens. No money is collected. |

## Verification

- Core Composer checks: PHP syntax/autoloading, asset/navigation checks, public pages, all 16 templates, writing, assistance and mail configuration.
- Store/database checks cover revisions, insufficient funds, retries, concurrent purchases, refunds, interrupted reservations, file validation, cleanup, audit quantities and delegated permissions.
- A self-contained HTTP suite creates and removes its own database, server, cookies and upload fixtures. It exercises real uploads and real PDF generation; mail, AI and managed delivery are disabled in that fixture.
- Existing feedback/access, campaign, AI accounting, live operations, managed-delivery, API-client, PWA and mobile-viewport suites pass. Managed delivery tests use a mocked provider.
- The actual configured Pusher app accepted a read-only HTTPS API request. This verifies credentials and API connectivity; it does not certify production WebSocket subscriptions or publish a test event to user channels.
- Browser evidence is retained locally under `output/store-uat/` and excluded from the deployment archive. It includes store/package desktop and mobile views, private staff viewing, maintenance configuration and user-side live update feedback.

## Before production delivery

Apply missing migrations through **019_support_and_token_store.sql**, preserve protected storage and configuration, keep the notification cron running, verify PHP upload limits and reset stale OPcache/browser assets. Follow [the phase-one setup guide](TOKEN_STORE_PHASE_ONE.md).

Production Pusher browser delivery, external email delivery for opted-in accounts and hosting capacity still require verification on the target host. Closed-tab operating-system Web Push is not implemented. Payment integration is deliberately deferred. These remaining deployment/integration checks prevent an honest claim that every UAT and production concern is fully closed.
