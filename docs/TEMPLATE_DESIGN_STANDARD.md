# Resume template design standard

Implemented 5 November 2026. This updates the existing 16 designs; it does not add designs or change account entitlements.

## Product decisions

- Standard: Classic, Modern, Minimal, Heritage, Essential, Graduate. Premium: the remaining ten existing designs. The persisted `basic` identifier is retained for compatibility; the interface calls the collection Standard. Both collections use the same quality rules and controls.
- Twelve text-only designs use one reading column. Essential, Horizon, Atlas and Impact are purpose-built portrait designs. The old photo switch no longer controls rendering. The selected template determines whether a saved photo is shown. Switching designs preserves the uploaded image.
- Portraits sit beside the introduction in normal document flow. There are no absolute-positioned overlays, floating sidebars or layout tables. Missing or invalid photos collapse to a complete text introduction. The controls provide left/right placement, 3:4 or square framing, and upper/centre/lower crop focus. The server crops proportionally before PDF/browser rendering because Dompdf does not implement `object-fit`. New uploads normalize orientation and remove image metadata through browser re-encoding.
- Every design uses a deliberate masthead, section treatment and type scale. Dates align beside role/degree titles; company/institution metadata sits beneath. Contact details remain selectable text in the document body, with professional links on a separate line. Empty sections are omitted and saved section order is retained.

## Typography and geometry

New defaults: A4, 18 mm margins, 11 pt body, 1.30 leading, 10 pt between sections, 6 pt between entries and 1.5 pt between bullets. The individual designs specify names at 25-30 pt, headlines around 11-12 pt, section labels around 11-14 pt, bold role titles at least as large as body copy, and contact/date metadata at 9.5 pt. Long names reduce in size by default; explicit name sizes can wrap naturally. Text is left aligned within the reading column.

Controls offer 10-12 pt body text, 22/26/30 pt names, 11/12/13 pt headings, three section-spacing presets, independent 1.25/1.30/1.35/1.45 leading, 12.7/18/22 mm margins, heading case, right-aligned or separate-line dates, monochrome or restrained template accents, and existing section-order presets/reordering. Restore design defaults resets appearance only. Choices are allowlisted on the server and saved atomically with section/writing preferences.

The six genuine bundled families are Inter, Source Sans 3, Lato, EB Garamond, Libre Baskerville and DejaVu Serif. Labels describe the actual exported family. Legacy Arial/Calibri and Times/Georgia settings continue to map to the earlier sans/serif families. No proprietary Windows fonts or remote runtime font requests are required. Only the selected regular/bold faces are declared in the document; losslessly compressed WOFF2 copies serve browser previews with identical glyph coverage and advances.

Dompdf's line boxes multiply font ascender/descender metrics by `fontHeightRatio`. The PDF service normalizes that ratio for each bundled family, so an explicit line-height does not become materially larger in one font than another. This changes layout metrics, not glyph shapes or font size. PDF previews remain fixed A4 documents scaled by the existing preview components; they do not reflow the printed page at mobile breakpoints.

## Research and limits

The supplied notes were reviewed as a design proposal. Universal ATS guarantees, a strict three-font-size rule, and statements equating clean text extraction with guaranteed parser success were not adopted.

