# Illustration audit

The [Phase 02I desktop capture](../phase-02i/verification/hero/light-desktop.png) is the before reference. The flat bases, repeated silhouette shapes and detached pale road are visible in that capture and traceable to the shared `land` symbol in `public/img/kerjayaku-world.svg`.

| Source | Assessment |
| --- | --- |
| `public/img/kerjayaku-world.svg` | Replace the hero, Resume Studio and toll renderings at the pilot gate. The remaining symbols still serve their current scenes, including the account illustrations, until the art direction is reviewed. |
| `public/img/mochi-coach.webp` | Retain as the canonical character. Its antennae, flower, scarf, eyes, limbs and green palette provide the continuity reference. The 228 px source constrains close-up detail. |
| `public/js/mochi-road.js`, `public/js/mochi-story.js` | Reuse the verified scroll and reverse mechanism. Add measured joins between the three plates and the path and a continuous scale transition. |
| `public/js/vendor/` | GSAP, ScrollTrigger and MotionPath files are present. The current landing runs its native controller and does not load these copies. |

The built-in image generator and installed Chrome were available. Figma connector capabilities were discoverable. There is no supplied Figma design or verified editable Figma source for this artwork. The workstation check found no Blender or Rive command or relevant source file in the inspected project. Pillow is used to resize and encode delivery files from the generated masters.
