# Kerjaya. · Phase 02D.1 Landing Page Prototype & Design Foundation Review

**Product:** Kerjaya. — Malaysian AI Career Platform  
**Stage:** Phase 02D.1 (Current UI Audit, Design Tokens, Terminology & Landing Page Prototype)  
**Date:** 15 November 2026  
**Status:** **PENDING DESIGN APPROVAL** (Pause gate before Phase 02D.2)  
**Authoritative Location:** `docs/kerjaya/phase-02d/landing-prototype-review.md`  
**Historical prototype** · `prototypes/kerjaya/phase-02d/index.html` in Git revision `40ed277`.

---

## 1. Context & Purpose of Phase 02D.1

Following the explicit rejection of the Phase 02C implementation for being generic, unpolished, visually noisy, and deficient on mobile devices, Phase 02D initiates an enterprise-grade product recovery.

Phase 02D.1 establishes the foundational design contract and proves it through a functional, standalone landing page prototype before any production views are touched.

### Key Achievements in Phase 02D.1:
1. **Current UI & Defect Audit Completed:** Detailed screen-by-screen inventory documenting legacy brand residue, prohibited visual clutter, and mobile layout failures (`docs/kerjaya/phase-02d/audit-and-visual-defects.md`).
2. **Unified Design Tokens Established:** Formalized typography scale, semantic color palette (Forest Green `#175543`, neutral canvas `#f5f7f4`, dark mode `#111b16`), spacing (8pt/4pt grid), and strict 44px minimum touch targets (`docs/kerjaya/phase-02d/design-tokens.md`).
3. **Malaysian Terminology Glossary Formalized:** Complete bilingual standard for English (Malaysia) and Bahasa Melayu (Malaysia), with strict elimination of Indonesian terminology (`docs/kerjaya/phase-02d/terminology-glossary.md`).
4. **Interactive Landing Page Prototype Built:** Fully responsive, accessible, dual-language prototype with interactive persona switcher, 4-step applicant walkthrough, live template modal preview, and dark/light theme switching.
5. **Headless Chrome CDP Test Suite Executed:** 15 high-resolution screenshot captures spanning 7 viewports (320px to 1440px), both language modes, dark theme, and interactive states with **zero horizontal overflow**.

---

## 2. Eradication of Prohibited Repetitive Anti-Patterns

| Prohibited Pattern (Phase 02C Flaw) | Phase 02D.1 Implementation & Solution | Verification |
| --- | --- | --- |
| **Small uppercase text over giant headings** (e.g. `.dash-page-eyebrow`, `.section-kicker`) | **Completely eliminated.** Headings are direct, purpose-led, and self-explanatory. Secondary copy only exists where it provides substantive context. | Inspected across all sections; zero uppercase kickers used. |
| **Colored borders around ordinary cards** (e.g. green border strips on every card) | **Removed.** Cards use neutral 1px borders (`--color-line: #d3ded9`) and subtle surface contrast (`--color-panel: #ffffff`). Colored borders are reserved strictly for semantic states (featured package, danger, success). | Clean card hierarchy without glowing borders. |
| **Random, unstandardized font sizes** (scatter of `11px`, `18px`, `21px`, `27px`, `34px`, `52px`) | **Strict Tokenized Hierarchy.** Body is locked to readable 16px (`1rem`), controls to 14px (`0.875rem`), metadata to 13px (`0.8125rem`), headings to 22px / 28px, and marketing hero to `clamp(2.15rem, 5vw, 3.45rem)`. | Verified in `prototype.css`. |
| **Fake glassmorphism & excessive blur** (e.g. floating pill headers with `backdrop-filter: blur(24px)`) | **Replaced with solid, purposeful structure.** Clean header with solid surface (`--color-panel`) and neutral bottom border. No distracting blur or fake transparency. | Solid rendering at all viewports. |
| **Generic AI SaaS framing & hype** | **Authentic Malaysian Career Platform.** Tailored for interns, fresh graduates, early-career, and experienced candidates. Honest framing of current capabilities (Resume Studio, Cover Letter Studio, 16 PDF templates, Mochi) and roadmap features (upcoming job tracker and interview prep). | Copy audited and verified. |