- [Greenhouse: unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) documents risks from columns, tables, graphics/photos, unclear sections, image-only files and contact information placed in document headers/footers. It also documents a 2.5 MB parsing limit. This supports the conservative text-only layouts and a separate portrait category. It does not establish universal ATS acceptance.
- [Harvard: resumes and cover letters for PhD students](https://careerservices.fas.harvard.edu/resources/resumes-cover-letters-for-phd-students/) recommends familiar fonts, 10-12 pt text and equal margins of at least half an inch. Our defaults are a product design choice within that range, not a claim of an optimal ATS score.
- [Harvard: impactful resumes and cover letters](https://careerservices.fas.harvard.edu/resources/hes-create-impactful-resumes-and-cover-letters/) emphasizes consistent formatting, white space, importance-based section order and checking PDF conversion. Its photo guidance reflects a US context; local/application requirements can differ.
- [Google Fonts source repository](https://github.com/google/fonts/tree/main/ofl) supplies the four added SIL OFL families, including the variable font sources for Source Sans 3, EB Garamond and Libre Baskerville. Regular 400 and bold 700 instances are bundled as TTF and WOFF2. Each family's license is included in `public/fonts`; existing Inter and DejaVu licenses remain bundled.

Text extraction, layout checks and visual review are regression evidence. They do not test an employer's ATS parser, hiring rules, accessibility tagging or PDF/UA compliance. Photo designs deliberately carry application guidance and are not marketed as equally safe for automated parsing.

## Verification and release

- `php scripts/render-resume-fixtures.php`, then `python scripts/check-resume-pdfs.py --render`: 80 resumes (16 designs x graduate/professional/senior/stress/sparse), plus 16 matching letters. Checks cover content retention, extraction order, invalid characters, A4 size, margins, nonblank pages, heading placement, file size and expected page-count ceilings. The checked profiles fit 1, 1, 2, 4-5 and 1 pages respectively.
- `php scripts/render-export-options.php`, then `python scripts/check-export-options.py`: six original cases plus six font families, four portrait side/frame combinations, a legacy photo flag on a text-only design, a missing portrait with left placement, an unusually long portrait header, and a customized layout. The checks inspect actual embedded font names and physical image bounds, as well as Unicode and optional content retention.
- `php scripts/generate-template-previews.php`, `python scripts/render-template-previews.py`, `node scripts/optimize-site-images.mjs`: generate the gallery from real PDFs. The catalog freshness check includes the font manifest. Use the configured bundled Python for PDF packages and the existing local font-build dependencies for fontTools/Brotli where needed.
- Local browser review exercises the real picker/settings with fictional data and a simulated save adapter, including photo/category filters, saving/reopening, resets, section order, phone/tablet/desktop overflow and font previews. This is component verification; it does not replace authenticated production UAT or physical-device testing.
- `composer check`, then `php scripts/build-release.php` and `php scripts/check-release-templates.php`: checks and package verification. No database migration is needed. The release contains bundled fonts/licenses, matching samples and generated thumbnails; it excludes QA routes, fixtures and output review documents.

The review collection is `output/pdf/regen-resume-collection.pdf`. Production publication and real employer-parser testing remain separate release activities.


## Sharpness and spacing refinement

The follow-up review identified a fixed 1.6-scale PDF canvas (about 953 px wide) and gallery images limited to 640 px. On dense screens and when enlarged, the browser had to magnify those bitmaps. Downloaded PDFs retain real text and embedded fonts.

`PdfPages` now calculates a backing bitmap from the actual displayed width, screen pixel ratio and zoom. It redraws on container resize, screen-density changes and zoom without refetching the PDF. Zoom enlarges the document on narrow screens as well. The previous page remains visible during redraw; closing or replacing a preview cancels rendering and disconnects observers. Each page has a 12-megapixel/4096-pixel-side ceiling to bound memory and support mobile canvas limits.

The gallery is now rendered from the real PDFs at 192 dpi and delivered as lossless WebP in 320, 640 and 1280 px variants. Responsive source selection avoids enlarging a small thumbnail on a dense display. The PWA cache allowlist includes only the named public high-resolution samples. Portrait crops retain 480 x 640 pixels (480 square for square frames), with the same physical size in the document.

All 16 designs were reviewed for spacing. The default introduction gap is 8 pt instead of 12; section gaps are 10 pt instead of 12; entries use 6 pt instead of 8; bullets use 1.5 pt instead of 2. Large masthead rule padding and redundant square-photo header height were reduced. Body text remains 11 pt and margins remain 18 mm. The optional relaxed spacing preset remains available.

[MIT's resume checklist](https://capd.mit.edu/resources/resume-checklist/) supports readable 10-12 pt text and consistent margins between half an inch and one inch. [UCLA's guidance](https://career.ucla.edu/resources/resumes-cover-letters/) also supports simple formatting and consistent date alignment. These sources inform the design; they do not establish a single perfect layout or universal ATS acceptance.


The isolated browser fixture verified native 1.25x density plus simulated 2x/3x/4x modes. Fit view at 794 CSS pixels produced 993, 1588 and 2382 backing pixels at 1.25x, 2x and 3x respectively. At 160% zoom on a 2x display, 1270 CSS pixels produced 2540 backing pixels. At a 375 px viewport with 3x density and 160% zoom, a 434 CSS-pixel page produced 1302 backing pixels. Extreme 4x/200% zoom stayed within the canvas ceiling. Resizing, multi-page rendering, cancellation and immediate document replacement were also exercised. These are component tests, not physical-device certification.

`python scripts/check-template-spacing.py` checks intersecting text rectangles and portrait/text collisions in all public designs and customization cases. Aligned role/date text is allowed when its rectangles do not intersect. The updated review PNGs are individual 1588 px pages; the PDF collection preserves vector text for full-size inspection.
