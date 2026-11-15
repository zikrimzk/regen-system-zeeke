# Resume engine and collection update

30 October 2026. This update concentrates on the exported resume, its matching letter and the template selector. No database migration is required for this update. Existing installations still need any earlier migrations they have not applied, including 010_session_history.sql.

## Output changes

Every design now uses a single reading column. Removed the reserved date columns and side heading gutters that narrowed the useful text area. Role titles, organisations and dates follow a consistent vertical sequence, with organisation and date metadata on the same wrapping line. Sections and entries use small, explicit spacing rather than large fixed-height regions.

The engine uses A4 with 16 mm margins, an 11 pt default body, 10 pt contact/date metadata and two bundled font families: Inter and DejaVu Serif. Both regular and bold faces are embedded in the PDF. Browser samples use compressed versions of the same faces. Hosting no longer depends on fonts installed on the development computer. Black text is the default; the optional accent affects rules rather than the body copy.

Headings stay with following content. Long entries and bullets can flow across pages instead of moving an entire job or section and leaving a large hole. The engine keeps the text at the selected size; it does not silently shrink a long resume to one page. Empty sections disappear, and sparse content is not padded to fill the sheet. Contact information remains in the document body and occurs before the sections in extracted PDF text. Invisible word-break characters and layout tables are absent.

Saved section orders and supported text-size choices are retained. Legacy Arial/Calibri selections resolve to the bundled sans family; Times/Georgia selections resolve to the bundled serif family. New documents receive a suitable starting section order for their template, including education and projects first for Graduate. Changing an existing resume's template preserves its chosen section order. Photos remain optional and off by default.

## Basic and Premium

The catalogue now contains 16 designs. Basic/Premium labels, filters and selection are available in the landing gallery and the app's template picker. All designs remain available; these labels do not introduce charging or access restrictions.

| Collection | Designs |
| --- | --- |
| Basic (6) | Classic, Modern, Minimal, Heritage, Essential, Graduate |
| Premium (10) | Executive, Editorial, Precision, Horizon, Signature, Atlas, Meridian, Keystone, Counsel, Impact |

Graduate, Atlas, Meridian, Keystone, Counsel and Impact are new. The ten existing IDs remain valid. Each design has its own masthead and heading treatment, while sharing the same readable document structure. Matching cover letters inherit the selected template and typography.

Gallery thumbnails are rendered from actual exported PDFs and served as responsive WebP images. The picker loads PDF.js only when a sample preview is opened, instead of running 16 live preview frames. Each preview links to the actual A4 sample. On phones the selection action now sits above the bottom navigation. Private resumes and API downloads remain outside the public service-worker cache; only the allowlisted fictional sample PDFs can be cached after optional storage consent.

## Validation completed

- 80 resume exports: 16 templates with professional, graduate, senior, sparse and long-content fixtures. 42,224 checks passed for retained text, reading order, section order, A4 bounds, page counts, blank pages, orphan section headings and excess unused space on intermediate pages.
- Every professional, graduate and sparse fixture fits one page; each senior fixture uses two. Deliberately oversized fixtures flow over five or six pages without clipping or blank pages.
- 16 matching standard cover letters fit one page with closing text present.
- Six additional export cases passed: accented names/location in both families, legacy Arial preference, an optional photo and all optional sections in both families. The latter cover activities, references, custom skill labels, project descriptions and grade-based academic results. Actual output was rendered and checked visually.
- All pages in the 20-page review collection were rendered with Poppler and visually reviewed, alongside contact sheets of the fixture matrix.
- Browser checks used the actual component and fictional public catalogue at 320, 390, 768 and 1440 px viewport widths. Checked light/dark appearance, Basic/Premium counts, preserved selection, PDF preview rendering, focus return, 44 px preview/filter targets and no horizontal page overflow. The local component fixture uses a harmless selection callback; it does not create a real account or saved resume.
- The public mobile menu was also checked in both appearances and now separates its background clearly from the page.
- The packaged release was extracted locally and generated sans and serif resumes using an empty font cache. Both retained their content, reading order, margins and intended embedded font families.

These are document structure and rendering checks, not a certification by an ATS vendor. The in-app readiness score is guidance about content, not an external parser result. Employer instructions and actual application previews still take precedence. The collection has not been submitted to a third-party ATS. No award or “PakarResume” certification is claimed.

## Design basis

[Greenhouse's parser guidance](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) identifies columns, tables, text boxes, headers/footers and image-based resumes as potential parsing problems. [Harvard's resume guidance](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/) stresses readable, consistent formatting, effective use of space and checking the PDF conversion. [Princeton's resume principles](https://careerdevelopment.princeton.edu/resume-guide/basic-principles-resume-writing) recommend simple formatting and readable type. The engine applies these conservative principles while retaining distinct design treatments.

## Reproduce and update

Local tools only; the server does not need Node, Python or Poppler. Use the installed PHP/Composer, Python with pypdf/pdfplumber/Pillow, Poppler on PATH, and Node with Sharp. `REGEN_NODE_MODULES` may point to a bundled node_modules directory.

```text
php scripts/render-resume-fixtures.php
python scripts/check-resume-pdfs.py --render
php scripts/render-export-options.php
php scripts/generate-template-previews.php
python scripts/render-template-previews.py
node scripts/optimize-site-images.mjs
python scripts/build-template-lookbook.py
python scripts/check-export-options.py
node scripts/check-pwa.mjs
composer release
php scripts/check-release-templates.php
```

Regenerate sample PDFs and gallery images whenever document styles or sample data change. `check-templates.php` rejects a stale sample-catalogue fingerprint. The release excludes QA fixtures, temporary renders, the review collection and local configuration. It includes the 16 fictional public sample PDFs and this document. Upload the rebuilt release using the existing DirectAdmin update process, then spot-check a newly exported saved resume on the server. This work prepares a release; it does not deploy it.
