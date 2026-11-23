# Phase 02I implementation report

## Audit and decisions

The inherited source still used detached absolute-positioned cards, two layers of navigation, a pricing dialog and a legacy landing script that referenced controls absent from the page. The proposed gallery view and capture runner were empty. Several old checkpoint files had identical SHA-256 hashes. The registration and login mascot announced success on form submission before seeing the result. The old attribution named Kerjayaku Engineering.

Phase 02I repurposes the same native PHP and JavaScript application. CSS and the SVG road are sized by actual page content, and the public storyboard uses its own independent local scene controller. The verified reset and sign-in logic, billing, entitlement enforcement and document services stay on their original paths. The scene artwork is original vector illustration and uses the existing Mochi sprite. No migration, package dependency or deployment is part of this work.

| User can do | Visible result | Admin and backend behavior |
| --- | --- | --- |
| Scroll down or back, skip the journey, follow a checkpoint | A moving character, twelve illustrated scenes and a reduced-motion reading sequence | Public story JavaScript stays local. The signed-in Mochi service and its entitlements keep their existing administration. |
| Browse packages or a published resume template | Separate pages have real catalogue items, mobile package snapping and working sample links | The existing pricing visibility settings and template catalogue decide what appears. Payment and sample access use the existing endpoints. |
| Sign in or create an account | A single Mochi reacting to input and confirmed outcomes beside the original forms | Authentication, notices, password rules and verification are still handled by the existing application. A test-only mail sink can check the registration handoff locally. |
| Read common questions and manage optional storage | The FAQ remains available and public pages show Zeeke Software Solution attribution | Cookie consent scopes public caching and the existing manifest identity and private-route exclusions remain in place. |

## Files and routes

- Public screens and shell · `php/views/landing.html`, `pricing.html`, `templates-gallery.html`, `public-footer.html`, `offline.html` and `not-found.html`. `php/src/PublicSite.php`, `PageRenderer.php`, `Brand.php` and `InterfaceText.php` render the new `/resume-templates` page and `/packages` alias while keeping `/pricing` and the protected `/templates` destination.
- Public styling and motion · `public/img/kerjayaku-world.svg`, `public/css/landing.css`, `public-interface.css`, generated `site.css`, `public/js/mochi-road.js`, `mochi-story.js`, `templates-gallery.js` and `landing-pricing.js`.
- Authentication · `php/views/login.html`, `register.html`, `verify-email.html`, `public/css/auth-journey.css`, `public/js/mochi-auth.js` and `auth.js`.
- Release and verification · `public/sw.js`, `scripts/build-release.php`, `scripts/check-site.php`, `scripts/check-phase02i-http.php`, `scripts/capture-phase02i.mjs` and optional test-only mail configuration in `scripts/fixtures/`. Checkpoint pictures and machine-readable evidence are linked in [visual QA](visual-qa.md).

The release builder places cache versions before SVG fragments so all scene symbols remain usable from the packaged application. Old screenshots remain in their existing folder for comparison. New entries in `verification/` come from the isolated Chrome fixture.
