# Phase 02L mobile and visual QA

Browser QA uses a disposable loopback PHP and MySQL fixture and a local Chromium session via the DevTools Protocol. The target widths are 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS px. The viewport matrix covers the landing, pricing, login and registration in both languages, plus light and dark captures at 390 and 1440 px.

| Surface | Before | After |
|---|---|---|
| Desktop hero | [Light](screenshots/before-ch1-desktop-light.png) · [Dark](screenshots/before-ch1-desktop-dark.png) | [Light](screenshots/landing-desktop-en-light.png) · [Dark](screenshots/landing-desktop-en-dark.png) |
| Mobile hero | [Light](screenshots/before-ch1-mobile-light.png) · [Dark](screenshots/before-ch1-mobile-dark.png) | [Light](screenshots/landing-mobile-en-light.png) · [Dark](screenshots/landing-mobile-en-dark.png) |
| Writing | [Mobile baseline](screenshots/before-showcase-mobile-dark.png) | [Mochi](screenshots/writing-mochi.png) · [Assist processing](screenshots/writing-assist-processing.png) · [Draft](screenshots/writing-assist.png) · [Refine](screenshots/writing-refine.png) |
| Resume Studio | [Mobile baseline](screenshots/before-studio-mobile-dark.png) | [Desktop frame](screenshots/preview-resume-desktop.png) · [Phone frame](screenshots/preview-resume-mobile.png) · [390px viewport](screenshots/studio-actual-mobile.png) |
| Cover Letter Studio | [Mobile baseline](screenshots/before-letters-mobile-dark.png) | [Desktop frame](screenshots/preview-letter-desktop.png) · [Phone frame](screenshots/preview-letter-mobile.png) · [390px viewport](screenshots/letters-actual-mobile.png) |
| Career tools | [Desktop baseline](screenshots/before-career-tools-desktop-light.png) | [Desktop](screenshots/tools-desktop.png) · [Mobile](screenshots/tools-mobile.png) |
| Packages | [Desktop](screenshots/before-packages-desktop.png) · [Mobile](screenshots/before-packages-mobile.png) | [Desktop light](screenshots/packages-desktop-en-light.png) · [Desktop dark](screenshots/packages-desktop-en-dark.png) · [All mobile slides](packages-comparison.md) |
| FAQ | [Mobile baseline](screenshots/before-faq-title-mobile-light.png) | [Desktop](screenshots/faq.png) · [Mobile](screenshots/faq-title-actual-mobile.png) |
| Login | [Desktop](screenshots/before-login-desktop.png) · [Mobile](screenshots/before-login-mobile.png) | [Desktop](screenshots/login-desktop-en-light.png) · [Mobile](screenshots/login-mobile-en-light.png) |
| Sign Up | [Desktop](screenshots/before-register-desktop.png) · [Mobile](screenshots/before-register-mobile.png) | [Desktop](screenshots/register-desktop-en-light.png) · [Mobile](screenshots/register-mobile-en-light.png) |

[Full-page light](screenshots/landing-full-light.jpg) · [Full-page dark](screenshots/landing-full-dark.jpg).

The nine checked text, CTA and focus color pairs ranged from 5.99:1 to 16.45:1. The palette check covers the checked combinations, while keyboard and focus checks were run in the rendered browser.

The synthetic plans and sample documents shown in the captures are QA records. The automated keyboard-height resize verifies focus and layout in Chromium. Physical software keyboard, password-manager autofill and installed PWA behavior remain device checks. [Machine-readable results](screenshots/browser-final.json).