---

## 3. Rendered Screenshot Evidence (15 Visual Artifacts)

All rendered screenshots have been captured using headless Chrome DevTools Protocol at 1:1 pixel scale and saved directly to `docs/kerjaya/phase-02d/screenshots/`:

### 3.1 Mobile Viewport Sweep (Primary Mobile-First Verification)

| Viewport | Device Class | Rendered Screenshot | Verification Result |
| --- | --- | --- | --- |
| **320px** | Ultra-compact phone (iPhone SE 1st gen) | [01-landing-mobile-320.png](screenshots/01-landing-mobile-320.png) | **PASS** — Zero horizontal overflow (`docWidth: 320px`). Full button touch targets maintained (44px min). |
| **360px** | Compact Android (Galaxy A-series) | [02-landing-mobile-360.png](screenshots/02-landing-mobile-360.png) | **PASS** — Clean header (56px), legible 16px body, comfortably wrapping hero actions. |
| **390px** | Standard Phone (iPhone 13/14/15) | [03-landing-mobile-390.png](screenshots/03-landing-mobile-390.png) | **PASS** — Flawless mobile hero, thumb-friendly persona pills, responsive walkthrough cards. |
| **430px** | Large Phone (iPhone Pro Max, Galaxy Ultra) | [04-landing-mobile-430.png](screenshots/04-landing-mobile-430.png) | **PASS** — Roomier gutters, elegant single-column document preview. |

### 3.2 Tablet & Desktop Viewport Sweep

| Viewport | Device Class | Rendered Screenshot | Verification Result |
| --- | --- | --- | --- |
| **768px** | Portrait Tablet (iPad Mini / Air) | [05-landing-tablet-768.png](screenshots/05-landing-tablet-768.png) | **PASS** — 2-column journey grid, balanced walkthrough layout, responsive 2x2 template cards. |
| **1024px** | Small Desktop / Tablet Landscape | [06-landing-laptop-1024.png](screenshots/06-landing-laptop-1024.png) | **PASS** — Full desktop navigation, balanced hero split, zero header crowding. |
| **1440px** | Standard Large Desktop | [07-landing-desktop-1440.png](screenshots/07-landing-desktop-1440.png) | **PASS** — Centered 1180px container, generous 40px gutters, calm executive presence. |

### 3.3 Language & Accessibility Verification

| State / Locale | Viewport | Rendered Screenshot | Verification Result |
| --- | --- | --- | --- |
| **Bahasa Melayu (MY)** | Phone (390px) | [08-landing-bm-phone-390.png](screenshots/08-landing-bm-phone-390.png) | **PASS** — 100% Malaysian terminology. No text truncation or overflow with longer Malay strings. |
| **Bahasa Melayu (MY)** | Desktop (1440px) | [09-landing-bm-desktop-1440.png](screenshots/09-landing-bm-desktop-1440.png) | **PASS** — Elegant typographic rhythm across Malaysian career pillars and package descriptions. |
| **Dark Theme** | Phone (390px) | [10-landing-dark-phone-390.png](screenshots/10-landing-dark-phone-390.png) | **PASS** — Deep charcoal-green canvas (`#111b16`), soft jade action (`#8fd1ae`), 14:1 text contrast. |
| **Dark Theme** | Desktop (1440px) | [11-landing-dark-desktop-1440.png](screenshots/11-landing-dark-desktop-1440.png) | **PASS** — Calm, non-glaring dark mode; perfect separation of white paper document preview. |

### 3.4 Interactive Application States

