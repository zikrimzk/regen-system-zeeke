# Kerjaya. · Mobile and PWA baseline

## Current ReGen application

Keep the existing manifest identity, scope, start route, icon variants, shortcuts, standalone launch, iOS launch images and update path until the selected brand has an install and upgrade test. Optional public cache storage follows consent. APIs, authentication, private workspaces, uploaded photos and document downloads stay outside Cache Storage. Revoking optional storage clears the ReGen public cache. Save, PDF preview and export still use the application’s current services and permissions.

The [PWA readiness guide](../PWA_READINESS.md) records the manifest, consent and privacy contract. The [October 2026 audit](../PWA_AUDIT_2026-10-30.md) records a Chrome check with the local PHP server stopped. A consenting browser reopened the public landing with styling and logo, private navigation returned a reconnect screen, and revocation removed the public offline copy. The [score review](../PWA_SCORE_REVIEW.md) distinguishes deterministic and browser checks from installed-device verification.

| Baseline evidence | Project path |
| --- | --- |
| Public mobile layout | [ReGen landing](../../output/pwa-audit/landing-mobile.jpg) and [dark landing](../../output/pwa-audit/landing-mobile-dark.jpg) |
| Document preview | [ReGen mobile preview](../../output/pwa-audit/preview-mobile.jpg) |
| Public offline navigation | [ReGen offline capture](../../output/pwa-audit/offline-public-final.jpg) |
| Viewport sweep | [ReGen responsive checks](../../output/pwa-audit/responsive-checks.json) |
| Current working-tree predecessor | [Phase 02A workspace](../../output/regen-v2/phase-02a/05-workspace-phone.png), [Studio](../../output/regen-v2/phase-02a/08-studio-phone.png) and [dark Studio](../../output/regen-v2/phase-02a/17-studio-dark-phone.png) |

## Checks rerun in Phase 02B

| Command | Passed | Coverage |
| --- | ---: | --- |
| `node scripts/check-mobile-viewport.mjs` | 13 | Mobile viewport, panning, focus scrolling, dialogs and pinch-zoom with synthetic events |
| `node scripts/check-pwa.mjs` | 39 | Manifest, cache privacy and offline responses with deterministic fixtures and no network requests |
| `php scripts/check-page-assets.php` | 31 | Runtime asset invalidation and shared navigation with local fixtures |
| **Total** | **83** | Existing baseline retained |

The [prototype browser evidence](visual-review.md) is separate. The concepts are standalone pages with fictional data and temporary tab storage. They register no service worker, manifest or install flow.

## Acceptance after selection

- Run the selected page groups in Chrome at 360, 390, 430, 768, 1024 and 1440 px. Compare actual ReGen edit, preview, export, dialogs and scrolling with the predecessor links above. Cover reduced motion and light/dark mode in the implementation.
- On an Android phone and iPhone, check an existing launch and upgrade, keyboard opening and dismissal across long forms, preview pan and zoom, orientation, safe areas and back navigation. Verify the sticky save bar and active field remain visible while editing.
- In an isolated fixture account, confirm that offline and session expiry preserve draft recovery and prevent cached exposure of personal data. Repeat save, template switch and PDF preview/download with actual entitlement checks.
- Measure loading and layout stability against the application in the same environment and cache conditions. Phase 02B emulation does not establish production performance or native installation behavior.
