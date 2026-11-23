# Kerjaya. · Phase 02D.1 Current UI Audit & Visual Defect Inventory

**Product:** Kerjaya. — Malaysian AI Career Platform  
**Date:** 15 November 2026  
**Status:** Baseline audit following Phase 02C rejection. Phase 02D recovery underway.  
**Baseline commit:** `c75b23c` (`main` branch) with verified uncommitted bugfixes in `Storage.php` and `check-release-templates.php`.

---

## 1. Executive Summary

Phase 02C attempted to apply brand tokens and new layouts to ReGen, but the outcome was rejected for being generic, unpolished, visually noisy, and in several key areas less usable than the earlier ReGen 1.0 baseline.

A rigorous audit of the current codebase (`php/views/`, `public/css/`, `public/js/`, and rendered screenshot evidence in `output/kerjaya/phase-02c/` versus `output/regen-v2/phase-02a/`) reveals four fundamental categories of defects:

1. **Repetitive Anti-Patterns & Visual Clutter**: Widespread use of tiny uppercase "eyebrows"/kickers over headings, fake gradients, colored borders around ordinary content cards, and inconsistent font sizes scattered across disparate CSS files.
2. **Brand & Copywriting Inconsistency**: Residue of the legacy "ReGen" brand scattered across public and authenticated screens, combined with a narrow "resume builder" frame that fails to communicate Kerjaya.'s broader Malaysian career companion vision (interns, fresh grads, career switchers, application tracking, interview prep).
3. **Mobile UX Deficiencies**: Crammed sticky headers with competing actions, small touch targets (<44px in toolbars and tabs), awkward inline walkthroughs with 10–11px typography, and risk of keyboard/viewport obstruction.
4. **CSS Architecture Fragmentation**: Conflicting overrides between legacy `landing.css`, `dashboard.css`, and recent patch layers like `public-interface.css`, creating specificity races, orphaned custom properties, and inconsistent dark mode treatments.

---

## 2. Screen-by-Screen Visual & Architectural Defect Inventory

### 2.1 Public Landing Page (`php/views/landing.html`, `public/css/landing.css`, `public/css/public-interface.css`)

| Location / Element | Current Implementation | Defect & Rule Violation | Required Phase 02D Remedy |
| --- | --- | --- | --- |
| **Sticky Header** (`.site-header`) | Blurred floating pill with backdrop-filter (`backdrop-filter: blur(24px); width: min(1180px, calc(100% - 48px)); border-radius: 16px;`) patched in `public-interface.css` to flat bar. | Glassmorphism artifact; on mobile (max-width 850px) contains brand, language link, appearance toggle, and hamburger toggle all competing in 62px height. | Solid, clean, full-width header with 1px neutral border (`--color-line`). Clear hierarchy: Wordmark on left, language toggle + primary CTA on right. Clean mobile menu. |
| **Hero Section** (`.hero`) | Two-column grid with text on left and `.application-sample` on right. | In Phase 02C, the rich skyline/resume artwork was replaced with a wireframe mockup (`.application-sample`) that looks like an unfinished wireframe box rather than an inspiring product showcase. | High-fidelity interactive preview showcasing genuine Malaysian resume designs (e.g. Modern, Classic) with real Malaysian career profiles (intern, fresh graduate, experienced). |
| **Brand Legacy Strings** | Lines in `landing.html` and `InterfaceText.php`: "A real ReGen layout", "ReGen resume and cover letter workspace", "Use ReGen on your phone", "New to ReGen?". | Breaches brand consistency. Product must be Kerjaya. throughout all public and authenticated text. | Complete audit and purge of legacy brand strings in favor of `Kerjaya.` and localized terminology. |
| **Prohibited Eyebrows / Kickers** | `.dash-page-eyebrow`, `.section-kicker` with `text-transform: uppercase; font-size: 11px; letter-spacing: 0.07em;`. | Violates strict anti-generic-AI rule: "Do not repeatedly place tiny uppercase eyebrow text above every giant headline". | Direct, purpose-led headings with clear descriptive subheadings only when adding essential context. |
| **Typography Scale in CSS** | `landing.css` uses arbitrary font sizes: `11px`, `12px`, `13px`, `18px`, `21px`, `27px`, `29px`, `34px`, `48px`, `52px`. | Scatter of unstandardized pixel values instead of tokenized hierarchy. Creates ragged visual rhythm. | Enforce strict typography tokens: Body 16px, Controls 14px, Meta 12–13px, Headings 20px / 24px / 28px, Hero clamp 36–52px. |
| **Interactive Walkthrough** (`#try-it`) | 4-step tabbed box (`.demo-step-tabs`) with 11px text and tiny numeric pills. | On mobile, tabs squish into two columns or truncate numbers; interactive inputs are crammed with 12px disclosure notes. | Purposeful, roomy interactive preview that clearly demonstrates editing, AI suggestions (with clear human-in-the-loop accept/dismiss), and cover letter generation. |
| **Template Gallery** (`#designs`) | Horizontal scroll snapping grid (`.design-gallery`) with tiny 11px badges. | Thumbnails lack visual context; no filter for career stage (intern vs corporate). | Clear responsive gallery with 3-tier viewports, template attributes, real PDF sample links, and clear selection cues. |
| **Pricing Section** (`#pricing`) | Cards with repeated colored borders and badge clutter. | Cluttered package rail with inconsistent button styling between packages and quick token offers. | Calm, transparent pricing cards with clear Malaysian Ringgit (`RM`) pricing, breakdown of included features, and no fake urgency. |

