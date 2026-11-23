# Phase 02K performance and PWA QA

Chrome ran with a disposable PHP fixture, loopback networking and a cleared HTTP cache. These are lab observations on the workstation. The controller records Largest Contentful Paint and layout shift with PerformanceObserver. Production field percentiles and INP require separate collection.

| Lab sample | LCP | CLS | Hero screenshot body bytes |
|---|---:|---:|---:|
| 1440 CSS px, English | 512 ms | 0 | 42,614 |
| 390 CSS px, Bahasa Melayu | 484 ms | 0 | 16,558 |

The desktop count includes the workspace and phone. The mobile count includes its phone and a 64-byte picture source. Chrome also fetched a nearby lazy Studio preview during each sample (51,894 bytes desktop and 18,570 bytes mobile). Neither sample loaded the entire Studio catalogue. Compare with the local targets of 2.5 s LCP and 0.1 CLS. INP was not measured.

## Asset and rendering notes

- The ten bilingual WebPs total 293,820 bytes. Below-the-fold images are lazy and carry intrinsic dimensions.
- The public stylesheet is 60,902 bytes, 14,020 bytes with local gzip, and remains one blocking stylesheet request. The landing interaction script is 5,791 bytes, 1,934 bytes gzip. HTTP compression on the deployment host was not measured.
- The retired six hero variants total 752,828 bytes on disk. The current entry pages and offline shell make no requests for them.
- Marketing uses real synthetic screenshots, native image decoding, native scrolling and the existing Mochi sprite. The separate QA evidence stays outside the packaged public assets.

## Verification

- `composer check` passed syntax, page assets, Phase 01 policy checks, public assets, template, writing, mocked assistance, mocked Mochi and mail configuration checks.
- `php scripts/check-phase01-http.php` passed on isolated MySQL, including route policy, scoped administrative operations, PDF accounting and readiness.
- `node scripts/check-mobile-viewport.mjs` passed 13 checks. `node scripts/check-pwa.mjs` passed 46 checks for cache consent, privacy, offline fallback and manifest behavior.
- Chrome accepted the published app manifest and confirmed opt-in warming for the hero assets. Protected account and API paths were absent from public Cache Storage. Public demo actions made zero API mutations.
- `php scripts/build-release.php` and `php scripts/check-release-templates.php` passed with a disposable release. The archive contained all ten marketing WebPs and the new components. It excluded QA screenshots. Fresh-cache PDF exports passed for the six bundled font families.
- No production traffic or field data was used. An installed application walkthrough and physical network/keyboard checks remain for iOS and Android.

[Browser JSON and local measurements](screenshots/browser-final.json). [Source previews and replacement notes](product-screenshot-manifest.md).
