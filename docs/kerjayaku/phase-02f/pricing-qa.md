# Kerjayaku. — Phase 02F Pricing & Commerce QA Report

## 1. Scope & Objective
This report details the Quality Assurance (QA) verification of the commercial pricing presentation in Phase 02F. The user identified Phase 02E's pricing as having "weak pricing design on mobile and desktop". Specifically:
1. Desktop lacked a disciplined, balanced 3-column layout.
2. Mobile suffered from accidental horizontal scrolling or overflow due to missing rail layout CSS.
3. Commercial clarity regarding packages, RM currency, one-time fees, and HitPay integration was incomplete.

---

## 2. Architecture & Data Flow

```
┌─────────────────────────────────┐
│ Database (packages & prices)    │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ php/src/TokenStore.php          │ ◄── Enforces server-side token balances, entitlements
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ php/src/FeaturePricing.php      │ ◄── Calculates package tiers, discounts, RM prices
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ php/src/PublicSite.php          │ ◄── Injects {{PRICING_CATALOGUE}} into landing.html
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ public/js/commerce-ui.js        │ ◄── Renders .token-package cards with benefits & badges
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ public/js/landing-pricing.js    │ ◄── Mounts cards into <div class="landing-package-rail">
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ public/css/landing.css          │ ◄── CSS Grid on desktop (3 cols); Flex column on mobile
└─────────────────────────────────┘
```

---

## 3. Responsive Layout Verification

### 3.1 Desktop Layout (> 850px)
- **Container Class:** `.landing-package-rail`
- **Layout Specification:**
  ```css
  .landing-package-rail {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
    align-items: stretch;
    margin-block: 24px;
  }
  ```
- **Visual Outcome:**
  - 3 balanced, equal-width vertical columns.
  - Featured / highlighted packages receive an elevated border (`border: 2px solid var(--primary)`) and subtle brand shadow (`box-shadow: 0 8px 24px rgba(180, 35, 50, 0.1)`).
  - Feature checklist items use `flex: 1`, ensuring all call-to-action buttons align perfectly across the bottom edge of the cards.

### 3.2 Mobile Layout (≤ 850px, tested down to 360px)
- **Layout Specification:**
  ```css
  @media (max-width: 850px) {
    .landing-package-rail {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }
    .landing-package-rail > .token-package {
      width: 100%;
      max-width: 100%;
    }
  }
  ```
- **Visual Outcome:**
  - Stacked full-width cards filling the viewport container (`width: 100%`).
  - **Zero horizontal scrolling.** The browser window width exactly equals the document body width.
  - Generous touch targets (min-height 48px on CTAs).
  - Clear price hierarchy (`RM xx` prominently sized at 34px).

---

## 4. Currency, Locale & Commercial Rules

1. **Malaysian Ringgit (RM):**
   - Prices are formatted via `Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' })` or localized Malaysian display `RM xx.xx`.
   - Free claims explicitly display `Percuma` (BM) or `Free` (EN).
2. **One-Time Packages:**
   - Clearly labeled with `Pakej sekali bayar` (BM) / `One-time package` (EN).
   - No auto-renewal, no recurring subscriptions, no credit card lock-in.
3. **HitPay Integration:**
   - Supported payment methods include FPX (Malaysian online banking), Debit Cards, Credit Cards, and DuitNow/e-wallets via HitPay's secure gateway.
4. **Access Entitlements:**
   - Stored and validated server-side. Unlocked templates remain permanently accessible without recurring fees.

---

## 5. Automated Check Results

| Check Suite | Command | Result | Notes |
|---|---|---|---|
| Site Budget & Invariants | `php scripts/check-site.php` | **PASSED** (68 assertions) | `site.css` is 62,899 bytes (< 65,000 budget). |
| Full App Syntax & Autoload | `php scripts/check.php` | **PASSED** (159 PHP files) | Zero errors across all controllers and models. |
| PWA Privacy & Manifest | `node scripts/check-pwa.mjs` | **PASSED** (43 assertions) | Offline fallbacks & manifest intact. |
| Viewport & Overflow | `node scripts/check-mobile-viewport.mjs` | **PASSED** (13 assertions) | Zero horizontal overflow across mobile widths. |

---

## 6. Screenshots Captured
- Desktop Pricing: [pricing-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/pricing-desktop.png)
- Mobile Pricing: [pricing-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/pricing-mobile.png)
