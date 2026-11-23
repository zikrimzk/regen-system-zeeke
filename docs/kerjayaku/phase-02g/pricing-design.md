# Kerjayaku Phase 02G — Commercial Pricing & Mobile Carousel Architecture

**Phase:** 02G (Premium Commercial Experience & Interactive Landing Page)  
**Date:** November 2026  
**Auditor:** Kerjayaku Systems Engineering & Commerce Architecture  
**Scope:** `landing-pricing.js`, `commerce-ui.js`, `landing.css`, `site.css`, `HitPay` integration

---

## 1. Objective & Structural Overhaul

In previous iterations, the pricing section suffered from two notable deficiencies:
1. **Visual Stutter & Duplicate Headers:** The section heading was defined in `landing.html` and simultaneously rendered dynamically by `landing-pricing.js` line 51, displaying redundant titles on public landing pages.
2. **Mobile Layout Flaws:** On viewports under 850px, pricing cards were rendered in an unwieldy vertical stack, resulting in excessive page length, high bounce rates, and clumsy thumb-scrolling.

Phase 02G solves both root causes:
- **Clean Single Heading:** When rendered on the public landing page (`!standalone`), `landing-pricing.js` suppresses duplicate header output, deferring to the single semantic heading in `landing.html`.
- **Swipeable Mobile Carousel:** Implements `.pricing-carousel-wrapper` featuring native horizontal scroll-snapping, partial peeking of subsequent cards (85% card width), circular Prev/Next buttons, and synchronized dot pagination indicators that morph into an active pill.

---

## 2. Desktop vs. Mobile Layout Specifications

### Desktop (`min-width: 851px`)
- **Container:** `.landing-package-rail` uses CSS Grid:
  ```css
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  align-items: stretch;
  margin-block: 24px;
  ```
- **Controls:** `.pricing-carousel-controls` is set to `display: none;` on desktop.
- **Card Symmetry:** All cards flex to uniform height; CTAs align neatly at the bottom with `margin-top: auto;`.

### Mobile (`max-width: 850px`)
- **Container:** `.pricing-carousel-wrapper` with negative horizontal bleed (`margin: 0 -16px; padding: 8px 16px 16px;`):
  ```css
  display: flex;
  flex-direction: row;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  scrollbar-width: none;
  ```
- **Card Peeking:** Each `.token-package` card is constrained to `flex: 0 0 85%; max-width: 340px; scroll-snap-align: center;`, giving an unmistakable visual peek (~24px) of the adjacent card to prompt swiping.
- **Tactile Controls:**
  - Prev/Next circular arrow buttons (`38×38px`, `border-radius: 50%`, `background: var(--surface-2)`).
  - Dot indicators (`10px` round circles) that expand to a `22px` rounded pill in `var(--primary)` when active (`aria-selected="true"`).

---

## 3. Interaction & State Synchronization

The carousel interaction is orchestrated by reactive event bindings in `public/js/landing-pricing.js`:

```javascript
function setupCarousel() {
  const rail = host.querySelector('.landing-package-rail');
  const prev = host.querySelector('[data-pricing-prev]');
  const next = host.querySelector('[data-pricing-next]');
  const dots = host.querySelectorAll('.pricing-dot');
  if (!rail || !dots.length) return;

  function update() {
    const cards = rail.children;
    if (!cards.length) return;
    const cardWidth = cards[0].offsetWidth + 16;
    const active = Math.min(cards.length - 1, Math.max(0, Math.round(rail.scrollLeft / cardWidth)));
    dots.forEach((dot, idx) => {
      const isCurrent = idx === active;
      dot.classList.toggle('is-active', isCurrent);
      dot.setAttribute('aria-selected', String(isCurrent));
    });
    if (prev) prev.disabled = rail.scrollLeft <= 6;
    if (next) next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 6;
  }

  rail.addEventListener('scroll', () => {
    window.requestAnimationFrame(update);
  }, {passive: true});

  update();
}
```

### Event Handlers
1. **Swipe / Native Touch:** iOS Safari and Android Chrome handle touch gestures natively via `scroll-snap-type: x mandatory`. The passive `scroll` listener throttled with `requestAnimationFrame` continuously syncs active dot and arrow disabled states.
2. **Next Button:** Smoothly scrolls forward one card via `cards[currentIndex + 1].scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'})`.
3. **Previous Button:** Smoothly scrolls backward one card via `cards[currentIndex - 1].scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'})`.
4. **Dot Taps:** Tapping any dot smoothly centers the corresponding package card directly.

---

## 4. Commercial Transparency & Payment Architecture

- **Currency & Gateway:** All prices are displayed in Malaysian Ringgit (`RM`), processed securely through HitPay.
- **Payment Methods:** Malaysian FPX online banking (Maybank, CIMB, Public Bank, etc.), DuitNow QR, credit/debit cards, and GrabPay.
- **No Recurring Traps:** Explicitly labeled as *"Pakej sekali bayar"* / *"One-time package"*. No hidden auto-renewals or unexpected subscriptions.
- **Token Model:** Free tier includes full ATS resume authoring and template selection. Optional paid packages grant permanent tokens for advanced AI drafting, cover letter exports, and premium unlocks. Tokens never expire.
