# Package presentation, free claims and public experience

**8 November update:** [Strict package access and cover-letter changes](STRICT_PACKAGES_AND_COVER_LETTERS.md) supersede earlier automatic Free access and fallback behaviour. Migration 024 makes package limits the default for every commercial feature.

Updated 7 November 2026. Payment integration remains disabled.

## Admin configuration

Each package in **Pricing → Packages → Edit** now offers:

- **Hero card:** a large featured card with benefits shown immediately.
- **One-line offer:** a compact horizontal offer with expandable exact benefits, in a separate Quick offers area. Both layouts can appear together.
- **Package coin colour:** Emerald, Gold, Sapphire, Amethyst, Rose or Slate, adapted for light and dark mode.

**Pricing → Store presentation** controls the balance coin colour and separate switches for publishing packages in the Store and showing them on the landing page. Turning off the Store also pauses new free claims. The former global Simple/Showcase layout selector has been replaced by per-package layouts.

Each package also has **Show this package on the landing page**. A hidden package remains available in the authenticated Store if published. Only packages eligible for landing visibility reach the public pricing endpoint or embedded catalogue. Hidden pricing removes the landing section, navigation link and promotion banner.

Both styles use shared ReGen coin artwork, fonts, palette and controls. Existing configurable promotion glow/shine effects remain available. One-line offers use restrained effects; Hero cards use a broader glow. Motion respects reduced-motion preferences. The balance card has the same coin mark and displays base and saved tokens separately. Header and Store totals update from the same response, with protection against an older pricing response overwriting a newer balance. See [account packages and layouts](ACCOUNT_PACKAGES_AND_LAYOUTS.md) for grant management and token correction rules.

## Free claim offers

In **Pricing → Packages → Edit → Free claim offer**, enable claims and set a start, end and total account limit. Dates are entered in the administrator’s local time and stored as UTC. A package may have a zero money price. Paid checkout remains disabled regardless of price; enabling claims is an explicit separate setting.

- One claim per verified active account per package, including later claim periods. Create a new package for a new giveaway.
- Claims are free. They grant a snapshot of the configured features, template tiers/unlocks, validity and saved tokens. Feature validity starts at the claim; saved tokens do not expire.
- Claim capacity cannot be reduced below claims already recorded. Increasing capacity does not let an earlier claimant claim again.
- Upcoming, expired, fully claimed, unpublished and paused offers cannot be newly claimed. Previously claimed offers show Claimed.
- Admin grants remain separate and do not consume public claim capacity.

The server checks authentication, email verification, account state, CSRF, package version, publication, the claim window and capacity. Account and package row locks, unique claim records, wallet changes and grant creation share one transaction. Retries return the original grant without duplicating tokens or benefits. Account deletion removes account links but preserves the aggregate claim count, so it cannot replenish a giveaway’s capacity. Public responses expose aggregate availability without claimant identities.

Visitors following an offer sign in first and return to the Store. The return hint expires after 30 minutes and can only point to the fixed local Store route. Google sign-in uses the same fixed return destination.

## Landing page

The page introduces the resume editor, optional Assist me/Refine suggestions, matching cover letters and document downloads through product examples. Samples are labelled as fictional or illustrative. No testimonials, customer counts, employer endorsements, ATS success rates or employment guarantees have been added.

Hero packages use a horizontal collection with previous/next controls, touch/keyboard scrolling and View more. Six hero cards are initially shown. One-line offers have a separate list, initially showing four with View more. Each section loads independently. There is no automatic carousel movement. Public offers refresh and are hidden on failed/offline refreshes rather than presented as current. The interactive sample workflow and existing privacy choices remain available.

## Deployment and verification

Apply missing migrations through **023_package_layouts_and_account_management.sql** before replacing application files. Fresh installations use the current `database/schema.sql`. Existing packages retain landing visibility by default and free claims remain disabled until configured. Migration 023 copies the old global layout onto existing packages once.

The configured local development database has received migrations 022 and 023. The idempotent local-only helpers are:

```powershell
php scripts/migrate-package-claims-local.php
php scripts/migrate-account-packages-local.php
```

Focused checks:

```powershell
php scripts/check-package-claims.php
php scripts/check-account-packages.php
php scripts/check-commercial-packages.php
php scripts/check-template-packages.php
php scripts/check-store-http.php
node scripts/check-commerce-ui.mjs
node scripts/check-api-client.mjs
composer check
```

Disposable database/HTTP tests cover final-place contention, repeat claims, forged fields, insufficient eligibility, expiry, capacity editing, snapshot grants, privacy and sign-in return. Browser review covers both designs, saved configuration, landing opt-out, individual visibility, long-catalogue pagination, real free claiming, matching balances and the sample writing/letter workflow at desktop, 390px and 320px sizes. Public CSS remains one request under the existing 65 KB budget. No real AI requests, messages or payments are made.
