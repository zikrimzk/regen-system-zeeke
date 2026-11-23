# Kerjayaku Phase 02H — Animation Architecture Report
**Document ID:** `docs/kerjayaku/phase-02h/animation-architecture.md`  
**Product:** Kerjayaku.  
**Phase:** 02H (Mochi's Animated Career Journey)  
**Status:** Completed & Verified  

---

## 1. Architectural Overview & Design Philosophy

Phase 02H replaces the static feature grids and isolated demonstration sections of previous phases with a continuous, interactive scrollytelling experience. The core design principle is **deterministic, physics-driven reversibility**: scrolling is the direct motor driving Mochi along an undulating career path through 11 narrative scenes.

```
[ User Scroll Position (Delta Y) ]
               │
               ▼
[ GSAP ScrollTrigger Scrubbing (p ∈ [0.0, 1.0]) ]
               │
       ┌───────┴────────────────────────┬─────────────────────────┐
       ▼                                ▼                         ▼
[ SVG Path Sampling ]         [ WebGL Avatar State ]      [ Narrative Engine ]
 • getPointAtLength(p * L)     • setMood(scene.mood)       • Dialogue Bubble Updates
 • Tangent Angle: atan2(dy,dx) • Procedural Animation      • Waypoint Card Reveals
 • CSS transform3d(x, y, θ)    • Client-side (Zero AI)     • Reversible Confetti
```

### Key Technical Pillars:
1. **Local Self-Hosted Vendor Distribution:** Zero external CDNs. All GSAP modules (`gsap.min.js`, `ScrollTrigger.min.js`, `MotionPathPlugin.min.js`) are served directly from `/public/js/vendor/`.
2. **Deterministic Reversibility:** Every animation is a pure mathematical function of progress parameter $p \in [0, 1]$. Scrolling backward naturally rewinds Mochi, rotates him along the reverse tangent, re-packs celebratory confetti, and restores milestone envelopes.
3. **GPU-Accelerated Compositing:** Mochi's sprite mount, speech bubble, and milestone cards animate strictly through hardware-accelerated CSS properties (`transform: translate3d() rotate()` and `opacity`), maintaining steady 60fps rendering without layout thrashing.
4. **Zero AI Token Cost:** Mochi's real-time avatar reactions, emotional expressions, and procedural ear/eye movements execute entirely in the browser using client-side WebGL and canvas primitives.

---

## 2. Dynamic Serpentine Path Generation (`mochi-road.js`)

The career road is not a static SVG background image; it is dynamically generated and sampled in `public/js/mochi-road.js` to match the exact vertical height and layout geometry of the DOM waypoints.

### 2.1 Coordinate Sampling & Parametric Curve Math
For any given scroll progress $t \in [0, 1]$, the physical position $(x, y)$ and heading angle $\theta$ of Mochi are extracted from the SVG `<path id="mochi-road-path">` via native browser SVG APIs:

$$\text{distance} = t \times \text{totalPathLength}$$
$$P(t) = \text{path}.\text{getPointAtLength}(\text{distance})$$
$$P(t + \Delta t) = \text{path}.\text{getPointAtLength}(\text{distance} + \epsilon)$$
$$\theta = \operatorname{atan2}(P_{y}(t + \Delta t) - P_{y}(t), P_{x}(t + \Delta t) - P_{x}(t)) \times \frac{180}{\pi}$$

To avoid sudden flips when transitioning through vertical inflection points, heading angles are clamped with a soft damping function, ensuring Mochi stays upright and natural while banking smoothly into curves.

### 2.2 Responsive Track Geometry (Desktop vs. Mobile)
- **Desktop Layout:** The curve undulates across an 800px-wide center corridor, swinging alternatingly toward left-aligned and right-aligned waypoint cards with cubic Bézier segments (`C x1 y1, x2 y2, x3 y3`).
- **Mobile Layout (< 768px):** The curve compresses into a narrower 320px–360px serpentine spine. Waypoint cards are stacked cleanly in a centered column while the path snakes subtly behind them, ensuring zero horizontal overflow (`overflow-x: hidden`).

---

## 3. Master Timeline & ScrollTrigger Scrubbing (`mochi-story.js`)

The entire scrollytelling sequence is orchestrated through a single unified GSAP timeline in `public/js/mochi-story.js`.

### 3.1 ScrollTrigger Configuration
```javascript
const storyTimeline = gsap.timeline({
  scrollTrigger: {
    trigger: '#mochi-journey',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8, // 800ms soft inertial smoothing
    onUpdate: (self) => {
      syncMochiToProgress(self.progress);
    }
  }
});
```

### 3.2 Waypoint Mapping & Progress Intervals
The 11 scenes are mapped along normalized progress intervals $p \in [0, 1]$:

| Scene | Progress Range | Target Waypoint | Mochi Expression | Key Visual Event |
| :--- | :--- | :--- | :--- | :--- |
| **00** | $0.00 - 0.05$ | `#scene-0` (Hero Welcome) | `wave` | Mochi greets candidate, road opens downward |
| **01** | $0.06 - 0.14$ | `#scene-1` (Career Entrance) | `curious` | Footsteps appear on path; avatar tilts forward |
| **02** | $0.15 - 0.23$ | `#scene-2` (Master Profile) | `sneak` | Profile checklist unfolds from certificate badge |
| **03** | $0.24 - 0.32$ | `#scene-3` (Career Goals) | `bright` | Compass needle swings toward Malaysian tech hubs |
| **04** | $0.33 - 0.43$ | `#scene-4` (Resume Studio) | `hop` | Template cards fan out; interactive preview enabled |
| **05** | $0.44 - 0.54$ | `#scene-5` (First Resume!) | `dance` | Dual confetti cannons detonate reversibly |
| **06** | $0.55 - 0.64$ | `#scene-6` (Pricing Checkpoint)| `proud` | Glowing milestone arch; drawer CTA unlocks |
| **07** | $0.65 - 0.73$ | `#scene-7` (Cover Letter) | `curious` | Envelope seals and stamps automatically |
| **08** | $0.74 - 0.82$ | `#scene-8` (Job Matching) | `bright` | Radar sweeps across verified Malaysian employers |
| **09** | $0.83 - 0.91$ | `#scene-9` (Application Tracker)| `hop` | Kanban column items glide smoothly into place |
| **10** | $0.92 - 1.00$ | `#scene-10` (Interview Success) | `dance` | Offer letter unrolls; graduation mortarboard toss |

---

## 4. Reversibility Mechanics & Confetti Physics

### 4.1 Deterministic Rewind
Unlike trigger-and-forget scroll animations that fire once on enter, every scene state in Phase 02H is bound bidirectionally:
- **Scrolling Down (Forward):** Mochi bounds forward, cards fade in with `translate3d(0, 0, 0)`, speech bubble dialogue transitions to next quote, and milestones illuminate.
- **Scrolling Up (Backward):** Mochi reverses orientation smoothly, cards return to `opacity: 0.4` or `translate3d(0, 24px, 0)`, speech bubbles restore previous dialogue, and milestone arches dim.

### 4.2 Reversible Confetti Cannon (Scene 05)
In Scene 05 (First Resume Celebration), confetti particles are not spawned into an unmanaged random array. Instead, 32 distinct particle trajectories are mapped parametrically:

$$r_i(t) = v_{0, i} \cdot \Delta t - \frac{1}{2} g \cdot (\Delta t)^2$$
$$\theta_i(t) = \theta_{0, i} + \omega_i \cdot \Delta t$$

Where $\Delta t = \frac{p - 0.44}{0.10}$. As the visitor scrolls backward past $p = 0.44$, $\Delta t \to 0$, causing all 32 particles to converge back into the party popper cylinder seamlessly.

---

## 5. Performance Budgeting & Hardware Acceleration

### 5.1 Compositor-Only Animation Loop
All scrollytelling translations bypass the CPU layout and paint engines:
- Position updates apply via `transform: translate3d(x px, y px, 0)`.
- Directional banking applies via `rotate(θ deg)`.
- Waypoint elevation applies via `opacity` and `transform`.
- `will-change: transform` is applied selectively only to active elements to prevent excessive VRAM allocation.

### 5.2 Reduced Motion Fallback (`prefers-reduced-motion: reduce`)
When the user's operating system requests reduced motion:
1. GSAP ScrollTrigger scrub timeline is cleanly disabled.
2. The winding road SVG converts to a straight, accessible vertical milestone spine.
3. Mochi remains anchored gracefully at the top of each chapter rather than dynamically traveling along the screen.
4. All waypoint cards display fully opaque with zero motion delays, ensuring 100% content availability for accessibility compliance.

---

## 6. Visual Evidence References

- **Desktop Winding Hero (Scene 00):** [journey-s0-hero-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s0-hero-desktop.png)
- **Resume Studio Waypoint (Scene 04):** [journey-s4-templates-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s4-templates-desktop.png)
- **Reversible Confetti Celebration (Scene 05):** [journey-s5-celebration-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s5-celebration-desktop.png)
- **Smooth Reverse Scroll Validation (Scene 04):** [journey-reverse-scroll-s4.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-reverse-scroll-s4.png)
- **Reduced Motion Accessible Fallback:** [landing-reduced-motion-fallback.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/landing-reduced-motion-fallback.png)
