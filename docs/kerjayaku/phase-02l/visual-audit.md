# Phase 02L visual audit

The starting point was the rendered Phase 02K landing, Packages, Login and Sign Up. Chrome captured the current working tree with the public catalogue populated from isolated MySQL. Fresh baseline screenshots use the `before-` prefix. The brief describes additional screenshots, but the pasted attachment contains text. The repository render served as direct evidence.

| Finding | Source and cause | Correction |
|---|---|---|
| Deep blank bands at linked sections | `site-controls.css` set 100px scroll padding and `landing.css` added an 88px scroll margin. `commercial.css` also added its full section gap between each Studio. | One scoped header offset, smaller inter-section spacing and tighter copy blocks. |
| Phone preview looked lost in the panel | `commercial.css` limited the handset to 224px inside a wide tinted stage. The desktop stage had a 330–476px minimum and mobile a 390px minimum. | Intrinsic stage heights, larger handset, clear bezel and neutral depth localized to the frame. |
| Hero composition gave the phone and Mochi little context | The phone was an absolute overlay and the speech label sat outside the UI composition. | A concentrated workbench with stable imagery, two Studio links and a Mochi guide at its edge. |
| Pricing lacked a common baseline | `pricing.html` used a public card renderer shared with the Store. Optional artwork, offers and fallback headlines gave names and prices different vertical positions. | A scoped public plan renderer compares identity, price, action, entitlements and conditions in aligned rows. |
| FAQ focused on utility settings | The last item promoted optional browser storage. | Eight candidate questions, a support route and neutral accordion separators. |

The Hostinger references informed scanning order, aligned prices and clear terms. Adobe’s pages informed leading with visible product interactions. Kerjayaku uses its own layout, copy and assets. [Hostinger Malaysia](https://www.hostinger.com/my/), [Hostinger pricing](https://www.hostinger.com/my/pricing), [Adobe](https://www.adobe.com/), [Adobe Express resumes](https://www.adobe.com/express/create/resume).
