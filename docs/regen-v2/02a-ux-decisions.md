# Phase 02A · UX decisions

| Concept | Originality and local identity | Trust and readability | Mobile and cost |
| --- | --- | --- | --- |
| Malaysian Career Momentum | A Kuala Lumpur editorial illustration frames a real ReGen document. Local job language carries the identity into the copy. | A plain-language task and visible template results establish what a user can make. | The same source art has a smaller crop-ready format. Paper and controls remain ordinary HTML. |
| Focused Career Workspace | A working document drives the layout. Neutral color and precise editing controls give the product its identity after sign-in. | The editor separates saved content, current draft and paid export. Dashboard shows the actual next section and saved date. | Narrow widths show one form at a time. The existing section and modal infrastructure controls the change cost. |

Use the first concept publicly and the second inside the app. Align both with the same typography, colors and verbs. Use restrained editorial typography only on the public lead. Keep marketing demonstrations keyed to admin template publication and real pricing data.

| Principle | Product decision |
| --- | --- |
| Recognition over recall | Display the active resume’s title, actual template and last saved time. Keep the current section visible and give users named preview controls. |
| Visibility of system status | Bind save messages to the existing write result. Mark the saved preview stale after a successful content or template write. Distinguish the template example from candidate content. |
| Grouping | Keep document actions beside the document. Move writing help, template browsing and letter tasks into supporting groups. Put document structure, form and preview in separate Studio regions. |
| Progressive disclosure | Default the dashboard to the next incomplete section and make the full section list expandable. Give phones one active form, a section picker and a separate preview. Keep recipient and job context collapsed in letters. |
| Fitts and Hick | Give primary commands full-height targets and reserve the public comparison for a small set of published designs. Retain the full catalogue for intentional comparison. |
| Recovery and user control | Keep the existing dirty-state guard, explicit save and retry. Open export preview only through a deliberate action. Preserve review and dismissal for writing suggestions. Use a dedicated Studio entry point for Mochi. |

## Function outcomes

| Function | Candidate or guest | Administrator | Reused boundary |
| --- | --- | --- | --- |
| Public | Switch published fictional samples without signing in. Follow registration, design browsing and real PDF links. | Keep existing template and catalogue publication controls. | `PublicSite`, `TemplateManagement`, `TokenStore`, current auth routes. |
| Workspace | Identify the saved title, its design and the next useful action. Reach real letters and settings, and see honest provider status. | Existing feature controls determine whether document and assistance actions can be used. | `GET /api/dashboard`, existing feature-access client, PDF actions and server ownership. |
| Resume Studio | Navigate actual sections, edit and save, switch a permitted design, check the saved or draft document and review before export. | Existing template and plan restrictions apply to the same requests. | `Stepper`, `DocumentSettings`, `ReGenTemplates`, `Api.saveSection`, `PdfPages` and Phase 01 guards. |
| Letters and Mochi | Use the same controls for authoring, saved letters, preview and writing assistance. Open Mochi from a named editor control where available. | Retain the existing account and feature limits. | Existing letters, AI and Mochi handlers. |
| Administration | The candidate workspace remains independent of operations. | Retain dark navigation, real counts, scoped modules and audited actions. | Existing admin routes, capability checks and realtime signals. |

The route map and document formats carry forward. The previous upcoming deep links still resolve to their information pages. The main candidate menu now promotes released tasks. Interface language is separate from candidate document content. New copy uses shared EN and BM keys, MYR is displayed with RM when returned by the catalogue and the dashboard formats saved dates in Kuala Lumpur time.