| Interaction State | Rendered Screenshot | Verification Result |
| --- | --- | --- |
| **Hero Persona: Graduate** (Zamir Zaini, Melaka) | [12-hero-persona-graduate.png](screenshots/12-hero-persona-graduate.png) | **PASS** — Live DOM update: displays UiTM Business degree, Power BI internship facts, Melaka address. |
| **Hero Persona: Tech** (Nurul Huda, Cyberjaya) | [13-hero-persona-tech.png](screenshots/13-hero-persona-tech.png) | **PASS** — Live DOM update: displays UM Computer Science degree, TypeScript/PWA skills, Cyberjaya location. |
| **Walkthrough Step 3: AI Wording Diff** | [14-walkthrough-ai-step.png](screenshots/14-walkthrough-ai-step.png) | **PASS** — Clear original vs suggested wording comparison; explicit "Apply Suggestion" user action. |
| **Template PDF Modal Preview** | [15-template-modal-preview.png](screenshots/15-template-modal-preview.png) | **PASS** — True-to-scale PDF preview dialog with accessible close button and raw PDF sample link. |

---

## 4. Mobile Interaction & Usability Audit (320px–430px)

1. **Header Architecture:**
   - On screens `<900px`, the desktop navigation links collapse into an accessible drawer (`#mobile-nav`).
   - The header displays the **Wordmark**, the language toggle (`BM` / `EN`), the theme toggle (`☾ Dark` / `☀ Light`), and the menu toggle button.
   - Primary action ("Create Account") is comfortably reachable in the hero and menu without competing for header real estate.
2. **Thumb Zone Compliance:**
   - All interactive controls (buttons, tabs, inputs, selects, toggles) have a minimum height of **44px** (`var(--target-min)`).
   - Horizontal scrolling tracks (`.persona-selector`, `.walkthrough-steps-nav`) use momentum touch scrolling with no scrollbar clipping.
3. **Keyboard & Input Readiness:**
   - Form inputs inside the walkthrough use a minimum height of 44px, 16px font size (preventing automatic iOS Safari zoom), and clear high-contrast focus rings (`outline: 3px solid var(--color-focus); outline-offset: 3px;`).
4. **Safe-Area Insets:**
   - Respects `viewport-fit=cover` and device safe-areas.

---

## 5. Copywriting & Malaysian Localization Audit

- **Zero Legacy Residue:** Verified zero occurrences of the old "ReGen" brand in the prototype. All headings, meta tags, and footer strings strictly reference `Kerjaya.`.
- **Authentic Malaysian Personas:**
  - *Aina Rahman* (Petaling Jaya, Selangor) — Diploma in Business Studies (Politeknik), retail logistics & inventory.
  - *Zamir Zaini* (Ayer Keroh, Melaka) — BBA Hons (UiTM), market research, Power BI.
  - *Nurul Huda* (Cyberjaya, Selangor) — B.Comp.Sci (Universiti Malaya), frontend PWA development.
- **Strict Bahasa Melayu Standards:**
  - Uses *Surat Iringan* (not *Surat Lamaran*).
  - Uses *Jawatan Kosong* / *Peluang Kerjaya* (not *Lowongan*).
  - Uses *Muat turun PDF* (not *Unduh*).
  - Uses *Pratonton* (not *Pratinjau*).
  - Uses *E-mel* (not *Surel*).
  - Uses *Maklumat Peribadi* (not *Data Pribadi*).
  - Clear Malaysian Ringgit pricing (`RM 0`, `RM 29`, `RM 49`).

---

## 6. Formal Design Approval Gate

> [!IMPORTANT]
> **Design Approval Required Before Production Changes (Phase 02D.2)**
>
> In accordance with the Phase 02D contract ("A successful build, passing automated tests or a completed checklist does not constitute design approval. Do not automatically start Phase 03... Show the rendered results and pause for design approval before proceeding"):
>
> 1. All foundational assets (`audit-and-visual-defects.md`, `design-tokens.md`, `terminology-glossary.md`) and the interactive prototype (`prototypes/kerjaya/phase-02d/`) are complete and verified.
> 2. All 15 rendered screenshots are available in `docs/kerjaya/phase-02d/screenshots/` for your direct visual review.
> 3. **No production PHP views or application styles have been modified yet.**
> 4. We now pause for your explicit review and sign-off on the Phase 02D.1 visual direction, typography, colors, and copywriting before advancing to **Phase 02D.2 (Landing Page Production Implementation)**.
