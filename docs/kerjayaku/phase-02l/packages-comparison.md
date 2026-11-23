# Packages comparison

The catalogue preserves `/packages` → `/pricing`, `/site/pricing.json` and the protected `/store` destination. The public JavaScript uses the existing `TokenStore` response. The signed-in checkout, claim and accounting code remain the enforcement layer. The Store opens its existing catalogue after sign-in. Users confirm the desired package there before a checkout or claim.

The public page aligns names, prices, actions, benefits and terms on desktop. It places one principal card and a neighbouring cue on mobile, with swipe, arrows, indexed controls and keyboard navigation. The comparison uses a native expandable table with actual entitlements grouped under documents, writing, Mochi, career tools and allowances. Included features appear only when supplied by the package. Standard cards highlight up to four benefits and the comparison provides the full set.

Synthetic fixtures exercise the advertised catalogue. These values are QA data.

| Fixture plan | Expected result |
|---|---|
| A fresh start | RM12.00 one-time, 30 tokens and three PDF downloads for 30 days |
| Room to grow | RM29.00 one-time during the actual fixture promotion, RM39.00 original, 90 tokens, five Assist Me uses, two Mochi uses and one Basic template unlock for 60 days |
| Your next chapter | Free during the claim period, one claim per verified account and current claim capacity |
| Expired practice offer | No active action and an expiry message |
| Hidden QA plan | Excluded from displayed catalogue |

[Desktop price layout](screenshots/packages-desktop-en-light.png) · [Mobile slide 1](screenshots/package-slide-1.png) · [Mobile slide 2](screenshots/package-slide-2.png) · [Mobile slide 3](screenshots/package-slide-3.png).
