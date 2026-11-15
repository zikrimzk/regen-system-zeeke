# Account packages and Store layouts

**8 November update:** [Strict package access and cover-letter changes](STRICT_PACKAGES_AND_COVER_LETTERS.md) supersede earlier automatic Free access and fallback behaviour. Migration 024 makes package limits the default for every commercial feature.

Updated 7 November 2026. Paid checkout remains disabled.

## Per-package presentation

In **Pricing → Packages → Edit**, choose **Hero card** or **One-line offer** for each package. Hero cards appear under Featured packages. Compact offers appear separately under Quick offers; desktop offers show the name, token quantity or benefit count, price and action in one line. Details expand below. Mobile offers keep the name and price together, with actions below.

The two types coexist and paginate independently. The landing page uses the same choice, with a scrolling hero collection and a separate compact list with View more. Global and individual landing visibility switches still apply. Changing presentation does not change entitlement or billing behaviour.

Each package has a coin colour: Emerald, Gold, Sapphire, Amethyst, Rose or Slate. **Pricing → Store presentation → Balance coin colour** sets the wallet illustration separately. Shared SVG artwork and theme-sensitive contrast support light and dark appearance. Optional glow/shine effects respect reduced-motion settings.

## Managing a user's packages

Open **User accounts → select an account → Packages**. The history includes active, expired and revoked grants. One user can hold multiple independent packages, including repeated grants of the same package. Each grant retains its own usage, expiry and template unlocks.

- **Add package** creates another grant. The included saved-token credit is an explicit checkbox, enabled by default.
- **Adjust access** changes this grant's features, total allowances, Unlimited settings, template tiers and expiry. Recorded usage, distinct template unlocks and live reservations remain counted. A finite limit cannot fall below consumption already used or held. Unchecked features stop granting access without deleting their history.
- **Change package** adds the chosen replacement and revokes only the selected old grant in one transaction. Crediting the replacement's tokens is off by default. Other grants remain active.
- **Revoke access** stops the selected grant's future benefits and releases its unfinished reservations. Revocation requires a reason and remains visible in history. Add a new grant if access should be restored.

Saved documents keep their current template, matching the existing expiry behaviour. Selecting another template requires a valid active grant or an existing gallery unlock. Access changes do not alter previously saved writing.

## Saved-token corrections

Adjusting or revoking feature access does not silently change the wallet. For a mistaken token-bearing grant, Change package and Revoke access offer **Reverse the original saved-token credit**. The server derives the amount from that grant's recorded credit and checks the account's available, unreserved saved balance. An insufficient balance rejects the entire correction; no replacement or partial revocation is committed. A repeated request cannot reverse twice.

Token credits are fungible after issuance; the system cannot identify which grant's individual coins were spent. The reversal therefore checks the current wallet. Partial corrections can be made through the existing AI & bonus balance control with an audit reason. Package replacement is an access correction, not an automatic monetary refund or price exchange.

Revoking a free-claim grant does not erase its claim record or replenish campaign capacity. The same account cannot claim that package again. Admin grants do not consume campaign capacity.

## Authorization and consistency

Grant history requires **View user accounts**. Mutations and the grant catalogue also require the separate **Manage account packages** permission (`users.packages`). General account management alone cannot issue currency-bearing packages. Super administrators have this permission; delegated administrators must be assigned it explicitly.

Authenticated routes retain CSRF, rate limits and account ownership checks. All package corrections lock the account/wallet and selected grant, check the grant/catalogue version, record a unique operation reference and write the audit record in the same transaction. Retrying the same operation is idempotent; changing its payload or using stale versions is rejected. Disabled, expired and revoked grants are excluded at both reservation and final settlement. Direct client fields cannot choose credit amounts or another account.

## Deployment and checks

Apply **023_package_layouts_and_account_management.sql** after migration 022 before deploying application changes. Fresh installs use `database/schema.sql`. The one-time upgrade maps the former global Simple setting to One-line offers; other packages start as Hero cards. Original token credits are backfilled from the grant ledger. The configured local development database has been upgraded.

```powershell
php scripts/migrate-account-packages-local.php
php scripts/check-account-packages.php
php scripts/check-commercial-packages.php
php scripts/check-package-claims.php
php scripts/check-template-packages.php
php scripts/check-store-http.php
node scripts/check-commerce-ui.mjs
composer check
```

Disposable database and HTTP checks cover independent grants, consumed/held quotas, template tier changes, revocation, replacement retries/contention, explicit credit reversal, insufficient reversal rollback, delegated permissions, CSRF, cross-account writes and separate catalogue pagination. Browser review covers all account controls, live layout previews, saved colours, matching balances, both themes and 390/320 px layouts. No live payments, provider AI requests or messages are used.
