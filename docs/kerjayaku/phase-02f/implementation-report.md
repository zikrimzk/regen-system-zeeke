# Kerjayaku. — Phase 02F Implementation & Delivery Report

## 1. Phase Overview
- **Phase:** Phase 02F — Commercial Landing Page, Brand Consistency & Product Storytelling.
- **Brand Name:** `Kerjayaku.`
- **Primary Mission:** Resolve 8 identified defects from Phase 02E directly in the working codebase without performing an unnecessary rewrite or disturbing the established backend, authentication, database, or candidate tools.
- **Status:** **COMPLETE & VERIFIED**. All automated test suites passed. Awaiting user design review and approval.

---

## 2. Issues Addressed & Implemented

| Issue # | Issue Description | Implemented Solution | Files Modified |
|---|---|---|---|
| 1 | **Excessive text density** | Enforced strict concise copy guidelines across all sections: headlines 4–10 words, descriptions 15–35 words, bullet items 4–8 words. Reduced cognitive load and increased readability. | `php/src/InterfaceText.php`, `php/views/landing.html` |
| 2 | **Resume builder dominance** | Transformed the Hero right-side composition from an oversized resume canvas into a **Multi-Tool Career Readiness Card** with Mochi companion status, 3 readiness indicators (Profile, Docs, Interview), and compact ATS style switcher (`id="hero-template-controls"`). | `php/views/landing.html`, `public/css/landing.css` |
| 3 | **Inconsistent BM & EN copy** | Audited all strings; eliminated 100% of hardcoded Malay strings in `landing.html`. Both English and Bahasa Melayu now load distinct, culturally authentic, professional copy with zero cross-contamination. | `php/src/InterfaceText.php`, `php/views/landing.html` |
| 4 | **Inconsistent logo color on Auth** | Root caused why the logo appeared all-red on Login and Register: `.auth-home` lacked `color: var(--text)` and `tokens.css` was not linked. Fixed in `tokens.css`, `main.css`, `auth-journey.css`, `login.html`, and `register.html`. | `public/css/tokens.css`, `public/css/main.css`, `public/css/auth-journey.css`, `php/views/login.html`, `php/views/register.html` |
| 5 | **Weak pricing design** | Added dedicated CSS for `.landing-package-rail`: balanced 3-column grid on desktop (`repeat(3, minmax(0, 1fr))`) and full-width stacked vertical cards on mobile (≤850px) with **zero horizontal scroll**. | `public/css/landing.css`, `public/css/site.css` |
| 6 | **Repetitive feature showcases** | Designed varied visual storytelling patterns: interactive Mochi character stage, 3-step Assist Me visual workflow, side-by-side Refine Me Before/After card, and 4-stage Career Roadmap. | `php/views/landing.html`, `public/css/landing.css` |
| 7 | **Weak Mochi & AI storytelling** | Created dedicated, prominent showcases for Mochi (3 guidance pillars), Assist Me (prompt-to-draft workflow), and Refine Me (action-verb phrasing polish with human approval), emphasizing ethical AI without hallucinations. | `php/views/landing.html`, `public/css/landing.css`, `php/src/InterfaceText.php` |
| 8 | **Inconsistent visual hierarchy** | Standardized spacing on 4/8-based design tokens, soft neutral separators, subtle card elevations, and removed unstyled or conflicting borders. | `public/css/tokens.css`, `public/css/landing.css`, `public/css/site.css` |

---

## 3. Files Modified & Created

### Core Application Files Modified
1. `php/src/InterfaceText.php` — Complete bilingual copywriting and key additions for Hero, Mochi, Assist Me, Refine Me, Roadmap, Pricing, and 7 FAQ items.
2. `php/views/landing.html` — Re-architected semantic sections (Hero Career Hub, Mochi Stage, Assist Me, Refine Me, Roadmap, Templates, Pricing, FAQ, Footer) using pure i18n tokens.
3. `php/views/login.html` — Added `<link rel="stylesheet" href="/css/tokens.css">` and ensured brand wordmark displays with charcoal text and red dot.
4. `php/views/register.html` — Added `<link rel="stylesheet" href="/css/tokens.css">` and verified brand wordmark styling.
5. `public/css/tokens.css` — Explicit color styling for `.product-wordmark` in light and dark modes.
6. `public/css/main.css` — Standardized `.product-wordmark` and `.auth-home` styles for all application views.
7. `public/css/auth-journey.css` — Added explicit `.auth-home` and `.product-wordmark` color rules.
8. `public/css/landing.css` — Added layout rules for `.career-hub-pillars`, `.assist-workflow`, `.refine-comparison-card`, and `.landing-package-rail` across desktop and mobile.
9. `public/css/site.css` — Recompiled single public stylesheet (62,899 bytes, strictly under the 65,000-byte budget).

