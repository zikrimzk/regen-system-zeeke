# ReGen PWA readiness — 30 October 2026

This is an implementation and verification report. It is not a third-party certificate or a claim that an app store has approved ReGen.

The latest performance, image delivery, accessibility and responsive fixes are recorded in [the 30 October audit follow-up](PWA_AUDIT_2026-10-30.md). That follow-up includes measured download reductions and current verification results.

## Implemented

- Manifest identity, scope, standalone launch, a start route, 192/512 px install icons, a separate maskable icon and resume/letter shortcuts.
- Desktop and mobile installation screenshots captured from the real editor with a fictional sample profile. Image dimensions and MIME types are checked by the release checks.
- Light default on the public landing page, a shared appearance control, and remembered appearance only when preferences are accepted.
- Forty-eight iOS launch images: twelve device profiles, two orientations and both system color schemes. The source logo remains unchanged. Native launch screens follow OS/browser support; the selected in-app appearance applies when the app opens.
- Safe-area spacing, dynamic viewport heights, 16 px form inputs, touch targets, reduced-motion support and solid-surface fallbacks for reduced transparency.
- Explicit first-visit choices: Accept all, Reject optional, or Choose cookies. Preferences and offline public storage can be chosen separately and reopened from the footer. The choice record expires after 180 days. Secure sign-in and abuse-prevention cookies remain essential.
- Public landing pages use cached content immediately and refresh in the background when offline storage is accepted. Public asset caching is versioned and bounded to 120 entries. Revocation removes ReGen public caches without touching unrelated cache data.
- APIs, authentication pages, private workspaces, document downloads and uploaded photos are excluded from Cache Storage. With no optional storage, a self-contained offline response still explains how to reconnect.
- New workers activate without forcing a page reload. Update prompts stay off sign-in, registration and profile forms. Builder and cover-letter drafts can block the optional Reload action while changes are unsaved.

## Verified locally

- All project JavaScript syntax checks and Composer/PHP page-asset checks.
- Thirty-three worker/manifest assertions covering consent defaults and expiry, same-origin policy messages, caching, background refresh, offline responses, revocation, request exclusions, cache bounds, installation icons and screenshots. These tests use deterministic fetch/cache implementations and make no network requests.
- Browser checks at 320/390 px and desktop widths: both public themes, preference persistence, cookie rejection/persistence/reopening, Google standard-button rendering, registration spacing, the cover-letter empty state and its template link, editor surfaces and letter actions.
- At 320 px, letter Save, Preview and PDF actions are all 48 px high; secondary actions have equal widths. Header controls remain on one row. Sampled form text/primary-button contrast pairs meet 4.5:1.
- Actual browser offline checks with the local PHP server stopped: an accepted public page loaded; private navigation showed the inline offline response without sample account data; rejecting optional storage removed the offline landing copy.
- Forty-eight startup-image links and manifest assets exist. The editor screenshots contain fictional data only. No live Google sign-in, reCAPTCHA challenge, AI request or email delivery was performed for this UI pass.

## Existing live-host observations

Read-only HTTPS requests to `https://regenzeeke.appnest.my` returned 200 for `/api/health`, `/manifest.webmanifest` and `/sw.js`. The manifest and worker supplied no-cache headers and root worker scope. These observations describe the existing deployment before this new ZIP is uploaded; they do not verify that this update is live.

## Checks still required after upload

1. Preserve the server `.env` and uploads. This pass adds no database migration; an installation that has not applied migration 010 must still follow `UAT_UPDATE.md`.
2. Verify the current HTTPS manifest, service worker, icons and previews. Install from a supported Android browser and Safari on an iPhone/iPad, then open from the home screen.
3. Verify the native splash, status bar, safe areas, keyboard, orientation changes and back navigation on physical devices. Device sizes outside the supplied launch-image set rely on browser/OS behavior.
4. Test the personalized Google button and full sign-in redirect on the deployed authorized hostname. The local standard button was checked; no existing Google account was used in testing.
5. Repeat acceptance/rejection, offline public/private navigation and one save/download on the hosted installation. Confirm an update does not discard a draft.

Browser installation and native presentation depend on browser and OS support. No Lighthouse score or external certification has been claimed. A formal certification request needs a named certification program and its own assessment.

## References

- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN: Standalone app display](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app)
- [MDN: Installation screenshots](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/screenshots)
- [Google Identity Services: supported button configuration](https://developers.google.com/identity/gsi/web/reference/js-reference)
- [Google reCAPTCHA: current badge and disclosure guidance](https://docs.cloud.google.com/recaptcha/docs/faq)
