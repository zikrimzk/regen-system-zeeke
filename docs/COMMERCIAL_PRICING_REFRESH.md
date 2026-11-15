# Commercial pricing and interface refresh

**8 November update:** [Strict package access and cover-letter changes](STRICT_PACKAGES_AND_COVER_LETTERS.md) supersede earlier automatic Free access and fallback behaviour. Migration 024 makes package limits the default for every commercial feature.

Updated 7 November 2026. Payment integration remains disabled.

The follow-up adds Unlimited function benefits, Basic/Premium package collections, distinct template ownership, a redesigned picker and stronger export fulfillment. It requires migration 021 after 020. See [template packages and token protection](TEMPLATE_PACKAGES_AND_SECURITY.md) for the current rules and checks.

Migration 022 adds Simple/Showcase package presentation, landing visibility and limited free claim offers. See [package offers and the landing refresh](PACKAGE_OFFERS_AND_LANDING.md).

## Agreed commercial rules

- Packages have money prices. An administrator can create a feature package, a token bundle, or a combined bundle in **Pricing**.
- Included features have either a usage quantity or workspace access. Feature access can expire after a configured number of days; leaving validity empty means no expiry. Saved tokens do not expire.
- Package benefits are used before individual prices. For an AI action outside a package, its individual price uses base tokens first, then bonus/saved tokens. Other priced actions use the saved wallet.
- An included AI action consumes one package use and no tokens. Failed AI requests release the reservation. Free actions do not spend package uses or tokens.
- Individual free, per-use and one-time unlock settings remain available. Existing unlocks and prepaid uses remain valid.
- Setting an account's AI allowance override to zero still pauses its AI access, as in the existing administration controls. Exhausting a positive base allowance permits the saved-token fallback.
- The admin grant action searches for an account by name/email and records the reason. Grants are idempotent and preserve a snapshot of the package, so future catalogue edits do not change existing benefits.
- No package checkout, payment provider, subscription billing, or client-claimed token crediting has been enabled.

## Screens and settings

The separate admin store navigation has been merged into **Pricing**, with Packages, Individual prices and Store presentation tabs. AI action prices are edited there; the AI usage module retains base allowance and availability settings.

Package configuration includes the original price, promotion start/end, badge, featured styling and optional soft glow or slow shine. Promotions return to the original price at their end. The store and landing page share package cards and refresh the current catalogue. Animation respects reduced-motion preferences; offline landing pages hide cached offers.

Priced action buttons display the current token cost, included uses, prepaid uses or unlock state. New cover letters display the first-save cost; AI, preview and PDF actions require that explicit first save. Subsequent edits are free. Resume autosave is not priced per write.

The dashboard, store and header use the same base-plus-saved balance. **Token activity** is a separate authenticated page, linked from the account menu and balance card. New base spending, package usage, saved-wallet changes and unused prepaid actions are available there. Older base usage cannot be reconstructed from releases that did not retain individual activity records.

The cover-letter workspace has a compact saved-letter selector, two primary job fields, optional recipient/job details, clearer AI pricing, one writing area and consistent save/preview/PDF controls. Saved letters collapse on mobile. Feedback remains in the account menu while editing resumes or letters, leaving navigation and writing controls clear. Landing, authentication and template copy have also been shortened.

## Installation

Existing databases need **020_commercial_packages.sql**, after all prior migrations, before this application version is used. Fresh installations use the updated schema.sql. The migration preserves existing explicit feature prices, moves missing AI prices from legacy operation settings and merges delegated store permissions into pricing permissions.

The configured localhost development database has received migration 020. For another local development database, the idempotent helper is:

```powershell
php scripts/migrate-commerce-local.php
```

The helper refuses remote/production configurations. Apply the SQL migration through the existing deployment process on hosting. Rebuild assets before release, then refresh existing tabs. Configure actual packages and promotional prices in Pricing; screenshot examples are fictional disposable QA data.

## Verification

`composer check` passed: PHP/autoload/assets, public performance budget, document templates, writing, assistance and mail compatibility. Public CSS remains one request below the existing 65 KB limit.

Focused package tests cover migration, grant retries, expiry, immutable benefits, competing workers for a final package use, failure recovery, fallback prices, combined AI billing, activity records and promotion expiry. HTTP tests cover authentication, CSRF, delegated permissions, account lookup, grants, public catalogue privacy, static assets and disabled checkout. Existing spending/refund, feedback/reward, AI accounting and admin permission regression suites also passed.

Browser review covered desktop and mobile store, package editor/grants, explicit cover-letter pricing, shared balances and the resume editor's unobstructed Next button. The mobile pricing table scrolls inside its panel. No real AI requests, messages or payments were made. Disposable QA accounts/databases are removed after verification.
