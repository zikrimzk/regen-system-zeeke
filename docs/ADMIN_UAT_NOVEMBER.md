# November 6 UAT delivery

This update addresses the November 5 checklist and the follow-up about appearance and workspace controls. The production host has not been changed. The local development database has received migration 016.

For the later authentication/landing redesign, campaign visibility diagnosis, delivery hardening and the item-by-item verification status, read [the November 6 follow-up](UAT_STATUS_2026-11-06.md).

## Upgrade

Apply only missing migrations, in order, through `016_campaigns_and_uat_controls.sql`. For an existing installation already on 015, apply 016 before replacing the running application. It creates the campaign, claim and dismissal tables and adds the automatic-renewal setting. Existing allowances continue renewing by default. Use the current schema only for a fresh installation.

Upload the complete rebuilt release, preserving the production `.env`, uploads and protected storage. Keep the existing notification worker cron running. Campaign delivery is batched by that worker and also synchronized when a signed-in user checks the inbox/dashboard. Runtime hashes invalidate changed CSS and JavaScript; the release also changes the public service-worker fingerprint. If hosting disables OPcache timestamp checks, reset OPcache after replacing PHP files.

## Navigation and configuration

| Area | Organization |
| --- | --- |
| Analytics | Overview, Reports and Traffic share one sidebar entry and a section switcher. Charts retain readable values. Reports retain UTC date filters and authorized CSV exports. |
| User accounts | Accounts and Session controls share one module group. The account drawer has Account, AI & bonus, Devices and Activity tabs. Device and credit histories paginate. |
| System settings | Feature availability and Access & sessions use the same group. Feature search/filtering includes pagination. Shared starter access has a readiness panel and confirmation. |
| Email | Test Email and Broadcast are separate sections. Broadcast email continues checking recipient consent. |
| My profile | Personal names, notification preferences and password changes are together. The shared starter account directs staff to create a personal account. Password changes were removed from Administrators. |
| Notifications | A separate inbox entry includes the live unread count. On-screen alert consent controls pop-up notices independently of that count. |
| User Feedback / Support | Consistent labels and distinct icons replace Customer feedback and Support inbox. |

Grouping pages does not merge permissions. Each underlying API still requires its original module and read/change/export scope. Campaigns adds its own read/change permission. Delegated administrators continue starting with no access. My profile requires a signed-in administrator, without a delegated module grant; its route only updates that administrator's names.

## Campaigns and announcements

Create a draft with a title, plain-text message, audience and accent color. A notice can be a thank-you, service announcement or reward campaign. Choose all users or verified users. Schedule dates use the administrator's local time in the form and UTC on the server. Preview and review the audience, dates and rewards before publishing.

Rewards are optional. Configure 1–1,000 persistent bonus tokens per claim, 1–100 claims per account and an optional campaign-wide cap on the **number of claims**. A cap of zero means no campaign-wide cap. The default is five tokens and one claim per account. Limits and dates are enforced by the server. Row locks, a unique claim sequence and an idempotency reference prevent parallel requests and network retries from granting extra tokens. A failed balance adjustment rolls back the entire claim.

Published notices appear near the top of the dashboard, with at most three banners at once. Users can dismiss a banner; the notification detail remains accessible. Pausing, archiving or ending a campaign stops new claims and removes its banner. Previously granted tokens remain. Editing a published notice does not send a second notification to existing recipients; create a new campaign for a new message. Increasing the per-user claim count can make previous recipients eligible for another claim. Changing token amounts applies to later claims.

Campaign notices use the in-app inbox. Publishing a campaign does not send email. Email announcements remain a separate, consent-based action under Email → Broadcast. All alert email channels, including security, remain opt-in.

## Ticket lifecycle and allowances

A closed support request is read-only for users and administrators. Replies, internal notes and status/assignment changes are rejected until an administrator with Support change access uses **Reopen request**. Reopening uses a revision check and records an audit event. Conversations show 20 visible messages per page, with newer/older navigation. Internal notes remain excluded from user pages and their message totals.

AI usage includes **Renew token allowances automatically**. With renewal disabled, base usage remains charged until an administrator resets it; elapsed time does not restore the allowance. The renewal interval is retained for later use. Persistent bonus balances remain separate. Re-enabling renewal restores expiry behavior according to the saved interval. User-facing token labels say base allowance and correctly explain fixed allowances.

## Interface checks

The workspace header uses one shared shell: a compact appearance/bell/account group, matching 44 × 44 controls, account identity inside the dropdown and Support below Profile. Sun/moon icons indicate the current appearance. The appearance menu supports Light, Dark and Device setting, keyboard navigation and viewport-safe placement outside the header. Remembering appearance still follows optional preference consent.

The landing page no longer includes the application-steps proof section. Its unused script/styles and the unused administrator mark were removed, and its navigation no longer points at the removed section. Admin and client pages use the actual ReGen wordmark and shared local Inter interface font.

Notification cards use compact category icons, a quiet read action and a clear destination. On mobile, notification preferences are a collapsible panel above the list. Closed-ticket pages explain their read-only state. Administrator logout uses the shared confirmation dialog.

Visual checks covered desktop, 390 px mobile and the 320 px editor. The editor header fits without horizontal overflow, and all four editor utility buttons remain 44 × 44. Browser checks also confirmed light/dark switching, live count changes after reads, campaign claiming and the closed-ticket reply restriction.

## OpenAI provider balance

Application token allowances are product credits, separate from provider token usage and money. The documented [OpenAI organization cost endpoint](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs) exposes costs using a separate organization admin key. The documented API does not expose a prepaid credit-balance endpoint. This release provides Billing and Usage shortcuts in AI usage; it does not display an inferred or fabricated live balance or store an additional organization credential.

## Validation

- `composer check`: PHP syntax/autoloading, page assets, public assets/labels, template collection, writing, assistance and mail configuration.
- `php scripts/check-campaigns.php`: isolated database tests for publication, schedule/audience restrictions, idempotency, simultaneous per-user/global claims, persistent bonuses, closed-ticket reopening, message pagination and fixed allowances.
- Existing isolated feedback/access, admin-control, AI, template-management and session-history suites.
- PWA, viewport and API client checks; real HTTP checks for report/template loads, CSRF, profiles, campaigns and closed-ticket transitions.
- Extracted release checks validate class loading, current assets and fresh-cache PDF generation for six bundled font families.

These checks use local fixtures, mocked AI/mail or disabled external delivery. They do not establish production hosting latency, hosting malware protection or commercial billing readiness. Hosting-level backups, uptime monitoring and operating-system security remain separate responsibilities.
