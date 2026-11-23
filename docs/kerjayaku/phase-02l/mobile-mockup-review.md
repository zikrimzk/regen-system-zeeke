# Mobile mockup and product capture review

The original screenshots come from Chromium against the disposable fixture, with sample account Amina Rahman, a synthetic resume and a fictional cover letter for Syarikat Contoh. The source capture recorded for Phase 02K is dated 16 November 2026. The asset manifest remains in `PublicProduct::MEDIA`.

| Capture | Source route | Source viewport and export | Theme and locale |
|---|---|---|---|
| Workspace | `/dashboard` | 1200 × 760 viewport, 1100 × 620 intentional crop | Light, English and Bahasa Melayu |
| Resume desktop | `/builder` with the sample resume | 1200 × 780 | Light, English and Bahasa Melayu |
| Resume mobile | Same builder with a true mobile viewport | 390 × 752 | Light, English and Bahasa Melayu |
| Cover letter desktop | `/cover-letters` with the sample letter | 1200 × 780 | Light, English and Bahasa Melayu |
| Cover letter mobile | Same letter in the mobile viewport | 390 × 752 source with 390 × 620 export | Light, English and Bahasa Melayu |

Product captures sit in consistent generic device bezels. Their content stays in the captured theme to preserve the source screenshot. The surrounding preview surface follows the visitor's appearance. The Studio frame preserves the underlying aspect ratio. At 390 CSS px the inside Resume Studio display grew from 214px to 318px. An ordinary link opens each full-resolution image for closer inspection.

[Before at 390 px](screenshots/before-studio-mobile-dark.png) · [Resume at 390 px](screenshots/studio-actual-mobile.png) · [Cover Letter at 390 px](screenshots/letters-actual-mobile.png). [Source manifest](../phase-02k/product-screenshot-manifest.md).
