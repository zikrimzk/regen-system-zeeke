# Kerjaya. · Phase 02B recovery audit

## Evidence

- The recovery started on the existing `main` checkout at `948a5bf`, tagged in its commit subject as the ReGen 1.1.3 deployment revision. The other accessible branch reference was `origin/main`. Git reported one attached worktree and no stashes.
- The entry worktree contained 62 modified tracked paths, 47 tracked deletions and 244 untracked entries in the short-status view. Existing Phase 00–02A documents live under `docs/regen-v2`. The worktree is the recovery baseline.
- Searches covered tracked and untracked project files, local Git refs and history for `docs/kerjaya/`, local output and prototype directories, matching file names in adjacent project locations, and accessible attachments and visualization artifacts. The preceding Phase 02C investigation also checked recent and archived Codex results and recent ChatGPT results for a matching project conversation.
- The two temporary Phase 02 design briefs were the initial ReGen redesign instructions. Phase 02A screenshots and the existing Kuala Lumpur artwork are valid design inputs, with no Phase 02B decision or prototype attached.
- No Phase 02B handoff was found in accessible sources. Unshared or externally stored artifacts remain outside this finding.

## Recovery scope

The six responsive HTML pages, their shared stylesheet, local prototype logic and browser evidence live in [prototypes/kerjaya](../../prototypes/kerjaya/). The [visual review](visual-review.md) links each page and capture. The two concepts are pending a new design decision.

The current app still uses custom PHP 8.3, native JavaScript and MySQL with the existing DirectAdmin release layout. Recovery uses standalone static HTML, CSS and JavaScript. The sample names, resume and letter content are fictional. Browser demo saves live in the current tab's session storage. The app routes, data, providers, authentication, entitlements, PDF generation and worker are outside the prototype surface.

The reproducible browser test uses the installed Chromium build through the Chrome DevTools Protocol. Its loopback server serves an explicit allowlist of six prototype pages, two local source files and their public sample assets. The local folder is outside `public/` and `php/`. This work did not require a cloud design file.

The byte-for-byte hash of the tracked Git diff from `HEAD` matched at entry and after prototype work. The only added work is under `docs/kerjaya/` and `prototypes/kerjaya/`. The existing [83 baseline assertions](mobile-pwa-baseline.md#checks-rerun-in-phase-02b) passed again. No routes, migrations, accounts, payment code, PDF engines or release configuration changed.
