# Phase 02K visual QA

All captures in this report are fresh Chrome renders from the isolated PHP candidate fixture. The viewport matrix used 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS px. Landing, login and registration were checked in both locales at all eight widths. Light and dark comparisons were also captured at 390 and 1440 CSS px.

| Surface | Before | After |
|---|---|---|
| Landing desktop | [Before](screenshots/before-landing-desktop.png) | [English light](screenshots/landing-desktop-en-light.png) · [English dark](screenshots/landing-desktop-en-dark.png) · [Malay](screenshots/landing-desktop-ms-light.png) |
| Landing mobile | [Before](screenshots/before-landing-mobile.png) | [English light](screenshots/landing-mobile-en-light.png) · [English dark](screenshots/landing-mobile-en-dark.png) · [Malay](screenshots/landing-mobile-ms-light.png) |
| Login desktop and mobile | [Desktop](screenshots/before-login-desktop.png) · [Mobile](screenshots/before-login-mobile.png) | [Desktop light](screenshots/login-desktop-en-light.png) · [Desktop dark](screenshots/login-desktop-en-dark.png) · [Mobile light](screenshots/login-mobile-en-light.png) · [Mobile dark](screenshots/login-mobile-en-dark.png) · [Malay mobile](screenshots/login-mobile-ms-light.png) |
| Registration desktop and mobile | [Desktop](screenshots/before-register-desktop.png) · [Mobile](screenshots/before-register-mobile.png) | [Desktop light](screenshots/register-desktop-en-light.png) · [Desktop dark](screenshots/register-desktop-en-dark.png) · [Mobile light](screenshots/register-mobile-en-light.png) · [Mobile dark](screenshots/register-mobile-en-dark.png) · [Malay mobile](screenshots/register-mobile-ms-light.png) |

| Interaction | Browser capture |
|---|---|
| Mochi, Assist Me and Refine Me | [Mochi](screenshots/writing-mochi.png) · [Assist Me](screenshots/writing-assist.png) · [Refine Me](screenshots/writing-refine.png) |
| Resume Studio | [Desktop selection](screenshots/preview-resume-desktop.png) · [Mobile selection](screenshots/preview-resume-mobile.png) |
| Cover Letter Studio | [Desktop selection](screenshots/preview-letter-desktop.png) · [Mobile selection](screenshots/preview-letter-mobile.png) |
| Explore More Career Tools | [Desktop](screenshots/tools-desktop.png) · [Mobile after a swipe](screenshots/tools-mobile.png) |
| Package invitation and FAQ | [Packages](screenshots/packages-invitation.png) · [FAQ expanded](screenshots/faq.png) |
| Auth feedback | [Rejected credentials](screenshots/login-invalid.png) · [Registration verification](screenshots/register-verification.png) |

## Browser findings and fixes

- The Malay device controls overflowed the 320px viewport. The control row wraps and keeps both 44px targets within its panel.
- The desktop hero image used its intrinsic width inside the frame. The picture now fits its container and preserves the capture’s aspect ratio.
- The auth API helper returns a failed connection result without a status. The forms show the localized connection error so visitors can retry without confusing it with denied credentials.
- Verified keyboard tab selection and focus, actual Chrome touch events in mobile emulation, native FAQ disclosure, device switching, language and theme switching, reduced motion, a keyboard-height resize and preserved focus. Browser viewport emulation provides the keyboard-height check. Physical Android and iOS keyboards, assistive technology and password-manager autofill remain review items.

Ten primary text, accent and button color pairs passed a 4.5:1 contrast check. The measured range was 6.00:1 to 16.21:1. This covers the checked palette combinations.

The [browser results](screenshots/browser-final.json) contain the tested widths, assertion labels, observed application requests and lab samples.
