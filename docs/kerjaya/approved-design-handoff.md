# Kerjaya. · Phase 02C design handoff

The project owner selected **B · Career Workspace** in the Phase 02C conversation. The following Phase 02B artifacts are the implementation reference.

| Surface | Prototype |
| --- | --- |
| Public landing and navigation | [Workspace landing](../../prototypes/kerjaya/workspace/index.html) |
| Candidate dashboard | [Workspace dashboard](../../prototypes/kerjaya/workspace/dashboard.html) |
| Resume Studio desktop and phone | [Workspace Studio](../../prototypes/kerjaya/workspace/studio.html), [phone Preview mode](../../prototypes/kerjaya/screenshots/workspace-studio-preview-mobile.png) |
| Tokens, type, spacing and controls | [Prototype styles](../../prototypes/kerjaya/prototype.css), [brand foundation](brand-foundation.md), [review board](../../prototypes/kerjaya/screenshots/workspace-review.png) |

## Implementation acceptance criteria

- Preserve the Inter wordmark, neutral surfaces, forest actions, clear hierarchy and 44 px interactive targets. Carry the existing accessible dark theme into the new layout and verify both themes and reduced motion.
- Lead the public page with the workspace and current tools. Link to real sign-up and existing examples. Keep localized public navigation, pricing and policy links functional.
- Show the next useful task and the candidate's actual records. Verify loading, empty, failure, retry and session expiry. Keep navigation and links usable at 360, 390, 430, 768, 1024 and 1440 px.
- Retain desktop outline, active form and real PDF preview. On mobile provide explicit Write and Preview modes, keep section selection and save available, and retain draft values and focus when changing modes. Verify own-document edit, save, template selection, preview and an entitled download using synthetic records.
- Extend the approved brand to other candidate and admin surfaces while keeping established workflows and admin abilities. Preserve aliases, PHP routes, JavaScript API contracts, documents, templates, payments, private records and existing DB schema.
- Preserve the current PWA registration, install identity and offline privacy policy. Compare current and new captures and check caching, offline fallback and performance. Confirm native keyboard, scrolling and installation on Android and iOS before full release acceptance.

The [visual review](visual-review.md) documents the source screenshots and prototype scope. The [mobile and PWA baseline](mobile-pwa-baseline.md) records the existing application evidence.