### Automation & Test Scripts
10. `scripts/capture-phase02f.mjs` — Automated Chrome headless capture script generating all 15 Phase 02F screenshots.

### Documentation Deliverables Created
11. `docs/kerjayaku/phase-02f/content-audit.md` — Detailed content audit contrasting previous shortcomings with Phase 02F solutions.
12. `docs/kerjayaku/phase-02f/copywriting-en-my.md` — Complete Malaysian English copy reference.
13. `docs/kerjayaku/phase-02f/copywriting-ms-my.md` — Complete Bahasa Melayu copy reference.
14. `docs/kerjayaku/phase-02f/pricing-qa.md` — Comprehensive pricing layout and QA report.
15. `docs/kerjayaku/phase-02f/visual-review.md` — Visual review report referencing all captured screenshots.
16. `docs/kerjayaku/phase-02f/implementation-report.md` — This comprehensive delivery report.

### Screenshots Generated (`docs/kerjayaku/phase-02f/screenshots/`)
- `landing-desktop-light.png`
- `landing-desktop-dark.png`
- `landing-desktop-full.png`
- `mochi-showcase-desktop.png`
- `assist-refine-desktop.png`
- `pricing-desktop.png`
- `faq-desktop.png`
- `landing-mobile-light.png`
- `landing-mobile-dark.png`
- `pricing-mobile.png`
- `login-desktop-light.png`
- `login-desktop-dark.png`
- `login-mobile.png`
- `register-desktop.png`
- `register-mobile.png`

---

## 4. Verification & Automated Check Results

```bash
# 1. Check Full Application PHP Syntax & Autoloading
php scripts/check.php
# Result: PHP syntax, action autoloading and page assets passed (159 PHP files).

# 2. Check Public Site Invariants, Stylesheet Budget & Accessibility
php scripts/check-site.php
# Result: Public asset, label, image and preview checks passed (68 assertions; no network requests).
# Public stylesheet size: 62,899 bytes (Budget: < 65,000 bytes).

# 3. Check PWA Privacy, Caches & Manifest
node scripts/check-pwa.mjs
# Result: PWA cache privacy, offline responses and manifest checks passed (43 assertions; no network requests).

# 4. Check Mobile Viewport, Panning & Overflow
node scripts/check-mobile-viewport.mjs
# Result: Mobile viewport, panning, focus scrolling, dialogs and pinch-zoom checks passed (13 assertions; synthetic events).
```

---

## 5. Scope Boundary Compliance

| Component / Area | Status in Phase 02F | Notes |
|---|---|---|
| Public Landing Page | **Modified & Verified** | Full storytelling, Mochi showcase, Assist Me, Refine Me, pricing, and FAQ overhaul. |
| Login Page (`/login`) | **Branding Fixed** | Fixed wordmark color inheritance (no longer all-red); form untouched. |
| Register Page (`/register`) | **Branding Fixed** | Fixed wordmark color inheritance (no longer all-red); form untouched. |
| Candidate Dashboard | **UNTOUCHED** | Completely preserved. |
| Resume Studio | **UNTOUCHED** | Completely preserved. |
| Cover Letter Studio | **UNTOUCHED** | Completely preserved. |
| Admin Dashboard | **UNTOUCHED** | Completely preserved. |
| Database & Migrations | **UNTOUCHED** | Zero schema or table modifications. |
| Billing & HitPay Backend | **UNTOUCHED** | Commerce APIs and server-side rules strictly preserved. |
| Phase 03 Work | **NOT STARTED** | Paused awaiting user design review and approval. |

---

## 6. Manual QA Checklist

- [x] **Brand Consistency:** "Kerjayaku." displays identically with dark charcoal text and red dot in light mode, and off-white text with red dot in dark mode across Landing, Login, and Register.
- [x] **Language Switching:** Toggling between Bahasa Melayu and English translates 100% of visible copy with zero untranslated fragments.
- [x] **Hero Visual:** Career Hub Card cleanly replaces the oversized resume paper while maintaining live template switching via `id="hero-template-controls"`.
- [x] **Mochi Interaction:** Character stage renders cleanly, plays animation/shadow on click, and displays responsive speech bubble.
- [x] **Assist Me Showcase:** 3-step prompt-to-draft workflow displays cleanly across desktop and mobile.
- [x] **Refine Me Showcase:** Before/After card highlights action verbs and measurable workplace impact.
- [x] **Pricing Responsiveness:** Desktop renders 3 balanced vertical columns; mobile renders stacked full-width vertical cards with zero horizontal overflow.
- [x] **FAQ Accordion:** All 7 questions expand and collapse smoothly via accessible `<details><summary>` elements.
- [x] **Asset Budget:** Single public stylesheet (`site.css`) compiled to 62,899 bytes (< 65,000 bytes budget).
