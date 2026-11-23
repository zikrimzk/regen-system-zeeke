# Candidate navigation

Desktop navigation groups Overview, Resume Studio, Cover Letter Studio and Mochi apart from billing, token activity, payment history, support, settings and account. The shared header provides account and notification controls. Compact mode keeps accessible names and tooltips and remembers a local display preference. The product still uses document navigations, so deep links and browser history remain normal links.

| Link or state | Destination and behavior |
| --- | --- |
| Resume Studio | `/builder` opens the latest owned primary record at its suggested section, preserving existing query parameters. With no resume, an in-Studio screen links to the existing template creation flow. |
| Resume deep link | `/builder?id=…&section=…` opens the requested record and section. Unavailable and revoked records display a recovery action. The API owns authorization. |
| Legacy library | `/resumes` remains reachable from Resume Studio. `/builder.html` still redirects through Phase 01 route handling. |
| Cover letters | `/cover-letters` opens recent work, `?id=…` opens a particular letter and `?new=1` starts an unsaved letter. |
| Mobile More | A native modal dialog contains secondary links. Escape, the close control and backdrop dismiss it. Focus returns to More. The sheet scrolls independently and closes when the desktop layout becomes active. |

The shell comes from `Navigation.php`, `WorkspaceShell.php`, `PageRenderer.php`, `candidate-navigation.js` and `candidate-workspace.css`. Dashboard, Studio, account and maintenance checks still use `Routes`, `FeaturePolicy`, `FeaturePricing` and `AccessMiddleware`.
