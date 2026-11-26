# Kerjaya. · Phase 02B visual review

**Status** · Phase 02B comparison. See the [approved design handoff](approved-design-handoff.md) for the recorded selection.

Git revision `40ed277` preserves both concepts under `prototypes/kerjaya`, including the six HTML pages, review boards, source assets, and browser results. Desktop captures are 1440 × 1000 px and mobile captures are 390 × 844 px. The current implementation is linked from the [approved design handoff](approved-design-handoff.md).

The standalone prototype server and captures were retired from the active tree. The [release script](../../scripts/build-release.php) packages the application's views and assets.

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

