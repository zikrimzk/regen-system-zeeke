# Phase 02L implementation report

Phase 02L refines the product-led public experience on the existing Phase 02K foundation. The result is ready for visual review after local verification. Visual approval belongs to the user.

| Function | Visitor outcome | Existing administration and backend |
|---|---|---|
| Hero and spacing | Read product-first copy, view the real screens and follow contextual links to the Studios or Mochi. Section anchors use the header offset once. | Published timed promotion data still comes from the existing catalogue. |
| Writing demos and career discovery | Explore a Mochi tip, watch the draft sequence, compare refined wording and browse the career rail. | The public demo is local. Account entitlements, pricing and live feature permissions stay authoritative. |
| Studio frames | Switch between authentic device captures, then open a full-resolution screenshot or go to an existing product route. | Document routes still check ownership, authentication and entitlements. Captures use a disposable account. |
| Public Packages | Compare published prices and allowances, swipe, check expiry and follow the Store entry. Retry when the catalogue cannot refresh. | TokenStore controls publishing, prices, promotions, expiry, entitlements and claim capacity. The protected Store owns payments and claims. |
| FAQ and authentication | Open relevant answers, reach support and sign in or register through the existing forms. | Existing guards, verification and rate limits remain in effect. |

## Files and routes

- `php/views/landing.html` and `pricing.html` contain the updated sections and commercial header.
- `php/src/PublicProductCopy.php` and `PageRenderer.php` supply scoped English and Malay text.
- `public/css/commercial.css`, `commercial-pricing.css`, `auth-journey.css` and generated `site.css` define the visual refinement.
- `public/js/public-product.js`, `landing-pricing.js` and `theme.js` handle motion, package presentation and appearance.
- `scripts/check-phase02l-http.php` and `capture-phase02l.mjs` exercise the public and authentication flows against disposable local records.
- `/`, `/pricing`, the `/packages` alias, `/login` and `/register` use the same routes. There are zero schema migrations or new runtime dependencies.

## Verified results

- `composer check`, the 84 public site assertions, the 46 PWA checks and the 13 mobile viewport checks passed.
- Chrome passed 83 named interaction and state checks and recorded 73 viewport verifications with zero uncaught JavaScript exceptions. It verified the three visible price points and claim state from isolated MySQL, native swipe, keyboard navigation, fetching failure and retry, and returning to the Store after sign-in.
- `check-phase01-http.php`, `check-store-http.php`, `check-package-claims.php` and mocked `check-hitpay.php` passed. Checkout and ledger duplicate protection were verified through the existing synthetic regressions.
- The release build and template/PDF export verification passed. The release contains the revised presentation assets and excludes browser evidence. No new migrations or runtime dependencies were introduced.

## Layout, motion and performance

At 1440 CSS px the landing measured 4,874px high in the final light capture, down from 5,140px. The dark full-page capture measured 4,859px. At 390 CSS px the resume phone's inside display widened from 214px to 318px. The page became taller on that viewport because the images are larger and more readable; the forced stage heights were removed. The selected device establishes the stage size.

The writing trace recorded 91 consecutive frames with a 17ms median and 17ms 95th percentile during one synthetic Assist Me replay. The cue became visible near 0.59s and the draft reached 90% opacity at 1.33s. These values describe one recorded workstation sequence.

| Loopback sample | Desktop 1440px | Mobile 390px |
|---|---:|---:|
| Full suite LCP | 2.76 s | 1.74 s |
| Median of three cold-cache repeats | 1.95 s | 1.72 s |
| Repeat LCP range | 1.29–6.42 s | 0.91–1.84 s |
| Largest observed CLS across both test sets | 0.0033 | 0.0017 |

The desktop target of 2.5s LCP was missed in the full pass and in one repeat. The slow repeat spent 3.83s waiting for the first loopback response byte. The desktop hero used 42,614 image bytes and the mobile hero used about 15–17 KB by locale. No production latency or field INP measurement was available. Deployment profiling should use the intended host and representative mobile hardware.

[Interaction and motion JSON](screenshots/browser-final.json) · [Repeated lab samples](screenshots/performance-repeat.json) · [Full light landing](screenshots/landing-full-light.jpg) · [Full dark landing](screenshots/landing-full-dark.jpg).

## Remaining review

Review the new hero and mobile Studio scale, then swipe all three package QA slides and inspect their actual offer conditions. Recheck the keyboard, password managers, and installed PWA on physical iOS and Android. Supply the official Privacy Policy URL when verified. Field vitals and the production payment and identity-provider paths require deployment-specific verification. No production orders were submitted.

[Visual audit](visual-audit.md) · [Screenshots and viewport checks](mobile-qa.md) · [Package verification](packages-comparison.md) · [Motion evidence](hero-and-motion.md).
