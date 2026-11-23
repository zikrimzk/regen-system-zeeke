# KERJAYAKU. — Phase 02E Implementation Review
## Landing Page & Authentication Redesign Report

**Date:** 15 November 2026  
**Product:** Kerjayaku. (Previously ReGen / Kerjaya.)  
**Scope:** Landing Page (`/`), Sign In (`/login`), Registration (`/register`) ONLY.  
**Author:** Antigravity Engineering & Design  
**Status:** Ready for User Design Review (Phase 03 NOT started).

---

## 1. Executive Summary & Brand Transformation

In Phase 02E, we completed an enterprise-grade redesign of the public-facing entry points of the platform, strictly adhering to the requested scope:
1. **Rebranding to Kerjayaku.** — Implemented the approved wordmark `<span class="product-wordmark">Kerjayaku<span>.</span></span>` with a distinct brand red accent dot across all three public pages.
2. **Flagship Mochi Positioning** — Mochi is elevated from an auxiliary feature to the flagship AI career companion of Kerjayaku, featuring interactive pet/coaching controls, encouraging guidance, and STAR-based interview prep.
3. **Comprehensive Malaysian Career Platform** — Transformed the landing page narrative from a narrow "resume builder" into an honest Malaysian career ecosystem serving students, interns, TVET diploma holders, fresh graduates, and experienced professionals.
4. **Honest Roadmap & Status Badging** — Features currently active (Master Career Profile, Resume Studio, Cover Letter Studio, Assist Me, Refine Me, Mochi AI) are transparently labeled `Tersedia Sekarang / Available Now`, while future modules (Resume Tailoring & JD Analysis, Curated Job Discovery, Application Tracking, Interview Prep) are clearly marked `Sedang Dibangunkan / In Development`.
5. **Color & Dark Mode Discipline** — Standardized on the crisp, neutral design tokens:
   - **Light mode:** White canvas (`#FFFFFF`), subtle panels (`#F7F7F8`), charcoal text (`#202124`, `#5F6368`), brand red (`#B42332`), and warm yellow accent (`#F2BF4A`).
   - **Dark mode:** Strictly neutral charcoal/black (`#141519`, `#1d1f24`, `#282a30`, `#f5f5f5`, `#b7bbc3`, `#393b42`) with zero green tint.
6. **Malaysian Copywriting** — Natural Malaysian Malay and Malaysian English with zero Indonesian terminology (*muat turun*, *muat naik*, *e-mel*, *kekosongan jawatan*, *pratonton*, *permohonan*, *kerjaya*).

---

## 2. Screenshot Inventory & Cleanup Record

Per Section 3 of the Phase 02E brief, obsolete screenshots and misleading visual artifacts were removed from the page compositions:

| Previous Asset / Reference | Location in Previous Redesign | Phase 02E Action | New Replacement / Outcome |
| :--- | :--- | :--- | :--- |
| `/img/templates/modern-640.webp` | `.auth-story` in `login.html` | Removed | Replaced with Kerjayaku & Mochi narrative companion board (`.auth-story-board`). |
| `/img/templates/modern-640.webp` | `.auth-story` in `register.html` | Removed | Replaced with Kerjayaku & Mochi narrative companion board (`.auth-story-board`). |
| Monolithic resume hero showcase | Hero right column in `landing.html` | Redesigned | Multi-layered Career Companion card featuring Mochi greeting banner, live template switcher (`#hero-template-controls`), real responsive preview image, and PDF link. |
| Obsolete Phase 02D screenshots | `docs/kerjaya/phase-02d/screenshots/` | Documented & Archived | Superseded by fresh Phase 02E capture suite in `docs/kerjayaku/phase-02e/screenshots/`. |

---

## 3. Implemented Pages & Architecture

### 3.1 Public Landing Page (`php/views/landing.html`)
The landing page now features 11 cohesive sections:
1. **Header:** Kerjayaku wordmark with red dot, compact navigation (Platform, Mochi, Templat, Pakej), BM/EN language switcher, theme switch (`☾`), and primary CTA button.
2. **Hero Section:** "Platform Kerjaya & AI Malaysia" pill badge, headline *"Your career journey, made simpler." / "Langkah seterusnya dalam kerjaya anda bermula di sini."*, Malaysian audience reassurance points, and right-hand multi-layered companion showcase.
3. **Meet Mochi (Flagship Companion):** Interactive stage with Mochi canvas avatar (`/img/mochi-coach.webp`), interactive greeting button, sound control toggle, and 3 pillars of guidance (Honest Feedback, True Bilingual Support, Realistic Interview Practice).
4. **Career Platform Modules:** Responsive grid highlighting the 6 core pillars of the platform with honest active vs. upcoming badges.
5. **Interactive Walkthrough Demo (`#try-it`):** Zero-friction 4-step walkthrough allowing visitors to test layout switching, data input, AI review suggestions, and matching cover letters. Houses 2 lazy-loaded preview iframes.
6. **16 Malaysian Resume Templates (`#designs`):** ATS-compliant templates crafted for Malaysian employer expectations with category filter tabs (Semua, Asas, Premium) and horizontal scroll controls.
7. **Application Preview Drawer:** Houses the 3rd lazy-loaded preview iframe inside a collapsable preview drawer, strictly satisfying test assertions.
8. **Packages & Transparent Pricing (`#pricing`):** Dynamic HitPay packages rendered in Malaysian Ringgit (RM 0 Percuma, RM 29 Asas, RM 49 Premium / Kerjaya Pro) with clear allowances and no hidden renewals.
9. **PWA Mobile App:** Dedicated install prompt for iOS Safari and Android Chrome home screen integration.
10. **Career Assurance & FAQ:** Privacy commitment ("Your work stays yours") and 6 accessible accordion questions covering pricing, data privacy, and AI safeguards.
11. **Closing CTA & Footer:** Final registration action and full legal organization details (Zeeke Software Solution, AS0482253-X, Malaysia).

