# Template packages and token protection

**8 November update:** [Strict package access and cover-letter changes](STRICT_PACKAGES_AND_COVER_LETTERS.md) supersede earlier automatic Free access and fallback behaviour. Migration 024 makes package limits the default for every commercial feature.

Updated 7 November 2026. Checkout remains disabled.

## Package configuration

In **Admin → Pricing → Packages**, each metered feature now offers **Limited** or **Unlimited**. Unlimited benefits use no base or saved tokens while the grant is active. Successful unlimited actions are still recorded in activity. Workspace access remains an on/off benefit.

For **Resume templates**, select Basic, Premium, or both, then set a distinct-design limit or Unlimited. A limit of three means three different designs can be unlocked. Previewing does not spend an unlock. Reapplying the current design and switching among designs unlocked by an active package do not spend another unlock. The initial resume design counts as an unlock. Unlimited grants are used before finite grants; otherwise the earliest-expiring eligible grant is used first.

The configured validity applies to package template rights too. After expiry, the existing document keeps its design and remains editable; selecting another package-owned design needs an active qualifying grant. Pre-upgrade saved designs and existing individual full-gallery unlocks remain reusable. Editing a package does not change existing grants, which retain their original collection, quantity and expiry snapshot.

**Individual prices → Resume templates** defaults to **Package access only**. Admins can explicitly enable Free access to all designs or a one-time token-priced gallery unlock. A full-gallery unlock includes both collections. An unlimited Basic package alone cannot grant Premium access or bypass a required gallery purchase.

## User interface

The template library has visual cards, Basic/Premium filters, search, photo-layout filtering, a selected-design panel and a persistent mobile action. Availability, owned designs and remaining distinct unlocks are shown at selection. Popular badges use subtle shine and glow, with reduced-motion support. Popular status is managed in Admin → Resume templates.

Navigation buttons keep stable labels while prices load. Priced execution buttons show their current cost or included benefit once available; the server always checks access at execution. Download buttons use **Download**.

## Server enforcement

- Template creation and changes validate the authenticated account, server catalogue tier, active grant, expiry and remaining distinct designs inside the same locked transaction as the document write. Client-submitted price, tier, quota and account claims do not grant access.
- Unique ownership records and account row locks prevent simultaneous requests from spending the same final template slot. Gallery token purchases use server prices, wallet locks, CSRF, version checks and idempotent references.
- Successful action reservations settle before response bytes are sent. Expired or replaced reservation references cannot return successful paid results. Failures release holds; consumed credits cannot be refunded or replayed.
- Private resume and cover-letter previews are watermarked when clean downloads are priced and the user lacks a permanent download unlock. Clean Download remains subject to its own package/credit gate. Legacy printable HTML routes redirect to protected previews. Draft previews require the saved template, so they cannot render an unacquired Premium design by submitting a forged draft.
- Private documents and token pages use no-store responses. Preview samples contain fictional data and remain freely browseable.

These controls cover application authorization and accounting. They do not prevent someone from rebuilding a document from their own resume text or capturing a preview image.

## Installation and verification

Existing installations must apply **021_template_package_access.sql** after migration 020 and before replacing application files. It adds collection snapshots, distinct unlock records and a one-time library backfill for saved designs. It changes legacy free gallery pricing to package-required access while preserving existing paid unlocks. Do not rerun the backfill after normal package use has begun. Fresh installations use the updated `database/schema.sql`.

For local development only:

```powershell
php scripts/migrate-template-packages-local.php
```

The helper refuses remote/production configurations and exits without rerunning the backfill when the schema is already installed. Hosting uses the normal SQL migration process. Reload existing browser tabs after release.

Migration 021 is installed in the configured local development database. A second helper invocation confirmed that it exits without rerunning the backfill.

Focused verification:

```powershell
php scripts/check-template-packages.php
php scripts/check-commercial-packages.php
php scripts/check-store-http.php
php scripts/check-store-and-attachments.php
php scripts/check-template-management.php
node scripts/check-api-client.mjs
composer check
```

The template security suite uses a disposable database and real local HTTP requests. It covers unlimited accounting, distinct ownership, tier restrictions, expiry, snapshot isolation, competing final unlocks, forged request fields, legacy preview routes, separate clean exports, insufficient funds, lifetime gallery access and reservation fulfillment. Browser QA covers desktop, 390px and 320px template selection plus persisted Unlimited/Basic/Premium admin settings. Preview and clean PDFs were rendered and visually compared. No real AI requests, messages or payments are involved.