### 2.2 Candidate Dashboard (`php/views/dashboard.html`, `public/css/dashboard.css`)

| Location / Element | Current Implementation | Defect & Rule Violation | Required Phase 02D Remedy |
| --- | --- | --- | --- |
| **Background Treatment** | `dashboard.css` line 12: `radial-gradient(circle at 92% 4%, rgba(34, 193, 129, .08)...)` and grid dots. | Unnecessary decorative gradient blobs and artificial tech patterns that distract from user tasks. | Calm, neutral canvas (`--color-canvas: #f5f7f4`) with subtle surface panels. No decorative gradient blobs. |
| **Resume Command Card** | `.resume-command-card::before` uses a 4px green gradient strip (`linear-gradient(180deg, #25c98a, #10845a)`). | Prohibited decorative border / glowing strip pattern. Violates rule: "Colored borders only for semantic states such as danger/warning/selected". | Clean structural card with neutral border (`--color-line`), prominent resume title, last updated timestamp in Asia/Kuala_Lumpur, and primary "Continue Editing" button. |
| **Eyebrows & Labels** | `.dash-page-eyebrow` (11px uppercase) above "Your workspace". | Generic AI dashboard convention. Uninformative text repetition. | Remove uppercase kicker. Lead directly with candidate greeting and active document status. |
| **Upcoming Features Representation** | Links to Tailor, Jobs, Applications, Interview Prep. | If presented as active, misleads candidates; if hidden completely, hides the broader career platform roadmap. | Clearly indicate "In Development / Akan Datang" with honest feature previews (as currently in `upcoming.html`). Never pretend in-progress features are live. |
| **Token / AI Meter** | `.dashboard-ai-token-card` with floating icons and multiple badge borders. | Visually noisy; creates anxiety over token balances rather than assisting the candidate. | Calm balance indicator in top navigation and clear entitlement summary inside settings/store. |

### 2.3 Resume Studio (`php/views/builder.html`, `public/css/studio.css`, `public/css/stepper.css`)

| Location / Element | Current Implementation | Defect & Rule Violation | Required Phase 02D Remedy |
| --- | --- | --- | --- |
| **Command Bar Hierarchy** | `.studio-command-bar` has 4–5 buttons (`#change-resume-template`, `#resume-layout-settings`, `#preview-open-top`, `#studio-review`). | On mobile (<760px), header wraps awkwardly or hides buttons (`#resume-layout-settings` and `#preview-open-top` are hidden via `display: none`). | Compact, purposeful 2-mode mobile bar: "Write" vs "Preview" tabs, persistent save status, and clear "Sections" drawer trigger. |
| **Mobile Mode Switching** | Patched via `.studio-mobile-modes` toggle between write and preview. | In Phase 02C, preview mode opened an inline iframe modal that broke scrolling on iOS Safari and caused viewport clipping. | Dedicated, clean full-screen preview tab on mobile that respects `100dvh` and safe area insets (`env(safe-area-inset-bottom)`), preserving draft form state. |
| **Stepper / Outline Navigation** | Left sidebar stepper (`#stepper-wrap`) with accordion collapse. | On tablets (768–1024px), sidebar either collapses entirely or squishes form inputs to under 400px. | Flexible 3-column desktop layout (Outline / Editor / Live Saved Preview) collapsing to 2 columns on tablet and single-column with bottom sheet on mobile. |
| **Touch Targets & Form Inputs** | Some form remove/move buttons and tags have 32–36px touch targets. | Violates 44px minimum touch target requirement (WCAG 2.2 AA). | Ensure all buttons, icon buttons, step items, and drag handles meet the strict 44px touch target rule. |

