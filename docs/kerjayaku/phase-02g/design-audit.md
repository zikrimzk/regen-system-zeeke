# Kerjayaku Phase 02G — Product Design & Visual Audit

**Phase:** 02G (Premium Commercial Experience & Interactive Landing Page)  
**Date:** November 2026  
**Auditor:** Kerjayaku Core Product Team  
**Status:** Verification & Presentation for User Review

---

## 1. Executive Summary & Design Recovery

Following review feedback on Phase 02F, Phase 02G executed surgical refinements targeting five visual and interaction shortcomings:
1. **Pricing Presentation:** Unprofessional and redundant headings replaced with a single, clear semantic title (*"Pilih pelan ikut keperluan anda"* / *"Choose what works for you"*), transparent one-time pricing via HitPay with zero recurring auto-renewals, and elimination of duplicate subtitles.
2. **Mobile Swipeable Carousel:** Implementation of a dedicated mobile carousel (`.pricing-carousel-wrapper`) featuring native CSS scroll-snapping, peek of adjacent cards (85% card width), accessible Prev/Next circular arrow controls, and expanding pill dot indicators.
3. **Hero First Impression & Platform Transparency:** A distinctive hero headline (*"Langkah seterusnya? Biar Kerjayaku bantu"* / *"Ready for what's next? Kerjayaku leads the way"*), coupled with an honest Platform Highlight pill highlighting the 16 ATS templates and Mochi writing support included on free accounts.
4. **Navbar & Sign-In Harmony:** The sign-in action has been transformed from an aggressive red badge into an understated, elegant secondary ghost button that harmonizes with the brand wordmark and directs visual primacy to the *"Bina resume saya"* / *"Get started"* primary CTA.
5. **Authentic Malaysian Storytelling:** Thorough verification of natural Bahasa Melayu and Malaysian English copywriting across all sections, eliminating generic SaaS clichés and Indonesian phrasing.

---

## 2. Visual Hierarchy & Surface Evaluation

| Component / Section | Previous State (Phase 02F) | Phase 02G Refined State | Impact |
| :--- | :--- | :--- | :--- |
| **Site Navigation** | Sign-In button was visually competing with primary CTA and felt like an unrelated bright badge. | `.site-sign-in` styled as subtle neutral surface (`var(--surface-2)` with `1px solid var(--border)`), preserving primacy for `.btn-primary`. | Calm, professional navbar hierarchy with clean spacing. |
| **Hero Introduction** | Generic tag; lacked upfront transparency on account benefits. | Added `.hero-highlight-pill` with *"Tumpuan Platform"* tag and 16 ATS templates + Mochi free tier disclosure. | Immediate trust, clear value proposition without hype. |
| **Career Hub Sample** | Cluttered visual elements. | Clean 3-pillar readiness tracker (Master Profile, Career Documents, Interview Coaching) with Mochi AI banner. | Establishes Kerjayaku as a comprehensive career platform, not just a resume tool. |
| **Pricing Heading** | Duplicate `.section-heading` rendered both statically in HTML and dynamically via JS. | JS heading suppressed on landing page; single semantic heading with concise non-repetitive copy. | Clean document structure; zero visual stutter. |
| **Pricing Cards** | Vertically stacked on mobile, forcing endless scroll. | Interactive mobile swipeable carousel with CSS scroll-snap, peek preview, prev/next buttons, and dot indicators. | Superior mobile thumb UX; compact vertical footprint. |
| **Auth Pages (Login/Register)** | Inconsistent wordmark rendering on dark mode. | Wordmark token unified across Light/Dark modes (dark neutral + red dot in light, off-white + red dot in dark). | Cohesive product identity across public and authentication surfaces. |

---

## 3. Typography & Spacing Discipline

- **Font Family:** Inter Variable and Inter-Latin with system UI fallbacks.
- **Headings:**
  - Hero display: `clamp(32px, 3.8vw, 48px)` with tight letter-spacing (`-0.04em`).
  - Section headings: `clamp(30px, 3.4vw, 44px)` with standard `1.18` line height.
  - Card titles: `16px - 17px` with `600` weight.
- **Body & Captions:**
  - Body text: `14px - 16px` with `1.65 - 1.75` line height.
  - Badges & metadata: `10.5px - 12.5px` with restrained letter spacing.
- **Vertical Rhythm:**
  - Desktop section space: `72px` padding block.
  - Mobile section space: `48px` padding block.
  - Card paddings: `20px - 24px` on desktop, `16px - 20px` on mobile.

---

## 4. Mobile Ergonomics & Touch Geometry

All touch targets strictly meet or exceed WCAG 2.2 AA (minimum 44×44px interactive area):
- Hamburger menu toggle: `44×44px` centered grid target.
- Pricing carousel arrows: `38×38px` button with minimum `44px` touch bounding padding.
- Carousel dots: `10px` height with expanding `22px` width pill for active state.
- Form inputs: `44px - 48px` height with `16px` font size to prevent iOS Safari auto-zoom.
- Safe Area Insets: Tested and compatible with iOS bottom home bar and Android gesture pill (`env(safe-area-inset-bottom)`).
