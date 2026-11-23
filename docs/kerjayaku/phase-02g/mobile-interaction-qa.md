# Kerjayaku Phase 02G — Mobile Interaction & Cross-Device QA

**Phase:** 02G (Premium Commercial Experience & Interactive Landing Page)  
**Date:** November 2026  
**Auditor:** Quality Assurance & Cross-Browser Verification Team  
**Scope:** Responsive viewports, Touch scrolling, PWA caching, Accessibility

---

## 1. Viewport Matrix & Test Execution

Testing was conducted across standard responsive breakpoints simulating common Malaysian device viewports:

| Device Profile | Width × Height | DPR | Tested Surface | Result | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Small Phone (Android Entry)** | 360 × 740 px | 2.0 | Landing, Login, Register | PASS | No horizontal overflow; carousel peeking at ~18px; touch targets compliant. |
| **Standard Phone (iPhone 13/14/15)** | 390 × 844 px | 3.0 | Landing, Login, Register | PASS | Optimal card width (85%); carousel dots & arrows perfectly balanced. |
| **Large Phone (iPhone Pro Max / Galaxy Ultra)** | 430 × 932 px | 3.0 | Landing, Login, Register | PASS | Cards display cleanly without awkward whitespace; hero highlights legible. |
| **Tablet Portrait (iPad Mini / Air)** | 768 × 1024 px | 2.0 | Full Landing Experience | PASS | 2-column modules; responsive gallery scrolls smoothly. |
| **Desktop / Laptop** | 1024 × 768 px | 1.0 | Full Platform Showcase | PASS | Grid switches to 3 columns; carousel controls seamlessly hidden. |
| **Large Desktop / Ultrawide** | 1440 × 900 px | 1.0 | Full Landing Experience | PASS | Max-width container (`1180px`) keeps layout crisp and readable. |

---

## 2. Interaction & Keyboard Accessibility Checklist

- [x] **No Horizontal Body Overflow:** `overflow-x: clip` applied to page body and main container prevents horizontal page wobble during touch swipes.
- [x] **Touch Target Sizing:** All buttons and interactive controls maintain minimum `44×44px` bounding targets.
- [x] **Focus-Visible Rings:** All focusable elements (links, buttons, inputs, summaries) render high-contrast 3px focus rings (`--color-focus: #b42332` in Light, `#f5c860` in Dark) with `3px` offset.
- [x] **Carousel Keyboard Navigation:** The carousel container has `tabindex="0"` and `role="region"`. Left/Right arrow keys scroll the rail naturally. Each dot is a focusable button with `role="tab"` and updated `aria-selected` attribute.
- [x] **Mobile Keyboard Reliability:** Input forms on `/login` and `/register` use appropriate `inputmode` and `autocomplete` attributes. Virtual keyboard appearances do not obscure active input fields or cause viewport jitter.
- [x] **Reduced Motion Support:** Users with `prefers-reduced-motion: reduce` experience instant transitions with zero extraneous animations.

---

## 3. Automated Validation Suite Results

All platform test suites executed cleanly:

```bash
$ php scripts/check.php
PHP syntax, action autoloading and page assets passed (159 PHP files).

$ php scripts/check-site.php
Public asset, label, image and preview checks passed (68 assertions; no network requests).
Complete preview collection: 314890 bytes at 320 px, 886516 bytes at 640 px, 2415932 bytes at 1280 px.

$ node scripts/check-pwa.mjs
PWA cache privacy, offline responses and manifest checks passed (43 assertions; no network requests).

$ node scripts/check-mobile-viewport.mjs
Mobile viewport, panning, focus scrolling, dialogs and pinch-zoom checks passed (13 assertions; synthetic events).

$ php scripts/build-site-css.php
Public stylesheet: 64303 bytes, one blocking request. (Strictly < 65,000 bytes budget).
```

---

## 4. Screenshot Evidence Log

Fresh screenshots captured via Chrome DevTools Protocol in `docs/kerjayaku/phase-02g/screenshots/`:

1. `landing-desktop-light.png`: Desktop hero with refined navbar, subtle Sign-In, and platform highlight pill.
2. `landing-desktop-dark.png`: Dark mode visual contrast and brand wordmark check.
3. `landing-desktop-full.png`: Complete top-to-bottom landing page composition.
4. `pricing-desktop.png`: Balanced 3-column pricing grid with single semantic heading.
5. `mochi-flagship-desktop.png`: Flagship Mochi AI interactive greeting and den.
6. `assist-refine-desktop.png`: Assist Me workflow and Refine Me before/after comparison.
7. `templates-gallery-desktop.png`: 16 ATS templates gallery with filter tabs.
8. `landing-mobile-light.png`: Mobile hero, highlight pill, and career hub sample.
9. `landing-mobile-dark.png`: Mobile dark mode rendering.
10. `pricing-carousel-slide1-mobile.png`: Mobile pricing Slide 1 active, peeking Slide 2, prev disabled.
11. `pricing-carousel-slide2-mobile.png`: Mobile pricing Slide 2 active after tapping Next button.
12. `pricing-carousel-slide3-mobile.png`: Mobile pricing Slide 3 active after tapping dot 3, next disabled.
13. `login-desktop-light.png`: Login desktop surface.
14. `login-desktop-dark.png`: Login dark mode surface.
15. `login-mobile.png`: Mobile login viewport.
16. `register-desktop.png`: Registration desktop surface.
17. `register-mobile.png`: Mobile registration viewport.
