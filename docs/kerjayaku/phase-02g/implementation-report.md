# Kerjayaku Phase 02G — Engineering & Implementation Report

**Phase:** 02G (Premium Commercial Experience & Interactive Landing Page)  
**Date:** November 2026  
**Engineering Lead:** Core Development Team  
**Scope:** Landing Page, Login Page, Registration Page, Shared CSS Bundle, Pricing Carousel

---

## 1. Scope Boundary & Strict Preservations

In strict accordance with Phase 02G instructions:
- **Modified Surfaces:** ONLY the public landing page (`landing.html`), login page (`login.html`), registration page (`register.html`), and their direct supporting client scripts and stylesheet bundles (`landing.js`, `landing-pricing.js`, `landing.css`, `tokens.css`, `InterfaceText.php`).
- **Unmodified Surfaces:** Candidate Dashboard, Resume Studio, Cover Letter Studio, Admin Management Portal, and HitPay backend payment transactions were strictly preserved without modification.
- **Architectural Integrity:** The PHP 8.3 MVC architecture, database models, session handlers, and security boundaries remain untouched.
- **Next Phase Restraint:** Phase 03 was NOT initiated. Execution halts for explicit user design review.

---

## 2. Inventory of Modified Files

| File Path | Nature of Changes |
| :--- | :--- |
| `php/src/InterfaceText.php` | Authored polished Malaysian copywriting for hero headline, platform highlight pill, pricing title, and carousel ARIA accessibility tags. |
| `php/views/landing.html` | Added `.hero-highlight-pill` in hero introduction, eliminated duplicate `pricingSubtitle` stutter in pricing heading, ensured 3 lazy iframes invariant. |
| `public/js/landing-pricing.js` | Suppressed duplicate `.section-heading` on landing page; introduced mobile carousel markup with Prev/Next buttons and dot indicators; implemented reactive scroll observer and touch/click synchronization. |
| `public/css/landing.css` | Implemented `.pricing-carousel-wrapper`, responsive mobile scroll-snap rail (`85%` card width with peek), `.pricing-carousel-controls`, `.pricing-dot` pill state, desktop 3-col grid overrides, subtle neutral `.site-sign-in` styling, and `.hero-highlight-pill`. |
| `public/css/site.css` | Recompiled single blocking production stylesheet (64,303 bytes, well below the 65,000 bytes hard budget). |
| `scripts/capture-phase02g.mjs` | Created high-fidelity multi-viewport CDP screenshot capture script for Phase 02G. |

---

## 3. Key Technical Challenges & Solutions

### A. Duplicate Pricing Heading Removal
- **Problem:** `landing.html` already defines `<div class="section-heading">` above `#landing-pricing`. Meanwhile, `landing-pricing.js` was also rendering an identical `.section-heading` dynamically inside `#landing-pricing`.
- **Solution:** Updated `landing-pricing.js` line 50 to output an empty string when `!standalone`. The semantic HTML heading in `landing.html` serves as the single source of truth.

### B. Mobile Touch-Snap Carousel Architecture
- **Problem:** On mobile, pricing cards were stacked in a long vertical list.
- **Solution:** Converted the mobile rail to an edge-to-edge swipeable container using CSS `scroll-snap-type: x mandatory` with card width `85%` (allowing a 24px peek of the next card). Attached a passive `scroll` listener using `requestAnimationFrame` to keep dot indicators (`aria-selected`) and Prev/Next button disabled states in continuous sync.

### C. Navbar Visual Conflict
- **Problem:** The sign-in link previously competed with the primary CTA button.
- **Solution:** Styled `.site-sign-in` as a clean secondary ghost button with `var(--surface-2)` background and subtle border on hover, allowing `.btn-primary` ("Bina resume saya") to clearly dominate as the conversion CTA.

### D. Single Stylesheet Budget Compliance
- **Problem:** `scripts/check-site.php` enforces a strict 65,000 byte budget for `public/css/site.css`.
- **Solution:** Optimized redundant selectors in `landing.css`, allowing `build-site-css.php` to produce a bundle of exactly 64,303 bytes (697 bytes of safety headroom).

---

## 4. Verification & QA Status

- `php scripts/check.php`: **Passed** (159 files).
- `php scripts/check-site.php`: **Passed** (68 assertions).
- `node scripts/check-pwa.mjs`: **Passed** (43 assertions).
- `node scripts/check-mobile-viewport.mjs`: **Passed** (13 assertions).
- Multi-viewport screenshots: **All 17 screenshots captured** in `docs/kerjayaku/phase-02g/screenshots/`.

---

## 5. Next Phase Handoff & Pausing Note

Phase 02G is complete and fully verified. In compliance with project guidelines, execution is now paused for user review and approval before any subsequent work commences.
