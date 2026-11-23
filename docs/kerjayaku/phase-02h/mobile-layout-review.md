# Kerjayaku Phase 02H — Mobile Layout & Touch Ergonomics Review
**Document ID:** `docs/kerjayaku/phase-02h/mobile-layout-review.md`  
**Product:** Kerjayaku.  
**Phase:** 02H (Mochi's Animated Career Journey)  
**Status:** Completed & Verified  

---

## 1. Mobile-First Architecture & Viewport Targets

In accordance with ReGen/Kerjayaku engineering guidelines, Phase 02H treats mobile devices not as shrunk desktop viewports, but as primary touch surfaces. All layouts and animations are tested and verified across four Malaysian mobile device tiers:

| Viewport Width | Typical Malaysian Hardware Profile | Tested Status | Overflow Invariant |
| :--- | :--- | :--- | :--- |
| **320px** | Ultra-compact budget smartphones (legacy Android) | **PASSED** | 0px overflow ($W \le 320\text{px}$) |
| **360px** | High-volume market share (Samsung Galaxy A-series, Xiaomi Redmi) | **PASSED** | 0px overflow ($W \le 360\text{px}$) |
| **390px** | Standard flagship tier (iPhone 12 / 13 / 14 / 15 / 16) | **PASSED** | 0px overflow ($W \le 390\text{px}$) |
| **430px** | Plus / Max flagships (iPhone Pro Max, Samsung Galaxy S24 Ultra) | **PASSED** | 0px overflow ($W \le 430\text{px}$) |

Automated regression script `node scripts/check-mobile-viewport.mjs` executed with 13/13 passing assertions, confirming that zero horizontal scrolling exists on any public screen.

---

## 2. Serpentine Path Adaptation for Small Screens

### 2.1 Center-Spine Serpentine Curve
On wide desktop viewports ($> 1024\text{px}$), the career path swings broadly across an 800px corridor between alternating left and right waypoint cards. On mobile viewports ($< 768\text{px}$), this geometry adapts dynamically in `public/js/mochi-road.js`:
- Path amplitude is constrained to $60\text{px}$ either side of the vertical center axis ($x \in [100\text{px}, 220\text{px}]$ in a $320\text{px}$ SVG viewBox).
- Waypoint milestone cards are stacked in a single vertical column directly over the center corridor.
- Card backgrounds use semi-opaque backdrop blur surfaces (`background: rgba(var(--color-surface-rgb), 0.88); backdrop-filter: blur(12px);`), allowing the glowing emerald road to shine softly through without reducing text contrast or legibility.

### 2.2 Touch-Scroll Scrub Performance
Touch dragging on capacitive screens generates rapid `touchmove` events. To prevent frame dropping and battery drain:
- GSAP's `ScrollTrigger` is configured with `scrub: 0.8` (soft interpolation smoothing), decoupling the 60fps render loop from instantaneous micro-jitters in touch sensors.
- Mochi's traveler mount uses `transform: translate3d(...)` so repositioning occurs purely on the GPU compositor thread without triggering browser reflows.

---

## 3. Touch Target Ergonomics & Control Placement

All interactive elements across mobile views meet or exceed the WCAG 2.2 AA $44 \times 44\text{px}$ minimum clickable boundary:

```
[ Mobile Chapter Tracker: Fixed Top Safe Area ]
  ┌────────────────────────────────────────────────────────┐
  │ [1] Asas  ──  [2] Resume  ──  [3] Kerjaya  ──  [4] Maju  │
  └────────────────────────────────────────────────────────┘
                           │
                           ▼
[ Dynamic Waypoint Card: Centered Column (Margin: 1rem) ]
  ┌────────────────────────────────────────────────────────┐
  │  Scene 04: Resume Studio                               │
  │  • ATS-friendly layout presets                         │
  │  ┌──────────────────────────────────────────────────┐  │
  │  │ [ Classic Asas ]  [ Moden ]  [ Eksekutif ]       │  │ (Touch pills: 48px height)
  │  └──────────────────────────────────────────────────┘  │
  │  [ Cuba Studio Sekarang  → ]                          │  │ (Primary CTA: 52px height)
  └────────────────────────────────────────────────────────┘
```

1. **Floating Chapter Bar:** Pinned to top with `env(safe-area-inset-top)` support. Chapter indicators are tappable pills allowing users to jump directly to any milestone.
2. **Template Pills in Scene 04:** Generously spaced horizontal pill buttons ($48\text{px}$ target height) allow quick cycling between resume designs with one-thumb reach.
3. **Pricing Drawer on Mobile:** The pricing checkpoint opens a dedicated bottom-sheet modal with a swipeable card carousel, native touch momentum scrolling, and an explicit full-width close button.

---

## 4. Virtual Keyboard Safety (Auth Pages)

A common flaw in mobile authentication design is input occlusion caused by the soft software keyboard (iOS QuickType / Android Gboard). In `login.html` and `register.html`:
- The container uses dynamic viewport units (`min-height: 100dvh;`) to accommodate browser chrome and virtual keyboard adjustments without visual jumping.
- Mochi's auth companion is enclosed in an adaptive flex wrapper (`.auth-mochi-mount`). On screens where keyboard activation reduces visible height below $500\text{px}$, Mochi gracefully scales down from $120\text{px}$ to $72\text{px}$ while speech bubble typography adjusts to a compact $12\text{px}$ pill, ensuring form fields, labels, and the submit button remain fully visible without requiring manual user panning.

---

## 5. Visual Evidence References

- **Mobile Hero Waypoint (Scene 00, 390px):** [landing-mobile-s0-hero.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/landing-mobile-s0-hero.png)
- **Mobile First Resume Celebration (Scene 05, 390px):** [landing-mobile-s5-celebration.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/landing-mobile-s5-celebration.png)
- **Mobile Pricing Drawer Bottom-Sheet (390px):** [pricing-drawer-open-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/pricing-drawer-open-mobile.png)
- **Mobile Login Screen with Interactive Companion (390px):** [login-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-mobile.png)
- **Mobile Sign Up Screen with Compact Header (390px):** [register-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/register-mobile.png)
