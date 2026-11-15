# Phase 02A · Design audit

The working tree started on `948a5bf` with Phase 01 and Phase 02 results in uncommitted work. The candidate app still runs on PHP 8.3, browser JavaScript and MySQL, with Apache-compatible packaging for DirectAdmin. The protected route and export findings in the Phase 00 and Phase 01 documents still apply.

| Screen | Evidence | Diagnosis |
| --- | --- | --- |
| Public home | Phase 02 desktop and 360 px captures, `landing.html` and `landing.js` | The foreground paper was real, but the first screen offered a static document and sent users past several sections for the working demo. The product's Malaysian identity was confined to sample copy. |
| Auth | Phase 02 phone sign-in and Malay registration captures | The mobile card was readable. Its relationship to the public product and saved-work message was weak. Preserve the order and fields. |
| Dashboard | Phase 02 mobile, desktop and dark captures, `dashboard.js` | Ten section rows drew attention away from the next task. The wallet kept more space than the document. The displayed name and icon made a resume look like a generic profile card. |
| Resume Studio | Phase 02 phone editor and PDF captures, `stepper.js`, `preview.js` | The section form and advance controls defined the experience. Preview occupied a separate dialog and took users out of desktop editing. Template, save and writing tools lived in different areas. |
| Templates and letters | Source review of `templates.html`, `cover-letters.html` and their scripts | Template comparisons and letter composition are genuine flows. The workspace needs clearer selected states, a smaller per-letter header and a reading surface for the body. |
| Mochi | Phase 02 editor capture and CSS/JS inspection | A floating character could compete with controls over a long form. The room, help and chat remain legitimate destinations. |
| Admin | Phase 02 desktop Overview and mobile Accounts captures | Keep the separate dark rail, scoped navigation and responsive tables. Harmonise form and dialog density. |

The before captures were produced in the Phase 02 local synthetic run and are available under `output/regen-v2`. Visual findings about letters and the template picker above are based on structure and CSS. The visual QA record distinguishes rendered surfaces from source inspection.

HitPay leads with a concrete local commercial benefit and follows it with recognisable ways to use the product. Adobe Express makes real templates part of the path to creating a resume. ReGen adopts direct task-led copy and places a working design comparison in the hero. The reference pages were inspected through their public rendered-content extraction. Their viewport screenshots and animation were not inspected. [HitPay Malaysia](https://hitpayapp.com/my/) · [Adobe Express resume creator](https://www.adobe.com/express/create/resume)
