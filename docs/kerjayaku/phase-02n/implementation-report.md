# Phase 02N implementation report

See the [functional regression matrix](functional-regression.md) for executed commands, visual evidence and the remaining approval checks.

| Function | Candidate action and visible result | Admin control and enforcement | UI and frontend | Backend and database |
| --- | --- | --- | --- | --- |
| A · Candidate shell | Open candidate destinations and choose compact navigation. Resume Studio opens directly. | Existing candidate access and maintenance restrictions still govern requests. | `WorkspaceShell`, sidebar, header and local compact preference. | Existing page registry and access middleware. No schema change. |
| B · Mobile navigation | Open Overview, Studios, Mochi and More. Close More with the close button, backdrop or Escape. | Candidate permissions remain on the actual destination. | Safe-area dock, native dialog and keyboard-aware hiding. | Existing routes. No schema change. |
| C · Overview | Continue the latest accessible document, check the balance and open an existing review. | Admin feature switches, AI availability and existing data determine the displayed actions. | Owned summary, loading, empty, failure, credit and review state. | Existing dashboard, cover letter, prices and review APIs. No schema change. |
| D · Studio foundation | Edit either document and read a consistent save state. | Existing section validation, ownership and pricing still apply. | Shared paper and appearance components. Native focus and recovery controls. | Existing document actions and PDF.js renderer. No schema change. |
| E · Toolbar | Find preview, export, appearance and save beside the current document. | Paid PDF commands retain the existing access dialog and server grant checks. | Labelled and icon-enhanced commands, semantic status and expandable panes. | Existing PDF and save routes. No schema change. |
| F · Resume Studio | Edit supported sections, navigate structure, switch allowed designs and resume existing work. | Resume editor and template permissions remain authoritative. | Direct owned document, contextual section navigator, fallback and mobile modes. | `ResumeActions`, `ResumeRepository`, and template access. No schema change. |
| G · Live preview | See an immediate proof, request the exact PDF and save before exporting. | Working proof requires existing feature and package preview access. The PDF engine and token rules govern authoritative output. | Frame-coalesced proof, revision-aware saves and cancellation of superseded PDF renders. | Existing preview and export actions. No schema change. |
| H · Appearance | Change supported typography, colour or layout. See a proof before committing. | The settings endpoint validates and applies current access. | Shared inspector, design defaults and linked-letter notice. | Existing `documentSettings` payload and document layouts. No schema change. |
| I · Contextual AI | Request help for existing eligible fields and explicitly accept or discard a suggestion. | Existing permissions, rate limits, provider privacy and settlement remain enforced. | Current Assist Me, Refine Me and the letter suggestion review. | Existing AI actions and quota service. No schema change. |
| J · Mochi | Open Mochi in either Studio through the header, or open the dedicated room from navigation. | Existing adoption, chat and quota rules remain in force. | Existing companion panel and context, with no floating overlay over document tools. | Existing Mochi routes and policies. No schema change. |
| K · Cover Letter Studio | Start a new draft, switch saved letters, write, view both proofs and export. | Creation, AI and downloads still use existing feature checks. Subsequent draft saves use the existing update route. | Writing surface, collapsible context, revision-aware autosave and shared tools. | `DocumentActions`, `CoverLetterRepository` and `CoverLetterTemplate`. No schema change. |
| Mobile/PWA | Continue using candidate routes with a touch-friendly dock and in-place network recovery. | Private pages and APIs retain the existing session and cache policy. | Viewport-aware handling and in-memory drafts. | Existing service worker and authenticated shell. No schema change. |

## File inventory

| Area | Modified | Added |
| --- | --- | --- |
| PHP | `InterfaceText.php`, `Navigation.php`, `PageRenderer.php`, `WorkspaceShell.php` under `php/src/`. `builder.html`, `cover-letters.html`, `dashboard.html` under `php/views/`. | |
| Frontend | `app.js`, `cover-letters.js`, `dashboard.js`, `document-settings.js`, `feature-access.js`, `interface.js`, `mobile-viewport.js`, `preview.js`, `service-centre.js`, `stepper.js`, `studio.js` and the experience, projects and extracurricular sections under `public/js/`. | `public/js/candidate-navigation.js`, `public/js/studio-paper.js`, `public/css/candidate-workspace.css`. |
| Regression | `scripts/check-page-assets.php`. | `scripts/check-phase02n-http.php`, `scripts/capture-phase02n.cjs`, Phase 02N documents and rendered browser evidence. |

## Compatibility and risk

- Existing resume and letter records, template IDs, private data, checkout, entitlements, API payloads, legacy URL aliases and deployment configuration retain their current contracts.
- The lightweight proof can differ visually from a rendered PDF. The candidate can check authentic renderer output before downloading.
- Cover letters inherit the primary resume’s design. A future independent appearance system would need an additive model and migration review.
- New drafts and failed saves stay private in the open page. Reloading or closing the page can lose unsaved edits after the browser’s warning. An installed-PWA and physical-device pass should validate suspend and resume.
- Live AI answers and production browser/device performance require separate validation. The phase leaves the public work paused and awaits visual review.
