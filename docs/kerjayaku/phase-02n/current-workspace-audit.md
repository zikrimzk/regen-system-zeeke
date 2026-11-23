# Candidate workspace audit

The working tree was based on `c75b23c` on `main` when Phase 02N started. It already contained public work through Phase 02M. The scoped recoverable copy is in the ignored `tmp/phase-02n-baseline/` folder with the original Git status, HEAD, SHA-256 manifest and copies of the shared and candidate source. The six initial ReGen audit documents and `docs/regen-v2/06-phase-01-foundation.md` describe the page, access and billing boundaries used here.

| Surface | Verified starting point | Phase 02N change |
| --- | --- | --- |
| Candidate shell | `WorkspaceShell` rendered top navigation and a mobile dock on most candidate pages. The resume editor used its own mobile controls. | Desktop destinations move to a shared sidebar. The candidate dock also applies to the Studios. |
| Overview | `/dashboard` used the same view and resume-centred render path as `/resumes`. | Overview leads with the newest accessible work and has separate credit and review summaries. The library route remains available. |
| Resume Studio | `/builder` chose the primary resume or redirected to templates. Saved desktop preview required a manual refresh. | In-Studio start and unavailable states, persistent panel controls and an immediate working preview. |
| Cover Letter Studio | `/cover-letters` listed saved letters, opened a blank form by default and shared the primary resume design. Save was explicit. | Opens the newest letter unless an ID or new-letter intent is specified. Existing letter edits can autosave. |
| Documents and accounting | `ResumeRepository::getOrCreatePrimary` and `getSummariesByUser` implement one primary resume per account. `CoverLetterRepository::list` selects multiple owned letters. `DocumentActions` protects previews and exports. | The UI adopts these existing policies. Multi-resume creation and new package semantics require a separate change. |
| Delivery | Framework-free PHP 8.3, native JS, Composer, MySQL-compatible SQL and existing PHP/Apache route registry. | Local synthetic MySQL 8 and Chrome were used. Production Apache and installed mobile behavior need device or staging validation. |

The initial screenshots show actual candidate pages at 390 and 1440 pixels. All account and document details are synthetic. See [baseline screenshots](screenshots/) and [regression results](functional-regression.md).
