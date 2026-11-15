# Landing page and mobile input update

30 October 2026.

The appearance-only promotion was replaced with an interactive explanation of three substantial product capabilities: section guidance, reviewable AI suggestions and matching application documents. The section shows an action/context/result example, a rewrite that retains those facts, and the matching resume/letter. Keyboard arrow keys, Home and End switch its tabs. The copy describes verified ReGen behaviour; it does not invent competitor limitations, rankings, awards or hiring-success statistics. The regular light/dark control stays in the header.

Public sample names and email addresses now use Zamir Zaini and zamir@example.com. These are fictional demonstration records. No account or saved applicant data was renamed.

## Typography and motion

The landing page now uses one locally served interface family derived from the bundled Inter regular and semibold faces, rather than choosing different operating-system families across devices. Its two WOFF2 subsets total **62,236 bytes**, with the 31,644-byte heading face preloaded. The source glyph widths are checked during the development build. The modified font has its own family name, ReGen Interface, and retains the original copyright and OFL licence; `public/fonts/Inter-OFL.txt` is distributed with it. Document font files are unchanged.

Headings use a consistent semibold hierarchy and less compressed tracking. Hero copy was shortened. The public stylesheet remains one request and within the existing 65 KB budget.

The hero and product example respond to a desktop pointer with restrained perspective. The effect is limited to fine pointers and larger screens, stops off-screen and when the page is hidden, and schedules work only in response to movement. It does not run an idle animation loop, intercept touch scrolling or load a 3D library. Reduced-motion preferences disable this effect and the section entrance animations. Product examples and links remain usable without the effect.

## Phone keyboard handling

The builder previously sized its content from the full dynamic viewport. Safari can resize only the visual viewport when its keyboard opens, and Chrome supports multiple resize behaviours. The new shared viewport helper measures the visible height and offset and keeps the editor navigation above that visible bottom. It handles both visual-only and combined layout/visual resizing, removes extra bottom safe-area padding while typing, and restores normal dimensions when the keyboard closes. Orientation changes and pinch zoom are handled separately; zoom is not disabled.

Focused fields scroll within their editor or open sheet after the viewport settles. Ordinary typing and manual panning do not force repeated page scrolling. Focused textareas grow without resetting to `height:auto` for each keystroke; shrinking is deferred until blur. Input text remains at least 16 CSS px in the application. The More sections navigation item now uses the same SVG icon system as the other steps.

`node scripts/check-mobile-viewport.mjs` exercises visual-only resizing, Android-style combined resizing, Safari offsets, focus scrolling, sheets, blur, read-only fields, desktop cleanup and pinch zoom using synthetic events (13 assertions). Responsive browser checks use the actual editor inside frames with phone widths and reduced visible heights. These checks do not replace a final UAT on physical iPhone/Safari and Android/Chrome keyboards, including their predictive-text and browser-toolbar behaviour.

In the browser checks, a focused 16 px field remained above the navigation at 320 × 360 CSS px. The navigation ended at the visible bottom, edits saved, and the viewport overrides cleared when returning to desktop width. The More sections item contained its SVG icon. The landing page was checked with its expanded mobile navigation, three benefit tabs and matching document previews. Dialog observation now waits for a real body element if a shared script starts before the document is ready.

References: [Chrome's viewport resize documentation](https://developer.chrome.com/blog/viewport-resize-behavior) and [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
