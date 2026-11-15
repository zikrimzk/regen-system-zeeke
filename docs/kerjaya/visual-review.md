# Kerjaya. · Phase 02B visual review

**Status** · Phase 02B comparison. See the [approved design handoff](approved-design-handoff.md) for the recorded selection.

Use the [City to Career review board](../../prototypes/kerjaya/screenshots/city-review.png) and [Career Workspace review board](../../prototypes/kerjaya/screenshots/workspace-review.png) for a side-by-side comparison of each concept's surfaces. The individual Chrome screenshots below retain their original resolution. Desktop captures are 1440 × 1000 px and mobile captures are 390 × 844 px.

| Concept and screen | Runnable page | Desktop screenshot | Mobile screenshot |
| --- | --- | --- | --- |
| A · Landing | [city/index.html](../../prototypes/kerjaya/city/index.html) | [city-landing-desktop.png](../../prototypes/kerjaya/screenshots/city-landing-desktop.png) | [city-landing-mobile.png](../../prototypes/kerjaya/screenshots/city-landing-mobile.png) |
| A · Candidate dashboard | [city/dashboard.html](../../prototypes/kerjaya/city/dashboard.html) | [city-dashboard-desktop.png](../../prototypes/kerjaya/screenshots/city-dashboard-desktop.png) | [city-dashboard-mobile.png](../../prototypes/kerjaya/screenshots/city-dashboard-mobile.png) |
| A · Resume Studio | [city/studio.html](../../prototypes/kerjaya/city/studio.html) | [city-studio-desktop.png](../../prototypes/kerjaya/screenshots/city-studio-desktop.png) | [city-studio-mobile.png](../../prototypes/kerjaya/screenshots/city-studio-mobile.png) |
| B · Landing | [workspace/index.html](../../prototypes/kerjaya/workspace/index.html) | [workspace-landing-desktop.png](../../prototypes/kerjaya/screenshots/workspace-landing-desktop.png) | [workspace-landing-mobile.png](../../prototypes/kerjaya/screenshots/workspace-landing-mobile.png) |
| B · Candidate dashboard | [workspace/dashboard.html](../../prototypes/kerjaya/workspace/dashboard.html) | [workspace-dashboard-desktop.png](../../prototypes/kerjaya/screenshots/workspace-dashboard-desktop.png) | [workspace-dashboard-mobile.png](../../prototypes/kerjaya/screenshots/workspace-dashboard-mobile.png) |
| B · Resume Studio | [workspace/studio.html](../../prototypes/kerjaya/workspace/studio.html) | [workspace-studio-desktop.png](../../prototypes/kerjaya/screenshots/workspace-studio-desktop.png) | [workspace-studio-mobile.png](../../prototypes/kerjaya/screenshots/workspace-studio-mobile.png) |

The additional Studio captures show the same edited fixture in [A’s mobile preview dialog](../../prototypes/kerjaya/screenshots/city-studio-preview-mobile.png) and [B’s mobile Preview mode](../../prototypes/kerjaya/screenshots/workspace-studio-preview-mobile.png).

## Run the prototypes

From the repository root, run `node prototypes/kerjaya/capture.mjs --serve`. Open either loopback URL printed by the command. Press Ctrl+C when finished. Use `node prototypes/kerjaya/capture.mjs` to reproduce the individual screenshots and [browser-results.json](../../prototypes/kerjaya/screenshots/browser-results.json). The tested runtime was Node 24.14.1 and Google Chrome 157.0.8103.51, controlled through the Chrome DevTools Protocol. Set `KERJAYA_CHROME` to the Chrome executable path if it differs from the script's default. The two review boards are assembled from the individual captures.

[prototype.css](../../prototypes/kerjaya/prototype.css) and [prototype.js](../../prototypes/kerjaya/prototype.js) are shared by both concepts. The static host exposes only the prototype pages, these sources and the public artwork, fonts and sample PDFs listed in [brand foundation](brand-foundation.md). The application's [release script](../../scripts/build-release.php) packages `public`, `php`, `vendor` and `database`, so these prototype files fall outside that release map.

## What to try

- **Landing** · Open the sample candidate workspace, use the mobile navigation, switch Modern and Classic in the sample gallery, and open the associated fictional PDF.
- **Candidate dashboard** · Continue into the Experience section, open the resume preview, navigate to Documents, and read the fictional cover letter. The suggested next task and saved dates describe the sample account.
- **Resume Studio** · Switch between the five resume sections, update a field, switch the template and check that the written content survives. Save the draft and reload in the same tab. On mobile, A opens a modal and B switches between Write and Preview. Desktop has a simultaneous editing and preview surface.

## Browser and visual QA

- Chrome rendered all six pages at 360, 390, 430, 768, 1024 and 1440 px. All 36 viewport checks and 36 desktop/mobile interaction checks passed. The capture run recorded zero uncaught exceptions, console errors or HTTP error responses.
- The 768 px Career Workspace dashboard initially overflowed its viewport. Compact tablet navigation preserves the labels and active state within the viewport. The final sweep retested the edited layout.
- Visual inspection covered both review boards, the enlarged Career Workspace landing and both full-size mobile preview states. The editorial lead and Kuala Lumpur artwork distinguish A at both widths. B puts the candidate task and document beside each other on desktop. Its mobile editor and preview have separate surfaces and keep the save action in reach.
- Chrome used light mode and reduced-motion emulation. The desktop interaction tests include typing into Experience and observing the inline preview. Mobile viewport tests cover focus, dialogs and session-scoped draft behavior. See the [mobile/PWA baseline](mobile-pwa-baseline.md) for installed-app, dark-mode and physical-keyboard checks still required in the selected implementation.
- Single-run landing measurements are in the browser results. Local LCP ranged from 56 to 200 ms and observed CLS from 0 to 0.040 on the loopback server. Compare the selected implementation against the real app under matched conditions before drawing performance conclusions.

These prototypes are an interaction and layout comparison. They use one populated fictional account. The Studio preview is HTML, while the gallery PDFs are existing static samples. Real authentication, empty/error/session-expired application states, live saves, PDF generation, billing, entitlements and administrator actions remain implementation checks. Production pages, API contracts and data were left untouched.

