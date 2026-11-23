# Product screenshot manifest

The public previews are published in `public/img/marketing/studios/` by the `PublicProduct::MEDIA` mapping. Each filename takes the suffix `-en.webp` or `-ms.webp`. This mapping supplies intrinsic dimensions, localized alt text and load priority.

| Base name | Size | Real source | Composition |
|---|---:|---|---|
| `workspace` | 1100×620 | `/dashboard`, signed-in candidate overview | Cropped desktop viewport for hero |
| `resume-desktop` | 1200×780 | `/builder?id=…&section=personal` | Real editor, section list and template preview |
| `resume-mobile` | 390×752 | Same builder with mobile viewport | Real editor and mobile writing controls |
| `letter-desktop` | 1200×780 | `/cover-letters?id=…` | Real saved sample letter workspace |
| `letter-mobile` | 390×620 | Same letter at 390 CSS px | Top crop of the real mobile writing form |

The source PNGs come from `scripts/check-phase02k-http.php` and `scripts/capture-phase02k.mjs`. Only the disposable `StoreHttpFixture` account, seeded sample resume and fictional saved letter were used. The PHP and browser capture ran against loopback. Source captures are in [screenshots](screenshots/). Crop or re-encode the new screenshot, update the manifest for dimension changes and run the site and browser checks when the authenticated design changes.