### 2.4 Language & Copywriting (Bahasa Melayu Malaysia vs Indonesian)

| UI Term / Context | Erroneous / Indonesian Term | Correct Malaysian Standard (DBP / Kerjaya.) |
| --- | --- | --- |
| Career Platform | *Platform Karier* | **Platform Kerjaya** |
| Job Vacancies / Roles | *Lowongan Pekerjaan* / *Loker* | **Jawatan Kosong** / **Peluang Kerjaya** |
| Cover Letter | *Surat Lamaran Kerja* | **Surat Iringan** |
| Download | *Unduh* | **Muat turun** |
| Upload | *Unggah* | **Muat naik** |
| Preview | *Pratinjau* | **Pratonton** |
| Email | *Surel* | **E-mel** |
| Personal Info | *Data Pribadi* | **Maklumat Peribadi** / **Butiran Peribadi** |
| File / Document | *Berkas* | **Dokumen** |
| Save Draft | *Simpan Draf* (acceptable) | **Simpan draf** |
| Education Degree | *Sarjana* (often misapplied to all graduates) | **Ijazah Sarjana Muda / Diploma / Sijil** |

---

## 3. Comparison Matrix: ReGen 1.0 vs Phase 02C vs Phase 02D Target

| Dimension | ReGen 1.0 (Baseline) | Phase 02C (Rejected) | Phase 02D (Approved Target) |
| --- | --- | --- | --- |
| **Design Character** | Clean, functional, somewhat stark utility app | Generic AI SaaS, excessive borders, muted grey-green boxiness | Premium, calm Malaysian career workspace; authentic, trustworthy |
| **Color System** | Basic dark/light tokens | Muddled forest green with scattered `#166047`, `#175543`, `#25c98a` | Refined Forest Green accent (`#175543`), warm neutral canvas (`#f5f7f4`), strict semantic borders |
| **Typography** | Inter with default scale | Inter with arbitrary sizes (11px to 52px) & uppercase kickers | Strict tokenized typographic scale: 16px body, 14px controls, direct purposeful titles |
| **Mobile UX** | Functional PWA, good viewport control | Fragile sticky headers, squished walkthrough tabs, mobile preview glitch | Mobile-first architecture (360–390px native feel), sticky bottom safe zones, 44px targets |
| **Brand Copy** | "ReGen - Resume Generator" | Mixed "ReGen" and "Kerjaya." strings; narrow resume scope | "Kerjaya. — Malaysian AI Career Platform"; broad career companion scope; zero legacy mentions |
| **PWA & Offline** | Deterministic service worker caching | Timing issues in offline simulation tests | Rock-solid PWA with consent-gated public caching, privacy-preserving private views |

---

## 4. Phase 02D.1 Action Plan

To restore product excellence and recover from Phase 02C rejection:
1. **Design Tokens Foundation**: Formalize `design-tokens.md` with zero ambiguity on colors, spacing, typography, radii, elevation, and dark mode.
2. **Terminology Glossary**: Complete `terminology-glossary.md` covering both English (MY) and Bahasa Melayu (MY).
3. **Realistic Landing Page Prototypes**:
   - Build a mobile-first, high-fidelity prototype in `prototypes/kerjaya/phase-02d/` featuring both English and Bahasa Melayu.
   - Present Kerjaya. truthfully: showcase active Resume Studio, Cover Letter Studio, 16 PDF templates, Mochi companion, and transparent packages, while framing the broader career platform roadmap.
   - Run CDP test harness across 320, 360, 390, 430, 768, 1024, and 1440px viewports in light and dark modes.
   - Capture rendered screenshots for explicit user review.
4. **Pause for User Approval** before touching production templates.
