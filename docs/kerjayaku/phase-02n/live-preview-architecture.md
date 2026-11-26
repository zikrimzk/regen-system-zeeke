# Live preview architecture

Editor inputs mark a draft pending. Resume Studio coalesces draft reads on an animation frame. Both studios use the existing preview permission and server PDF renderer for their working proofs. Hidden panes skip automatic requests. Cover Letter Studio sends printable fields and appearance to the draft preview route. Company research and the job description still go to the save and writing flows.

Resume inputs use the existing 900ms save cadence. Letter edits to a persisted record use a 780ms quiet interval, validity check and single in-flight save. New letters still require an explicit save because creation may use a benefit. Revisions prevent an older acknowledgement from labelling a newer draft saved. Realtime letter reads recheck document ID and revision after the request resolves.

Automatic previews wait 1.9 seconds after input. One automatic render request per pane may be in flight, and only the latest draft can replace the visible proof. While the replacement paints offscreen, a fixed status area and stable scrollbar gutter preserve the fitted width. The scroller keeps its position when the new pages replace the old ones.

Resume Review saves applicable pending edits before opening the saved PDF. PDF.js shows the page count as soon as it reads the document, paints the first page and defers later pages until they approach the visible scroll area. Existing export charges and template eligibility still apply on the server.
