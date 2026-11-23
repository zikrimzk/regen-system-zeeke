# Kerjayaku Phase 02H — Mochi Emotion States & Character Engine
**Document ID:** `docs/kerjayaku/phase-02h/mochi-emotion-states.md`  
**Product:** Kerjayaku.  
**Phase:** 02H (Mochi's Animated Career Journey)  
**Status:** Completed & Verified  

---

## 1. Character Engine Architecture

Mochi serves as Kerjayaku's flagship brand companion, guiding candidates from their first exploration through job offer celebration. The character engine is built upon `public/js/mochi-avatar.js`, a 100% client-side WebGL and 2D canvas procedural renderer requiring **zero backend AI tokens or third-party cloud compute**.

```
                           [ State Trigger ]
            ┌──────────────────────┴──────────────────────┐
            ▼                                             ▼
[ Scrollytelling Timeline ]                      [ Auth Form Events ]
  • Scene progress waypoint                        • onFocus / onBlur
  • Road curvature angle                           • onInput (keystrokes)
  • Scroll velocity                                • onSubmit / validation error
            │                                             │
            └──────────────────────┬──────────────────────┘
                                   ▼
                 [ MochiAvatar.setMood(moodName) ]
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
 [ Procedural Bones ]       [ Eye Tracking ]          [ Particle Effects ]
  • Head tilt & bounce       • Iris gaze vector        • Confetti burst
  • Ear perking / droop      • Pupil dilation          • Sparkles / dust
  • Squash & stretch         • Blink cycle             • Footstep rings
```

---

## 2. Complete Emotion State Dictionary

| Emotion Key | Physical Animation Rig | Psychological Intent | Applied Contexts |
| :--- | :--- | :--- | :--- |
| `wave` | Right arm oscillates $45^\circ$, body bobs gently, wide joyful eyes. | Welcoming, friendly, approachable introduction. | Scene 00 (Hero Welcome), Auth initial mount. |
| `curious` | Head tilts $18^\circ$ toward focus target, ears prick forward, eyes widen. | Attentive observation, assisting candidate with data. | Scene 01 (Entrance), Scene 07 (Cover Letter), Form field focus. |
| `sneak` | Crouches low with playful sneaking cadence, eyes dart side-to-side. | Careful curation of credentials, ensuring privacy. | Scene 02 (Master Profile setup). |
| `bright` | Ears perk upright, sparkling glints in eyes, energetic upright stance. | Inspiring clarity, identifying dream career targets. | Scene 03 (Career Goals), Scene 08 (Job Matching). |
| `hop` | Squash-and-stretch vertical leap ($28\text{px}$) with soft rebound landing. | Excitement of creation, discovering templates. | Scene 04 (Resume Studio), Scene 09 (Application Tracker), Form submission. |
| `dance` | Alternating hip sway, ear flipping rhythm, gleeful eye squints. | Peak jubilation, career milestone achievement. | Scene 05 (First Resume!), Scene 10 (Interview Success!). |
| `proud` | Chest puffs forward, hands rest on hips, confident upward chin tilt. | Professional self-assurance, transparent value. | Scene 06 (Pricing Checkpoint). |
| `startle` | Sudden $12\text{px}$ backwards recoil, wide oval eyes, flattened ears. | Gentle alarm, alerting user to missing inputs. | Auth form validation failure / network glitch. |
| `sad` | Soft downward gaze, drooped ears, pout mouth, gentle slow breathing. | Empathetic pout, encouraging candidate to retry. | Auth form error state (transitions from `startle`). |
| `laugh` | Rapid subtle body vibration ($2\text{px}$ jitter), crescent smiling eyes. | Delightful tactile feedback, tickled by keystrokes. | Active text typing in auth inputs, easter egg clicks. |

---

## 3. Scrollytelling Scene Mapping

Each of the 11 scenes in `landing.html` triggers a precise emotional expression synchronized with Mochi's localized speech bubble:

```
Scene 00: wave     -> "Hai! Saya Mochi. Jom bina kerjaya impian anda!"
Scene 01: curious  -> "Langkah pertama: ceritakan latar belakang anda."
Scene 02: sneak    -> "Kumpul kemahiran & sijil — Mochi jaga privasi anda!"
Scene 03: bright   -> "Tetapkan matlamat kerjaya yang jelas & terarah."
Scene 04: hop      -> "Pilih template resume ATS yang kemas & profesional!"
Scene 05: dance    -> "Tahniah! Resume pertama anda telah siap dijana!" [Confetti]
Scene 06: proud    -> "Nilai telus tanpa langganan tersembunyi — dari RM0."
Scene 07: curious  -> "Surat iringan padu untuk menarik perhatian majikan."
Scene 08: bright   -> "Padankan profil dengan peluang kerja berkualiti di Malaysia."
Scene 09: hop      -> "Pantau setiap permohonan kerja dalam satu paparan kemas."
Scene 10: dance    -> "Sedia untuk temu duga! Mochi doakan kejayaan anda!"
```

---

## 4. Interactive Authentication Companions (`mochi-auth.js`)

On both `login.html` and `register.html`, Mochi is mounted adjacent to the form fields to reduce cognitive anxiety and provide delightful micro-interactions:

### 4.1 Welcome Greeting
Upon page load, Mochi performs the `wave` animation with a personalized bilingual speech bubble:
- **Login:** *"Jom masuk! Mochi dah siapkan meja kerja anda."*
- **Sign Up:** *"Selamat datang! Jom mulakan perjalanan kerjaya anda hari ini."*

### 4.2 Interactive Field Focus
When the candidate tabs or clicks into `#email`, `#password`, or `#name`:
- Mochi switches to `curious`.
- Eyes dynamically track toward the input field's screen coordinates.
- Bubble hints: *"Mochi perhatikan... pastikan tiada typo!"*

### 4.3 Tickled Typing Reaction
As the user types, each keystroke fires a debounced vibration callback triggering `laugh`:
- Mochi squints happily and jiggles, simulating being tickled by the keystrokes.
- A 300ms inactivity timeout returns Mochi gracefully to `curious`.

### 4.4 Form Error Pout
When an invalid submission occurs (e.g. empty password or mismatched credentials):
1. Form triggers CSS shake animation.
2. Mochi immediately fires `startle`, recoiling backwards with wide eyes.
3. Over 400ms, Mochi softens into `sad` with drooped ears and a sympathetic pout.
4. Bubble announces: *"Adoi! Sila semak maklumat yang bertanda merah."*

### 4.5 Submission Success
When the form is valid and submitting:
- Mochi performs `hop` followed by `dance`.
- Bubble updates: *"Memproses... sedia untuk melangkah maju!"*

---

## 5. Visual Evidence References

- **Mochi Welcoming at Scene 00:** [journey-s0-hero-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s0-hero-desktop.png)
- **Mochi Hopping at Scene 04:** [journey-s4-templates-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s4-templates-desktop.png)
- **Mochi Dancing with Confetti at Scene 05:** [journey-s5-celebration-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s5-celebration-desktop.png)
- **Mochi Standing Proud at Scene 06:** [journey-s6-pricing-checkpoint-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s6-pricing-checkpoint-desktop.png)
- **Login Companion (Default State):** [login-desktop-default.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-desktop-default.png)
- **Login Companion (Typing Tickle Reaction):** [login-desktop-typing.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-desktop-typing.png)
- **Login Companion (Validation Error Pout):** [login-desktop-error-pout.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/login-desktop-error-pout.png)
- **Register Companion (Typing Reaction):** [register-desktop-typing.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/register-desktop-typing.png)
- **Register Mobile Card Presentation:** [register-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/register-mobile.png)