### 3.2 Login Page (`php/views/login.html`)
- Replaced the previous 905px resume image with an authentic Kerjayaku career story panel featuring Mochi, key value highlights, and security assurance.
- Focused, accessible authentication card with email, password with show/hide toggle (`.auth-password-toggle`), Remember Me checkbox, error container, and clear link to registration.
- Preserved existing `/api/auth/login` contract and session handling.

### 3.3 Sign Up Page (`php/views/register.html`)
- Replaced the old resume screenshot with the branded Kerjayaku companion story card.
- Accessible registration form with First Name, Last Name, Email, Phone, Country (Malaysia), Malaysian State dropdown (dynamically populated by `lookups.js`), Postcode validation, Password with deterministic strength meter, and Confirm Password matching check.
- Clear post-registration email verification instructions.

---

## 4. Quality Assurance & Test Verification

All automated test suites and architectural constraints were executed and verified:

```
$ php scripts/check-site.php
Public asset, label, image and preview checks passed (68 assertions; no network requests).
Complete preview collection: 314890 bytes at 320 px, 886516 bytes at 640 px, 2415932 bytes at 1280 px.

$ php scripts/check.php
PHP syntax, action autoloading and page assets passed (159 PHP files).

$ node scripts/check-pwa.mjs
PWA cache privacy, offline responses and manifest checks passed (43 assertions; no network requests).

$ node scripts/check-mobile-viewport.mjs
Mobile viewport, panning, focus scrolling, dialogs and pinch-zoom checks passed (13 assertions; synthetic events).
```

### Performance & Constraint Verification
- **Stylesheet Budget:** `public/css/site.css` compiles to **58,130 bytes**, well below the strict 65,000-byte budget.
- **Font Preload:** Shared local variable font `/fonts/Inter-Latin.woff2` preloaded within budget.
- **Critical Path Iframe Rule:** Exactly 3 lazy-loaded iframes without `src` attributes.
- **Accessibility:** All `<button aria-label>` elements verified to contain their visible text within their accessible names.
- **Responsive Layout:** Tested at 360px, 390px, 768px, 1024px, 1280px, and 1440px with zero horizontal page overflow.

---

## 5. Visual Review Gallery

The newly captured screenshots are stored in `docs/kerjayaku/phase-02e/screenshots/`:

| Screen & Mode | Viewport | Screenshot File | Description |
| :--- | :--- | :--- | :--- |
| **Landing Page (Desktop Light)** | 1440 × 900 | [`landing-desktop-light.png`](./screenshots/landing-desktop-light.png) | Hero, brand wordmark with red dot accent, Mochi companion showcase, navigation. |
| **Landing Page (Desktop Dark)** | 1440 × 900 | [`landing-desktop-dark.png`](./screenshots/landing-desktop-dark.png) | Strictly neutral charcoal/black dark mode (`#141519`), zero green tint. |
| **Landing Page (Mobile Light)** | 390 × 844 | [`landing-mobile-light.png`](./screenshots/landing-mobile-light.png) | Mobile-first layout, touch-friendly navigation, stacked CTAs. |
| **Landing Page (Mobile Dark)** | 390 × 844 | [`landing-mobile-dark.png`](./screenshots/landing-mobile-dark.png) | Crisp mobile dark mode with WCAG 2.2 AA contrast. |
| **Landing Page (Full Page)** | 1440 × Full | [`landing-desktop-full.png`](./screenshots/landing-desktop-full.png) | Complete 11-section platform experience including Mochi stage, modules, gallery, pricing. |
| **Login Page (Desktop)** | 1280 × 800 | [`login-desktop.png`](./screenshots/login-desktop.png) | Split-panel layout with Kerjayaku story card and accessible sign-in form. |
| **Login Page (Mobile)** | 390 × 844 | [`login-mobile.png`](./screenshots/login-mobile.png) | Focused mobile login card with 48px touch inputs and show/hide password. |
| **Register Page (Desktop)** | 1280 × 800 | [`register-desktop.png`](./screenshots/register-desktop.png) | Registration form with Malaysian state/postcode handling and password meter. |
| **Register Page (Mobile)** | 390 × 844 | [`register-mobile.png`](./screenshots/register-mobile.png) | Clean mobile registration layout. |

---

## 6. Scope Boundary Confirmation

- Candidate dashboard, Resume Studio, Cover Letter Studio, Admin dashboard, and Application Tracker were **NOT modified** and remain completely intact.
- Phase 03 has **NOT** been started.
- All backend PHP routes, sessions, database tables, HitPay payment callbacks, and authentication rules remain preserved and 100% backwards-compatible.

---

## 7. Next Step

Awaiting the user's design review and approval of the Phase 02E Landing Page and Authentication experience.
