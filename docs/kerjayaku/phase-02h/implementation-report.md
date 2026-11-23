# Kerjayaku Phase 02H — Engineering Implementation Report
**Document ID:** `docs/kerjayaku/phase-02h/implementation-report.md`  
**Product:** Kerjayaku.  
**Phase:** 02H (Mochi's Animated Career Journey)  
**Status:** Completed & Ready for User Review  

---

## 1. Executive Summary & Scope Delivery

Phase 02H successfully executes the mandate to replace the rejected static feature-based landing page with an **original interactive scrollytelling experience**. Mochi physically travels along a winding, serpentine career path through 11 narrative scenes, directly driven by visitor scroll.

### 1.1 Scope Boundaries Strictly Enforced
- **Updated Only:** Public Landing Page (`landing.html`), Login Page (`login.html`), Registration Page (`register.html`), dedicated pricing view/drawer, Mochi animation modules, and shared tokens/dictionaries.
- **Strictly Preserved:** Candidate Dashboard, Resume Studio, Cover Letter Studio, Admin Management Portal, HitPay payment gateway, database schema, user accounts, and private documents.
- **Strict Gate:** No Phase 03 work has been initiated. This phase is presented for final user design review and approval.

---

## 2. Complete File Inventory

### 2.1 Modified Production Code
1. `php/src/InterfaceText.php`: Added bilingual (Bahasa Melayu & English) localization strings for all 11 scenes (00–10), 4 career chapters, Mochi speech bubble quotes, and interactive auth companion reactions.
2. `php/views/landing.html`: Implemented `#mochi-journey` scrollytelling stage, dynamic SVG serpentine road, floating chapter navigation, 11 milestone waypoints, pricing drawer modal, and compliant lazy template preview modal.
3. `php/views/login.html`: Added `#auth-mochi-avatar` mount, speech bubble, and responsive flex layout with interactive typing/error feedback.
4. `php/views/register.html`: Added registration companion mount with personalized onboarding greetings and live validation feedback.
5. `public/css/landing.css`: Complete styling overhaul for scrollytelling stage, floating chapter bar, Mochi traveler mount, reversible confetti particles, waypoint cards, and mobile bottom-sheet pricing drawer.
6. `public/css/auth-journey.css`: Companion styles for authentication pages, speech bubble callouts, and keyboard-safe responsive scaling.
7. `public/css/site.css`: Recompiled production stylesheet (**57,663 bytes**, well under the 65,000-byte budget).

### 2.2 Added Scripts & Architecture Modules
1. `public/js/vendor/gsap.min.js`: Locally self-hosted GSAP core animation engine (v3.12.5).
2. `public/js/vendor/ScrollTrigger.min.js`: Locally self-hosted ScrollTrigger plugin.
3. `public/js/vendor/MotionPathPlugin.min.js`: Locally self-hosted MotionPath plugin.
4. `public/js/mochi-road.js`: Dynamic SVG serpentine road generator with viewport-adaptive spline curves and coordinate sampling.
5. `public/js/mochi-story.js`: Master scrollytelling timeline controller coordinating scroll scrubbing, Mochi positioning, tangent banking, emotion triggers, and reversible confetti.
6. `public/js/mochi-auth.js`: Interactive authentication companion with focus tracking, tickled typing feedback, and validation error pouts.
7. `scripts/capture-phase02h.mjs`: Automated Playwright test and screenshot capture pipeline.

### 2.3 Documentation & Visual Deliverables
- `docs/kerjayaku/phase-02h/journey-storyboard.md`: Complete 11-scene storyboard and narrative progression.
- `docs/kerjayaku/phase-02h/animation-architecture.md`: GSAP timeline, coordinate sampling, and reversible physics.
- `docs/kerjayaku/phase-02h/mochi-emotion-states.md`: Emotion state dictionary and WebGL character triggers.
- `docs/kerjayaku/phase-02h/mobile-layout-review.md`: Mobile serpentine geometry and touch ergonomics across 320/360/390/430px.
- `docs/kerjayaku/phase-02h/pricing-checkpoint.md`: Transparent value architecture and dedicated pricing drawer.
- `docs/kerjayaku/phase-02h/performance-and-accessibility.md`: WCAG 2.2 AA review, keyboard focus, and CSS budget.
- `docs/kerjayaku/phase-02h/implementation-report.md`: Engineering delivery report (this document).
- 25 high-resolution screenshot captures in `docs/kerjayaku/phase-02h/screenshots/`.

---

## 3. Removal of Obsolete Landing Sections

In strict adherence to instructions, the following repetitive, clunky, or redundant sections were completely removed from `landing.html`:
- ❌ **Standalone Resume Testing Sandbox (`#try-it`):** Removed redundant tabbed walkthrough.
- ❌ **Resume-Generation Demo Form (`#demo-company`):** Removed mock interactive inputs from the public surface.
- ❌ **Large Resume PDF Preview Demonstration (`.landing-examples details.hero-scene`):** Removed heavy PDF mockups.
- ❌ **Separate 16-Template Gallery Section (`#designs`):** Integrated naturally as an interactive preview inside Scene 04.
- ❌ **PWA Installation Promotional Section (`.install-section`):** Removed pushy app-install banner.
- ❌ **Redundant Feature-Card Grids (`#platform`):** Removed generic SaaS card matrices.
- ✅ **Retained:** Natural, bilingual FAQ section (`#faq-title`) addressing candidate privacy, ATS compliance, and pricing transparency.

---

## 4. Zero AI Consumption Verification

All Mochi animations, emotion transitions, eye tracking, ear perking, and confetti physics execute **strictly on the client side** via WebGL and 2D canvas shaders:
- No OpenAI / Anthropic / Gemini API calls are made during public landing page exploration, login, or registration.
- No user tokens are decremented.
- Guest visitors can scroll forward, reverse, open the pricing drawer, and interact with Mochi indefinitely with zero backend operational costs.

---

## 5. Automated Verification Results

All project validation suites executed and passed with zero errors:

```
[1] PHP Syntax & Architecture (php scripts/check.php)
    Files checked: 159 files
    Result: 0 errors detected. PASSED.

[2] Site Invariants & DOM Contracts (php scripts/check-site.php)
    Assertions executed: 65
    Result: 0 violations. PASSED.
    • #hero-template-controls count === 1: PASSED
    • Lazy iframes (loading="lazy") count === 3: PASSED
    • Initial network iframe count === 0: PASSED
    • Accessible name substring matching: PASSED
    • site.css size (57,663 bytes < 65,000 bytes): PASSED

[3] PWA & Offline Manifests (node scripts/check-pwa.mjs)
    Assertions executed: 43
    Result: 0 violations. PASSED.

[4] Mobile Viewport & Horizontal Overflow (node scripts/check-mobile-viewport.mjs)
    Breakpoints tested: 320px, 360px, 390px, 430px
    Result: 0px overflow across all screens. PASSED.
```

---

## 6. Manual QA Verification Checklist

| # | Inspection Item | Verification Result | Verified Screenshot |
| :-: | :--- | :--- | :--- |
| 1 | Scroll down advances Mochi smoothly along curved path | **Verified** | [journey-s1-enter-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s1-enter-desktop.png) |
| 2 | Scroll up smoothly reverses Mochi without jumping | **Verified** | [journey-reverse-scroll-s4.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-reverse-scroll-s4.png) |
| 3 | Scene 00 Hero welcome displays Mochi `wave` and speech bubble | **Verified** | [journey-s0-hero-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s0-hero-desktop.png) |
| 4 | Scene 02 Master Profile unfolds with `sneak` expression | **Verified** | [journey-s2-start-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s2-start-desktop.png) |
| 5 | Scene 03 Career Goals compass needles orient towards MY hubs | **Verified** | [journey-s3-goals-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s3-goals-desktop.png) |
| 6 | Scene 04 Resume Studio template preview pills switch templates | **Verified** | [journey-s4-templates-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s4-templates-desktop.png) |
| 7 | Scene 05 Celebration detonates reversible confetti with `dance` | **Verified** | [journey-s5-celebration-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s5-celebration-desktop.png) |
| 8 | Scene 06 Checkpoint opens dedicated pricing drawer modal | **Verified** | [journey-s6-pricing-checkpoint-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s6-pricing-checkpoint-desktop.png) |
| 9 | Pricing drawer displays 3-column comparative grid on desktop | **Verified** | [pricing-drawer-open-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/pricing-drawer-open-desktop.png) |
| 10 | Pricing drawer displays swipeable card carousel on mobile (390px) | **Verified** | [pricing-drawer-open-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/pricing-drawer-open-mobile.png) |
| 11 | Scene 07 Cover Letter envelope seals and stamps | **Verified** | [journey-s7-letter-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s7-letter-desktop.png) |
| 12 | Scene 08 Job Matching radar sweeps across Malaysian employers | **Verified** | [journey-s8-matching-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s8-matching-desktop.png) |
| 13 | Scene 09 Application Tracker kanban cards glide into place | **Verified** | [journey-s9-applications-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s9-applications-desktop.png) |
| 14 | Scene 10 Interview Success unrolls offer letter and toss | **Verified** | [journey-s10-interview-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s10-interview-desktop.png) |
| 15 | Mobile hero layout on 390px viewport fits cleanly with 0 overflow | **Verified** | [landing-mobile-s0-hero.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/landing-mobile-s0-hero.png) |
| 16 | Login page mounts interactive Mochi companion | **Verified** | [login-desktop-default.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-desktop-default.png) |
| 17 | Keystrokes in login fields tickle Mochi with `laugh` reaction | **Verified** | [login-desktop-typing.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-desktop-typing.png) |
| 18 | Mismatched credentials trigger shake and Mochi `sad` pout | **Verified** | [login-desktop-error-pout.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-desktop-error-pout.png) |
| 19 | Register companion responds dynamically to input focus and typing | **Verified** | [register-desktop-typing.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/register-desktop-typing.png) |
| 20 | Reduced motion OS preference cleanly replaces animations | **Verified** | [landing-reduced-motion-fallback.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/landing-reduced-motion-fallback.png) |

---

## 7. Next-Phase Dependencies & Strict Gate

Phase 02H is complete in accordance with the project contract.

**Gate Condition:** The implementation is paused here. In alignment with explicit instructions, automated test passes and build scripts do not constitute design approval. We wait for user review and approval before proceeding to any subsequent phase.
