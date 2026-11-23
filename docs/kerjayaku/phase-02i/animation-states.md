# Animation states

`public/js/mochi-road.js` derives monotonic points from measured articles. Cubic segments use the same vertical ratio as the character’s horizontal interpolation. `public/js/mochi-story.js` reads the stage position in a single animation frame, updates the transform and changes moods at checkpoint boundaries. ResizeObserver recomputes the road when the layout changes.

The welcome sprite leans into its raised hand, curious stages tilt, writing stages nod, and the milestone adds one hop and a short sparkle effect. The final state reveals the blazer and tie. Backward scrolling recomputes the pose from position and removes the costume on departure. Avoiding idle loops keeps the mascot from moving after a reaction settles.

Auth uses `public/js/mochi-auth.js` for attention, typing, waiting and error. It listens for the confirmed success event emitted by `public/js/auth.js` after the existing API succeeds. Validation and server errors use the established form error panel. This animation reads no form values and starts no requests.
