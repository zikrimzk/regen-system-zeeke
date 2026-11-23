# Landing Packages preview

The landing and dedicated Packages page share the commercial renderer in `public/js/landing-pricing.js`. The landing requests `/site/pricing.json` as the section approaches the viewport. It shows up to three main published plans, preferring the catalogue's main placements and using other published rows if needed. The dedicated route retains complete catalogue navigation and entitlement comparison. Publication, currency, pricing, promotions, validity, feature limits, claim capacity and disabled states come from existing backend data.

On mobile the rail uses browser scroll snapping and touch gestures. Each control has a descriptive label and the current position is announced when the viewport overflows. The carousel has no automatic advancement. Refresh attempts keep the selected plan when that plan is still present. The Compare all packages link opens `/pricing`. CTA links enter the existing Store and sign-in flow. Optional offline cache does not contain live price data.

The captured prices belong to disposable fixture records. The browser verifies paid and free offers, expiry, no movement without input, network retry and the Store destination.
