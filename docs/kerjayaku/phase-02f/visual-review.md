# Kerjayaku. — Phase 02F Visual Review & Design Audit

## 1. Overview
This document compiles the visual audit for Phase 02F across desktop (1440px / 1280px) and mobile (390px / 360px) viewports in both Light and Dark appearance themes.

Every screenshot referenced here was captured directly from the live running application via headless Chrome automation (`scripts/capture-phase02f.mjs`) and saved into `docs/kerjayaku/phase-02f/screenshots/`.

---

## 2. Brand Identity & Logo Verification

### The Defect in Phase 02E
In Phase 02E, users reported that the Kerjayaku logo appeared completely red on the Login and Register pages.
- **Root Cause:** In `login.html` and `register.html`, `<a class="auth-home">` was inheriting `a { color: var(--primary); }` (`#B42332`) because `tokens.css` was not linked in those files, and neither `auth.css` nor `auth-journey.css` provided an explicit color override for `.auth-home` or `.product-wordmark`.
- **Phase 02F Fix:**
  1. Linked `/css/tokens.css` directly in `login.html` and `register.html`.
  2. Declared `.product-wordmark { color: var(--text, #202124); }` and `.product-wordmark span { color: var(--brand-red, #B42332); }` across `tokens.css`, `main.css`, and `auth-journey.css`.
  3. Declared explicit dark theme styles (`:root[data-theme="dark"] .product-wordmark { color: #f5f5f5; }` and `span { color: #d93848; }`).
- **Visual Result:**
  - On Landing, Login, and Register, the wordmark displays **identically**:
    - **Light Mode:** Charcoal neutral `"Kerjayaku"` (`#202124`) with an energetic brand red dot `"."` (`#B42332`).
    - **Dark Mode:** Crisp neutral off-white `"Kerjayaku"` (`#F5F5F5`) with vibrant brand red dot `"."` (`#D93848`).
  - The logo is **never all-red** on any page.

---

## 3. Desktop Review (1440px / 1280px)

### 3.1 Hero Section
- **Visual Concept:** Replaced the previous single dominant resume canvas with a **Multi-Tool Career Readiness Card**.
- **Left Side:**
  - Refined platform kicker badge: `Platform Kerjaya & AI Malaysia`
  - Punchy 6-word headline: `"Bila peluang datang, anda dah bersedia."`
  - Concise 18-word supporting description.
  - Primary CTA (`Mula Secara Percuma →`) and Secondary CTA (`Terokai Platform ↓`).
  - 3 clean trust indicators.
- **Right Side (Career Hub Card):**
  - Mochi Companion banner with avatar.
  - 3 Career Readiness pillars: Master Profile, 16 ATS Documents, STAR Interview Coaching.
  - Compact template switcher (`id="hero-template-controls"`) with live switching and sample PDF link.
- **Artifacts:**
  - Light Mode: [landing-desktop-light.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/landing-desktop-light.png)
  - Dark Mode: [landing-desktop-dark.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/landing-desktop-dark.png)
  - Full Page: [landing-desktop-full.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/landing-desktop-full.png)

### 3.2 Mochi Flagship & AI Showcases
- **Mochi Interactive Stage:**
  - Centered Mochi mascot stage with interactive pet physics, greeting trigger button, and responsive speech bubble.
  - 3 Distinct Guidance Pillars: *Bimbingan Mesra & Berhemah*, *Dwibahasa Sebenar*, *Latihan Temu Duga Realistik*.
- **Assist Me Workflow:**
  - 3-step sequential card progression: Step 1 (Input) → Step 2 (Structured Draft) → Step 3 (Human Control).
- **Refine Me Comparison:**
  - Side-by-side Before/After card comparing an original rough draft with an enhanced action-oriented version, accompanied by 3 value badges.
- **Artifacts:**
  - Mochi Stage: [mochi-showcase-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/mochi-showcase-desktop.png)
  - Assist & Refine: [assist-refine-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/assist-refine-desktop.png)

### 3.3 Pricing Section
- **Layout:** Balanced 3-column vertical grid (`grid-template-columns: repeat(3, minmax(0, 1fr))`).
- **Features:** Clean checkmarked list of included benefits, prominent RM currency display, aligned bottom CTA buttons.
- **Artifact:** [pricing-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/pricing-desktop.png)

### 3.4 FAQ Section
- **Layout:** Two-column split (Heading on left, clean interactive `<details><summary>` accordion list on right).
- **Features:** 7 comprehensive questions with smooth expandable answers and zero nested card borders.
- **Artifact:** [faq-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/faq-desktop.png)

---

## 4. Mobile Review (390px / 360px)

### 4.1 Mobile Landing Page
- **Header:** Compact 68px sticky header with visible brand logo, language toggle pill, and accessible hamburger menu toggle.
- **Hero:** Vertical stacked orientation. Hero copy flows naturally into the Career Readiness Card.
- **Pricing:** Full-width vertically stacked cards with **zero horizontal scrolling or layout shifts**.
- **Artifacts:**
  - Mobile Light: [landing-mobile-light.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/landing-mobile-light.png)
  - Mobile Dark: [landing-mobile-dark.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/landing-mobile-dark.png)
  - Mobile Pricing: [pricing-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/pricing-mobile.png)

---

## 5. Authentication Pages Review

### 5.1 Login Page (`/login`)
- **Desktop Light:** Wordmark displays in dark neutral `#202124` with red dot `#B42332`. Two-column split between brand story and login form.
- **Desktop Dark:** Wordmark displays in off-white `#F5F5F5` with red dot `#D93848`.
- **Mobile:** Single column focused form with full touch-friendly inputs (min-height 48px).
- **Artifacts:**
  - Desktop Light: [login-desktop-light.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/login-desktop-light.png)
  - Desktop Dark: [login-desktop-dark.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/login-desktop-dark.png)
  - Mobile: [login-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/login-mobile.png)

### 5.2 Sign Up Page (`/register`)
- **Desktop:** Balanced layout with career onboarding narrative and accessible registration form with Malaysian state/postcode validation.
- **Mobile:** Streamlined registration form with clear field labels, secure password strength indicator, and direct sign-in link.
- **Artifacts:**
  - Desktop: [register-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/register-desktop.png)
  - Mobile: [register-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02f/screenshots/register-mobile.png)

---

## 6. Summary Matrix

| Review Item | Desktop Light | Desktop Dark | Mobile Light | Mobile Dark | Status |
|---|---|---|---|---|---|
| Brand Logo Color | Neutral + Red Dot | Off-white + Red Dot | Neutral + Red Dot | Off-white + Red Dot | **VERIFIED** |
| Hero Presentation | Career Hub Card | Career Hub Card | Stacked Hub Card | Stacked Hub Card | **VERIFIED** |
| Mochi Showcase | Interactive Stage | Interactive Stage | Stacked Stage | Stacked Stage | **VERIFIED** |
| Assist Me Flow | 3-step Grid | 3-step Grid | Vertical Steps | Vertical Steps | **VERIFIED** |
| Refine Me Compare | Side-by-side Card | Side-by-side Card | Vertical Comparison | Vertical Comparison | **VERIFIED** |
| Pricing Grid | 3 balanced cols | 3 balanced cols | Full-width vertical | Full-width vertical | **VERIFIED** |
| FAQ Accordion | 2-column split | 2-column split | Full-width list | Full-width list | **VERIFIED** |
| Auth Consistency | Identical Wordmark | Identical Wordmark | Identical Wordmark | Identical Wordmark | **VERIFIED** |
