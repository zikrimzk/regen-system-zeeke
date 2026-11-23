# Functional regression

Browser evidence comes from a disposable localhost PHP and MySQL fixture and actual Chromium rendering. The tests use synthetic accounts and documents. Core navigation, persistence and PDF requests reach the real PHP app. The suggestion screenshot uses a fixture response substituted in the browser.

## Running the checks

- `composer check` runs PHP lint, runtime asset checks, route policies, public assets, templates, writing and mocked AI checks, and mail configuration checks.
- `php scripts/check-phase02n-http.php` runs the candidate workflow in Chrome DevTools Protocol. It requires a localhost development/testing database, PHP, Node and Chrome. Set `KERJAYAKU_CHROME` for a non-default Chrome location and `KERJAYAKU_02N_EVIDENCE` for a different output location.
- `php scripts/check-phase01-http.php` independently exercises ownership, maintenance, scoped administration, compatibility routes and PDF accounting.
- `node scripts/check-pwa.mjs` and `node scripts/check-mobile-viewport.mjs` verify private-cache exclusions, offline handling and viewport behavior with controlled events.

## Results

The final Chrome run passed 46 browser assertions and reported zero page-script errors. It captured 29 before/after and state screenshots across the phase. `composer check` passed, including lint for 167 PHP files, 34 page-render assertions and 182 template assertions. The Phase 01 isolated HTTP regression passed. Node checks passed for API coalescing (12), commerce UI (12), realtime (24), PWA privacy (46) and mobile viewport behavior (13). The ZIP build and packaged-template check passed in the disposable clone.

The final trace measured 86ms from the pre-input mark to the updated proof and 1,188ms to the saved acknowledgement, including the quiet interval and loopback latency. The Overview sample recorded 3.43s LCP, 0.077 CLS and 494 elements. These timings include CDP and cold fixture overhead. No production performance threshold was validated. The trace confirms the edit can update the working paper before persistence. Continuous typing did not start an export request.

## Rendered evidence

| Surface | Before | After |
| --- | --- | --- |
| Overview | [390px](screenshots/before-overview-390.png), [1440px](screenshots/before-overview-1440.png) | Returning candidate [390px](screenshots/overview-returning-mobile.png), [1440px](screenshots/overview-returning-desktop.png). New candidate [390px](screenshots/overview-new-mobile.png), [1440px](screenshots/overview-new-desktop.png). |
| Navigation | Visible in baseline renderings above. | [Expanded](screenshots/navigation-expanded-desktop.png), [compact](screenshots/navigation-collapsed-desktop.png), [mobile dock](screenshots/navigation-bottom-mobile.png), [More sheet](screenshots/navigation-more-mobile.png). |
| Resume Studio | [390px](screenshots/before-resume-390.png), [1440px](screenshots/before-resume-1440.png) | [Editor and live paper](screenshots/resume-live-desktop.png), [authoritative PDF](screenshots/resume-pdf-desktop.png), [appearance](screenshots/resume-appearance-desktop.png) and [Mochi](screenshots/resume-mochi-desktop.png). Mobile [editor](screenshots/resume-editor-mobile.png), [PDF](screenshots/resume-preview-mobile.png), [appearance](screenshots/resume-appearance-mobile.png) and [Malay dark](screenshots/resume-mobile-malay-dark.png). |
| Cover Letter Studio | [390px](screenshots/before-letter-390.png), [1440px](screenshots/before-letter-1440.png) | [Writing](screenshots/letter-writing-desktop.png), [PDF](screenshots/letter-preview-desktop.png), [appearance](screenshots/letter-appearance-desktop.png) and [AI suggestion](screenshots/letter-ai-suggestion-desktop.png). Mobile [writing](screenshots/letter-writing-mobile.png) and [PDF](screenshots/letter-preview-mobile.png). |

The [browser transcript](screenshots/browser-results.txt) records assertion totals, expected denials, request counts and local timings. The [Resume Studio trace](screenshots/resume-autosave.trace.json) records input, working-paper update and server acknowledgement marks. Timings include CDP overhead. Field INP and physical-device performance still need measurement.

| Function group | Browser behavior covered |
| --- | --- |
| A–B · Shell and dock | Direct Studio entry, compact sidebar persistence, More dismissal and focus restoration, deep-link refresh and 320/360/390/430/768/1024/1440 widths. |
| C · Overview | Returning and new accounts, real letter and resume summaries, wallet, controlled API failure and retry, Malay landscape and a current dark-theme route. |
| D–H · Shared and Resume Studio | Explicit first template selection, 11 section destinations, live paper, late PDF rejection, save-before-export, protected PDF, paid accounting, type setting persistence and inspector views. |
| I–J · AI and Mochi | Real Mochi launcher and panel, simulated AI draft response through the real cover-letter UI, explicit accept and discard, mocked provider validation in the existing PHP suite. |
| K · Cover Letter Studio | Explicit creation, persisted autosave, real offline-to-online save recovery, mobile working mode, PDF export, saved-draft text and sign-in recovery. The fixture uses a simulated viewport contraction for keyboard coverage. |

The HTTP ownership denial, renewed session check and purchase confirmation appeared as expected 404, 401 and 402 responses in the isolated run. The scripted paid resume and letter exports consumed exactly one two-token use apiece. No production provider or payment flow was contacted.

## Remaining manual checks

- Use the standalone PWA on physical iOS and Android. Exercise the actual keyboard, dictation, panning, back gestures, scroll recovery, resume after suspend, and PDF downloads.
- Run a full screen-reader and large-text pass in English and Bahasa Melayu. Some existing help and application fields still use their original English text.
- Verify all template-specific choices using the actual PDF output, including photo framing, multi-page documents, and typography at print size.
- Review the browser evidence and the inherited appearance decision before approval. A complete across-device, all-section edit and paid provider matrix requires separate QA.
