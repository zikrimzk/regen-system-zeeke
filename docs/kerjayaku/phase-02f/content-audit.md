# Kerjayaku. — Phase 02F Content Audit

## 1. Executive Summary
Phase 02F resolves systemic content, positioning, and storytelling issues identified following Phase 02E. The application is firmly established as **Kerjayaku.** — an integrated Malaysian career platform with Mochi AI as its signature career companion, rather than merely an "AI Resume Builder".

This audit catalogues every public-facing section, contrasting previous shortcomings against Phase 02F production implementations.

---

## 2. Issues Audit & Resolutions

| # | Identified Defect in Phase 02E | Root Cause in Codebase | Phase 02F Resolution & Impact |
|---|---|---|---|
| 1 | **Excessive text density** | Sections contained large unbroken paragraphs (50–90 words) causing cognitive fatigue. | Enforced strict concise copy rules: headlines 4–10 words, descriptions 15–35 words, bullet items 4–8 words with clear typographic hierarchy. |
| 2 | **Resume builder dominance** | Hero visual was dominated by a large resume canvas, reinforcing the narrow "resume builder" perception. | Transformed the Hero right-side visual into a **Multi-Tool Career Readiness Card**: Mochi companion status, 3 readiness indicators (Profile, Docs, Interview), and compact ATS style switcher (`id="hero-template-controls"`). |
| 3 | **Inconsistent BM & EN copy** | Malay strings were hardcoded inside `landing.html` (e.g. "Ekosistem Kerjaya Lengkap", "Pilihan gaya", footer text), leaking into the English view. | Replaced 100% of hardcoded strings with `{{i18n.public.*}}` tokens in `InterfaceText.php`. Both EN and MS now provide distinct, idiomatic, culturally natural copy with zero cross-contamination. |
| 4 | **Inconsistent logo color on Auth** | On `/login` and `/register`, `.auth-home` inherited default `a { color: var(--primary) }` (red), while `tokens.css` was not linked, causing an all-red logo. | Explicitly defined `.product-wordmark` and `.auth-home` in `tokens.css`, `main.css`, and `auth-journey.css` (`color: var(--text)` + `span { color: var(--brand-red) }`), and linked `tokens.css` in auth views. Logo is now identical across Landing, Login, and Register. |
| 5 | **Weak pricing design** | `.landing-package-rail` lacked CSS layout rules, causing undefined stacking on desktop and overflow on mobile. | Added dedicated CSS: desktop uses balanced 3-column grid (`repeat(3, minmax(0, 1fr))`); mobile (<850px) uses full-width stacked vertical cards with zero horizontal scroll. |
| 6 | **Repetitive feature showcases** | Multiple consecutive sections used identical "heading + 3 cards" structures. | Re-architected with varied visual storytelling: interactive Mochi character stage, 3-step Assist Me visual workflow, side-by-side Refine Me Before/After comparison, and 4-stage Career Roadmap. |
| 7 | **Weak Mochi & AI storytelling** | Assist Me and Refine Me were not clearly showcased; Mochi's role was unclear. | Dedicated showcases for Mochi (3 guidance pillars), Assist Me (prompt-to-draft flow), and Refine Me (subtle polish with human approval), emphasizing ethical AI without hallucinations. |
| 8 | **Inconsistent visual hierarchy** | Scattered margins and arbitrary spacing across sections. | Standardized on 4/8-based token spacing (`--space-6`, `--space-10`, `--space-16`), soft neutral separators, and subtle surface elevation. |

---

## 3. Section-by-Section Content Verification

### 3.1 Hero Section
- **Kicker / Badge:**
  - EN: `Malaysian Career & AI Platform`
  - MS: `Platform Kerjaya & AI Malaysia`
- **Headline (6 words):**
  - EN: `"Be ready for your next opportunity."`
  - MS: `"Bila peluang datang, anda dah bersedia."`
- **Supporting Description (18 words):**
  - EN: `"Discover career preparation tools built for Malaysians, with Mochi by your side as you take your next step."`
  - MS: `"Kerjayaku menghimpunkan pelbagai alat persediaan kerjaya dalam satu platform, bersama Mochi yang membantu anda melangkah dengan lebih yakin."`
- **Trust Indicators:**
  - Calon intern, graduan & profesional / Interns, graduates & professionals
  - Bimbingan pintar Mochi AI / Encouraging Mochi AI coaching
  - 16 reka letak resume mesra ATS / 16 ATS-friendly resume layouts

### 3.2 Mochi Flagship Showcase
- **Headline:**
  - EN: `"Meet Mochi, your career companion"`
  - MS: `"Kenali Mochi, teman kerjaya anda"`
- **Tagline:**
  - EN: `"Unsure where to start? Mochi guides your preparation with smart feedback and interview coaching without the robotic tone."`
  - MS: `"Tak pasti nak mula dari mana? Mochi membimbing anda di setiap langkah persediaan, memberikan maklum balas pintar dan latihan temu duga tanpa nada kaku."`
- **Pillars:**
  1. *Mindful & Grounded Advice* (Bimbingan Mesra & Berhemah) — never invents qualifications.
  2. *Genuine Bilingual Support* (Dwibahasa Sebenar) — natural Malaysian English & Bahasa Melayu.
  3. *Structured Interview Practice* (Latihan Temu Duga Realistik) — STAR method coaching drills.

### 3.3 Assist Me Workflow
- **Concept:** Visual 3-step prompt-to-draft progression showing how candidates who get writer's block start their drafts.
- **Steps:**
  - Step 1: Input experience (Share roles, duties, achievements).
  - Step 2: Instant structured draft (AI organizes points into professional action statements).
  - Step 3: Full human control (Review, edit, or reject before saving).

### 3.4 Refine Me Comparison
- **Concept:** Side-by-side Before/After card showing clear phrasing enhancement with action verbs, measurable workplace impact, and human approval.

### 3.5 Career Ecosystem Roadmap
- **Concept:** 4-stage sequential progression with authentic status badges:
  - Stage 1: Preparation (Available Now / Tersedia Sekarang) — Master Profile, 16 ATS Templates, Mochi drafting.
  - Stage 2: Tailoring (In Development / Sedang Dibangunkan) — Job Description Analysis, ethical keyword alignment.
  - Stage 3: Application (In Development / Sedang Dibangunkan) — Application Tracker, deadline management.
  - Stage 4: Progression (In Development / Sedang Dibangunkan) — Mochi Mock Interviews, STAR technique coaching.

### 3.6 16 ATS Templates Gallery
- Category filter buttons (All Designs 16, Basic Designs, Premium Exclusive).
- Fluid carousel with navigation arrows, responsive thumbnails, and modal preview drawer.

### 3.7 Commercial Pricing
- Full transparency: 100% one-time payments in Ringgit Malaysia (RM) through HitPay.
- No auto-renewal, no recurring subscriptions, no deceptive paywalls.

### 3.8 Frequently Asked Questions (FAQ)
- 7 comprehensive, truth-grounded answers addressing privacy, pricing, trying without an account, changing templates, AI ethics, mobile/PWA access, and Mochi's unique coaching role.
