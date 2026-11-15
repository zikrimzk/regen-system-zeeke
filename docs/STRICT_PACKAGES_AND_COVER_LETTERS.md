# Strict packages and cover letters

Updated 8 November 2026. Payment checkout remains disabled.

## The access model

Global feature availability and commercial entitlement are separate checks. Enabling Cover letters in system controls makes the service operational; it does not grant it to every account. Having base or saved tokens also does not grant access to a strict feature.

**Pricing → Access & token rules** defines each feature's commercial rule:

| Rule | Result |
| --- | --- |
| Package only · strict limits | The active grants must include the feature. Finite allowances stop at zero. No individual credit or token balance bypasses the package. |
| Package + tokens per successful action | Package uses come first. After that, the user must pay the configured token price. AI uses base tokens before saved tokens; other functions use saved tokens. |
| Package + permanent token unlock | For access features, an explicitly purchased permanent unlock can provide access outside a package. It is not a finite package allowance. |
| Everyone · unrestricted free access | An explicit public-access rule. Every account can use the feature without package limits. The admin editor requires acknowledgement of this effect. |

**Package only is the default for all commercial features**, including a feature with a zero token price or a missing price row. Optional token fallback is enabled per feature. Earlier price amounts remain recorded for configuration, but do not automatically enable spending. Switching a feature back to Package only disables old individual unlock/credit fallback for that feature.

Profile, account security, support, the Store and viewing balances remain account services. They do not require a commercial package. Fictional public samples remain public.

## Configuring a usable package

Packages issue only the selected benefits. Workspace access and actions are distinct. For example:

| Basic package benefit | Configuration |
| --- | --- |
| Resume creation | 1 use |
| Resume editing | Included access |
| Resume templates | Basic collection, 2 distinct new unlocks |
| Document previews | Included access |
| Document appearance | Included access, if desired |
| PDF downloads | 5 shared clean downloads |
| Cover letters, new letters and AI letter drafts | Unchecked, so locked |

The editor's **Add resume essentials** selects resume creation, editing, previews, appearance, one Basic template unlock and one download, preserving any limits already selected. Adjust these before saving. **Add supporting access** identifies and selects prerequisites for the chosen actions. A prerequisite can instead be supplied by another active package, which supports add-on packages without silently granting extra benefits.

**User accounts → Manage → Packages → Effective feature access** shows the combined included, locked, exhausted and fallback states, plus any global service pause. Each grant's own usage and expiry remain visible below. Multiple active grants add their finite allowances; an explicitly Unlimited benefit remains unlimited. Expired, disabled and revoked grants supply nothing.

Catalogue edits affect future grants. Existing grants retain the benefits issued at purchase or claim. Use **Adjust access**, **Change package** or **Revoke access** on the account to correct them. This avoids silently changing already-issued commercial benefits. These actions require `users.packages`, an audit reason and the current grant version.

## Enforcement and downloads

Both page navigation and direct API calls check access on the server. Buttons and navigation communicate the same current rules, but cannot grant rights. Excluded functions show Package required; exhausted functions show Limit reached, with a View packages action rather than a token purchase for strict features.

Successful metered actions reserve and consume actual package uses before applying any configured fallback. Failed actions release their reservations. AI cannot use the renewable allowance or saved wallet to escape a strict package boundary. Concurrent workers cannot reserve the same final use.

Resume and cover-letter clean downloads share `pdf_download`. Preview endpoints return a watermarked PDF when downloads are restricted; previews do not consume a clean download. Legacy preview routes use the same protected path. Clean export also validates the current template collection, so a previously saved Premium design cannot be exported through a Basic-only package. Existing writing remains intact; authorized previews remain watermarked. Owned designs may be reused within an active eligible collection; they do not unlock a collection excluded by a strict rule.

Before clean PDF bytes are sent, current template eligibility and usage settlement run under the same account transaction. Revocation during processing cannot release an unauthorized successful result. Cross-site fetch metadata or a foreign referrer also blocks download requests before they can drain an allowance.

## Cover-letter layout and editing

The letter has its own block layout: a compact identity heading, consistent 23 mm margins, dated recipient block, subject, left-aligned paragraphs and a formal closing. It shares the resume's chosen typeface and readable body size without importing resume section decorations. The closing stays with the final paragraph. Long writing flows onto additional pages rather than being clipped or reduced to tiny text. The preview reports the actual page count.

The structure follows the [Purdue OWL guidance on professional letter formatting](https://owl.purdue.edu/owl/job_search_writing/job_search_letters/cover_letters_workshop/formatting_and_organization.html). There is no claim that one format suits every employer; users should follow an employer's specific instructions.

The chosen letter date is saved and does not change on every preview. Existing letters receive their recorded creation date during migration. Recipient and company address are optional fields, separate from optional AI job notes. The body preserves blank-line paragraph breaks and joins pasted soft line wraps. Saving an existing letter does not consume another creation allowance. Earlier clients that omit the new optional fields preserve their saved values. Recovery snapshots include the new metadata. Recipient address and letter date are excluded from AI request data.

## Migration and verification

Apply **024_strict_package_access.sql** after 023 and before deploying application files. It switches earlier commercial rules to Package only, retains the earlier rules in `operations_settings.strict_package_upgrade_024` for administrator review, and adds cover-letter address/date fields. Review existing packages and issued grants for workspace permissions that were formerly supplied by global Free settings. No extra benefits are automatically granted. The configured local development database has been upgraded.

```powershell
php scripts/migrate-strict-packages-local.php
php scripts/check-strict-package-access.php
php scripts/check-account-packages.php
php scripts/check-commercial-packages.php
php scripts/check-template-packages.php
php scripts/check-package-claims.php
php scripts/check-store-http.php
php scripts/check-admin-control-centre.php
php scripts/check-ai-database.php
php scripts/render-cover-letter-review.php
python scripts/check-cover-letter-pdfs.py
composer check
node scripts/check-commerce-ui.mjs
node scripts/check-api-client.mjs
node scripts/check-pwa.mjs
```

The integration checks use disposable local databases, real PDF responses and concurrent PHP workers. Browser review covers Basic-package denial, two successful downloads followed by the hard stop, explicit fallback configuration, effective account access, supporting-access presets, saved dates and desktop/390/320 px letter layouts. Twenty fictional letter exports cover all 16 design choices across six font families, two larger body-size variants, an unnamed recipient and a long letter. PDF checks verify content, readable typography, margins, page counts and closing placement; rendered PNGs receive visual inspection. No provider AI calls, messages or payments are used.
