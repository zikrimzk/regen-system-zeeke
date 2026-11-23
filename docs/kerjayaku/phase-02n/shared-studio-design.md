# Shared Studio design

The Studios use the authenticated Kerjayaku surfaces, typography, accent, focus styles and 44px controls. Desktop panes organise global navigation, document-specific navigation, writing and proof. The mobile Resume Studio uses its existing section sheet and Write/Preview modes. Cover Letter Studio uses a focused writing canvas and switches to its working paper when requested.

| Concern | Component and behavior |
| --- | --- |
| Commands | Resume retains the current document title, template picker, page setup, preview, review/export and existing save controls. Letter tools group PDF, download and explicit save above the writing canvas. |
| Draft state | Both editors expose pending, saving, saved and failure feedback. Offline drafts stay in the open editor. Resume and cover-letter saves still use their respective validation and persistence workflows. |
| Document selection | One primary owned resume, with the existing library accessible. Saved letters switch in-place after the open draft is preserved. |
| Rendering | `studio-paper.js` owns the lightweight proof. `pdf-pages.js` remains the authority for display of actual PDF bytes and DPI-aware zoom. |
| Appearance | `DocumentSettings` shares typography, layout and colour controls. Resume-specific fields and section order remain in the Resume Studio. |

No database migration, new dependency, format conversion or public frontend change is required for the Studio UI.
