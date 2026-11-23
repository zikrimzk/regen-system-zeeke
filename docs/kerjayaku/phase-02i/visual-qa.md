# Phase 02I visual QA

## Browser evidence

Generated with installed Chrome through the DevTools Protocol, a disposable PHP and MySQL fixture, synthetic accounts and a localhost-only SMTP sink. `php scripts/check-phase02i-http.php` requires local testing MySQL. `REGEN_PHASE_02I_EVIDENCE` can point to a separate screenshot folder. The browser run blocks HTTPS and external WebSocket requests.

| Surface | Desktop | Mobile |
| --- | --- | --- |
| Landing | [Light](verification/hero/light-desktop.png) · [Dark](verification/hero/dark-desktop.png) | [Light](verification/hero/light-mobile.png) · [Dark](verification/hero/dark-mobile.png) · [Reduced motion in Bahasa Melayu](verification/hero/reduced-motion-mobile-ms.png) |
| Templates checkpoint | [Desktop](verification/checkpoints/04-desktop.png) | [Mobile](verification/checkpoints/04-mobile.png) |
| Draft milestone | [Desktop](verification/checkpoints/05-desktop.png) | [Mobile](verification/checkpoints/05-mobile.png) |
| Toll gateway | [Desktop](verification/checkpoints/06-desktop.png) | [Mobile](verification/checkpoints/06-mobile.png) |
| Mochi’s day one | [Desktop](verification/checkpoints/11-desktop.png) | [Mobile](verification/checkpoints/11-mobile.png) |
| Packages | [Desktop](verification/packages/light-desktop.png) | [Mobile](verification/packages/light-mobile.png) · [Second package](verification/packages/mobile-second-package.png) |
| Public templates | [Desktop](verification/templates/light-desktop.png) | [Mobile](verification/templates/light-mobile.png) |
| Sign in | [Desktop](verification/login/light-desktop.png) | [Mobile](verification/login/light-mobile.png) · [Rejected credentials](verification/login/mobile-error.png) |
| Sign up | [Desktop](verification/register/light-desktop.png) | [Mobile](verification/register/light-mobile.png) · [Pending verification](verification/register/mobile-verification-pending.png) |

The [checkpoint directory](verification/checkpoints/) holds all twelve desktop stages. The [machine-readable trace](verification/browser-results.json) pairs the twelve forward positions with the twelve reverse positions and records progress, coordinates and mood. Identical positions on both passes are verified by the browser script. The trace also records the reduced-motion, rotation, carousel, authentication and PWA checks.

## Test scope and release checks

- Chrome checked the landing, packages, gallery, login and registration at 320, 360, 390, 430, 768, 1024 and 1440 px in English and Bahasa Melayu, in both themes. A landscape reflow was checked separately. The isolated signup reached the existing pending verification page through the test mail sink. No external email was sent.
- The complete browser run checks 141 viewport combinations and 17 interactions. The verification trace lists each check and any uncaught exception. Static suites passed 64 public-asset, 31 shared-page, 13 viewport and 43 service-worker assertions.
- The local browser reported no installability errors and verified that consent caches the actual story version and SVG. Existing worker tests covered privacy, fallback, scope and cache revocation with deterministic fixtures. The isolated Phase 01 and Store HTTP suites checked ownership, guarded documents, prices and credit settlement.
- Release ZIP inspection verified all 13 cache-versioned `href` references point to the original artwork fragment and the artwork is present. The public stylesheet is about 52 KB before transport compression.
- Landing observations use fixed 390 and 1440 px views, one local run per language and width, with HTTP caching and service-worker responses bypassed. The trace contains the measured LCP and CLS for each navigation. The checks do not measure INP.
- Remaining release checks include the native Android and iOS keyboard and address-bar behavior, screen-reader reading order, a real installed PWA launch and upgrade on both platforms, and field performance. Local lab measurements are in the trace and do not establish field LCP, INP or CLS. This report records implementation verification with design review pending.
