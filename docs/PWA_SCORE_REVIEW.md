# PWA score review — 30 October 2026

Google PageSpeed Insights completed a fresh audit of **https://regenzeeke.appnest.my/** at **8:19 AM GMT+8** using Lighthouse 13.6.0.

[Open the measured report](https://pagespeed.web.dev/analysis/https-regenzeeke-appnest-my/hkywxlm9ub?form_factor=mobile).

| Lab category | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | 99 | 98 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |

Mobile: FCP 0.9 s, LCP 0.9 s, TBT 70 ms, CLS 0, Speed Index 3.3 s. Emulated Moto G Power, slow 4G, initial load. Desktop: FCP/LCP 0.3 s, TBT 70 ms, CLS 0.004, Speed Index 1.6 s. Scores are lab observations for this run and can vary. PageSpeed reports no real-user field data for this site.

**These scores measure the older deployed build.** Its HTML still loads separate main/product/landing/appearance stylesheets and the original Inter preload. The optimized local build and this menu correction have not been deployed. These results must not be presented as local post-fix scores.

Remaining live diagnostics include render-blocking requests, font display, image delivery and static cache lifetimes. The local performance update addresses these, but an after-deployment run is needed to measure its actual effect.

## Why the local menu regressed

The public CSS bundle referenced `--popover-bg` without including its definition, which remained in the private application stylesheet. The computed menu background was `rgba(0, 0, 0, 0)`. A browser screenshot reproduced the user's report exactly: the hero remained visible through the open navigation panel.

The shared popup surface and shadow tokens now live in the main design tokens for light and dark themes. The mobile menu and appearance selector use opaque popup surfaces, and navigation also has a fallback background. Short screens can scroll the menu within the available viewport. The missing dark/system appearance swatches are restored. The stylesheet builder now fails on unresolved custom properties that have no fallback, preventing this specific packaging failure from being silently shipped again.

The source change builds successfully. Automated source/asset checks are separate from visual approval. **Post-fix visual checks and a native localhost Lighthouse run were interrupted:** browser control could not establish Opera's current URL with sufficient confidence, so browser testing was stopped. No attempt was made to bypass that restriction. Local closed/open navigation in both themes, short-screen scrolling and the appearance menu still need visual verification.

## What a PWA score means here

Current Lighthouse versions have no separate PWA category. Google's [Chrome 126 release notes](https://developer.chrome.com/blog/new-in-devtools-126/#lighthouse-1200) document its removal, and [Chrome's installation guidance](https://developer.chrome.com/blog/update-install-criteria) explains why those scores were insufficient to establish app quality.

High web-category scores do not establish correct installed behavior. ReGen still needs separate checks of its manifest/icons, worker scope, offline privacy behavior, installation, native launch, safe areas, keyboard, orientation and interactions on real devices. The existing local worker tests cover consent and cache exclusions; they do not certify Android/iOS installation or all UI states.

The previous SEO Review Tools screenshot's 94% chart and “Poor” label should not be substituted for the current measured category scores or treated as a certification. Saved visible report text is in `output/pwa-live-review/live-mobile-report.txt` and `live-desktop-report.txt` in the local workspace.
