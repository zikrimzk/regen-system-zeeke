# Kerjaya. · Brand foundation

**Decision** · B · Career Workspace. See the [approved design handoff](approved-design-handoff.md).

Kerjaya. is a Malaysian career workspace. Public copy describes what a candidate can make and check. Signed-in copy describes the current task, the saved state or the next action. Use plain English and Bahasa Melayu in the implementation handoff, with interface language separate from authored documents. The prototypes show English (Malaysia). They use Malaysia-based fictional places and MYT where a saved time is displayed.

| Role | A · City to Career | B · Career Workspace |
| --- | --- | --- |
| Wordmark | EB Garamond with a warm accent on the period | Heavy Inter with a forest period |
| Main canvas | Warm paper `#f7f3e9` | Pale neutral `#f5f7f4` |
| Panel and quiet surface | `#fffdf8` and `#eee8d9` | `#ffffff` and `#ecf1ed` |
| Primary text and secondary text | `#20362c` and `#4a5d53` | `#172b25` and `#466057` |
| Primary action | Forest `#23533f` on light surfaces. Honey `#ffd298` on the dark feature panel. | Forest `#175543` on white or neutral surfaces |
| Selected row | `#e7ecdb` on light surfaces or `#315043` in the rail | `#e2eee7` |
| Rule and focus | `#dbd6c7`, `#275b42` on light surfaces and honey on forest | `#d3ded9` and `#176952` |
| Display type | EB Garamond leads the landing and the dashboard greeting | Inter throughout, with a tighter heading scale and rhythm |
| Product type | Inter 16 px body, 14 px controls, 13 px secondary text | Inter 16 px body, 14 px controls, 13 px secondary text |

Shared tokens live in [tokens.css](../../public/css/tokens.css). The spacing scale uses 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64 px. Primary controls have a 44 px minimum target. Dialogs use native keyboard behavior, an 18 px corner radius and a visible labelled close control. Focus uses a distinct 3 px ring. Neutral boundaries group the form and document. Selected and active states use color alongside text or semantics. Reduced motion switches smooth scrolling and transitions off.

## Assets and working rules

- The proposed wordmarks are text in both directions. Use the period consistently. Obtain the selected tab icon, maskable icon, monochrome artwork and install assets during the reviewed handoff before touching the current ReGen manifest.
- City to Career used two project-generated skyline images preserved in Git revision `40ed277`. The source provenance and original generation prompt are in the [Phase 02A design system](../regen-v2/02a-design-system.md#skyline-asset).
- Both concept galleries display the existing fictional [Modern](../../public/img/templates/modern-640.webp) and [Classic](../../public/img/templates/classic-640.webp) thumbnails and link the [Modern](../../public/samples/modern.pdf) and [Classic](../../public/samples/classic.pdf) sample PDFs. The editable demo's HTML paper is illustrative. Production output should continue to use the existing document engine.
- [Inter](../../public/fonts/Inter-OFL.txt) and [EB Garamond](../../public/fonts/ebgaramond-OFL.txt) are already bundled. The prototypes download their local subsets and use native fallback fonts.
- Use direct headings, no repeated marketing kicker above every section, and a restrained semantic accent. Desktop and phone layouts keep the same task and names. Never introduce placeholder career features, made-up success metrics or disabled actions that look functional.

Dark mode needs a separate token and screenshot review before a production change. The current ReGen dark mode remains the compatibility baseline.
