# Phase 02A · Design system

The public site uses editorial art and typography. The candidate workspace uses quiet boundaries, familiar document metaphors and a direct next action. Operations use the established dark rail and denser lists.

| Role | Token and implementation |
| --- | --- |
| Public display | `--type-display`, responsive 39–54 px in the bundled EB Garamond face. Use for the lead message. |
| Application typography | Inter. Body and inputs 16 px, compact controls 14 px, secondary metadata 13 px, dialog 20 px, section 22 px and page title 28 px. |
| Surfaces | Canvas, panel, subtle/raised and editorial roles in `public/css/tokens.css`. The editorial role is pale warm green in light mode and deep green in dark mode. |
| Color | Forest for primary actions in light mode and jade in dark mode. Neutral dividers group content. Status, focus and deletion retain dedicated colors. |
| Layout | Shared 4/8-based spacing, 44 px primary controls, 8 px control radius, 12 px panels, and 16 px dialogs. Workspaces use the shared content width and responsive gutter. |
| Motion | Reuse the shared short transitions and reduced-motion override. Hero comparison replaces the document directly. |
| Public media | Responsive WebP skyline and 320 px template images. The background illustration is decorative and the comparison announces the selected layout. |
| Forms and editing | One visible heading, real labels, repeatable entry controls and contextual actions. Existing validation and accessible live feedback stay in the form workflow. |
| Navigation and panels | Candidate links reflect released tasks. The Resume Studio uses a section rail from 981 px and a saved preview pane from 1200 px. Narrow widths use a section picker and draft preview layer. |
| Lists and tables | Keep document counts and next actions adjacent. Admin tables preserve column names when ordinary rows stack at narrow widths. Complex tables keep a contained scroll area. |
| Empty and error states | Start with a real template when the account is empty. Retry failed dashboard loads. Editable forms keep entered values during recoverable save failures. |

Reusable styles live in `tokens.css`, `main.css` and `interface.css`. `public-interface.css` is part of the existing generated `site.css` bundle. `studio.css` is scoped to the editor regions, toolbar and phone adaptation. The working controls keep existing IDs and document rendering lives in the existing PHP/PDF system. Visual defaults can be exercised via the development-only `/design-system` route.

Use decorative color and editorial type deliberately on public pages. Keep document tools close to the document. Use a direct task heading and put secondary guidance near the decision it supports. A colored outline identifies a selected element, focus or a meaningful status. Screen titles, field labels and buttons follow the same type scale.

## Skyline asset

The built-in ImageGen tool produced an original editorial illustration for this project. No third-party photo, logos or reference-page assets were used. The retired skyline assets are preserved in Git revision `40ed277` under `prototypes/kerjaya/assets/`. The existing OFL-licensed EB Garamond face is bundled with ReGen. Existing PHP-generated fictional templates supply the foreground.

Image prompt used for generation

> Create an original, art-directed website background illustration for a Malaysian career application / resume studio called ReGen. No text of any kind, no typography, no logos, no documents or interface. Editorial two-tone architectural illustration of Kuala Lumpur at early evening with accurate recognisable Petronas Twin Towers as the focus in the left middle third, shorter city buildings to right and a leafy foreground at lower left. Visually striking, refined Malaysian architecture, subtle hand-printed lithographic grain, precision architectural line, low contrast depth, calm mature publishing design. Palette predominantly warm cream highlights, cloudy pale jade, deep forest-green with emerald accents. Warm grey-green dusk sky. Keep outer frame full bleed, with depth in the foreground at bottom, no heavy vignettes. Artwork will sit behind a real bright white resume in UI which overlaps the right portion. Rectangular landscape 3:2 composition, high-quality subtle texture, no decorative floating objects. No reference photographs or assets.
