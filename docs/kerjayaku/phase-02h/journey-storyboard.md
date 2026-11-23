# Kerjayaku Phase 02H — The Mochi Career Journey Storyboard

**Phase:** 02H (Mochi's Animated Career Journey & Interactive Scrollytelling)  
**Date:** November 2026  
**Auditor:** Kerjayaku Core Experience Team  
**Scope:** Landing Page Scrollytelling Architecture, 11 Scene Waypoints, 4 Chapters

---

## 1. Concept & Transformation

Phase 02H completely departs from the traditional feature-card landing page. In its place is an original, continuous scrollytelling experience: **a winding S-curved career road along which Mochi physically travels as the visitor scrolls**.

The visitor's scroll motion directly controls the narrative progress:
- **Scrolling downward:** Moves Mochi forward along the path, reveals upcoming career milestones, and advances character emotions.
- **Scrolling upward:** Reverses the story seamlessly, collapsing completed stages and returning Mochi to prior poses.
- **Compact Chapter Organization:** Rather than 11 detached full-screen blocks, the journey is organized into 4 connected visual chapters with a floating jump-to-chapter bar.

---

## 2. Chapter Breakdown & Scene Sequence

```
[Start] (p = 0.00)
   |
=== CHAPTER 1: GETTING STARTED ===
   |-- Scene 00: Welcome to Kerjayaku (Hero)
   |-- Scene 01: Enter Kerjayaku (Login/Register Gateway)
   |-- Scene 02: Choose Where to Start (Starter Options)
   |-- Scene 03: Tell Us Your Goals (Personalisation Concept)
   |
=== CHAPTER 2: PREPARING ===
   |-- Scene 04: Browse Resume Templates (Curated 16 ATS Designs)
   |-- Scene 05: Resume Creation & Celebration ("Yay! Resume dah siap!" + Confetti)
   |
=== CHAPTER 3: APPLYING ===
   |-- Scene 06: Premium Tools & Pricing Checkpoint (Crown + Dedicated Drawer)
   |-- Scene 07: Cover Letter Preparation (Unfolding Envelope)
   |-- Scene 08: Job Description Matching (Requirement Alignment)
   |-- Scene 09: Applications & Job Discovery (Pipeline Tracking)
   |
=== CHAPTER 4: MOVING FORWARD ===
   |-- Scene 10: Interview & Next Steps (STAR Method Drills + Final Milestone)
   |
[Finish & FAQ] (p = 1.00)
```

---

## 3. Scene-by-Scene Storyboard Specifications

### Scene 00 — Welcome to Kerjayaku (Hero Start)
- **Progress:** $p \in [0.00, 0.08]$
- **Visuals:** Warm canvas, brand wordmark, starting point of the curved road, category badge (*"Platform Kerjaya & AI Malaysia"*), primary CTA button, and animated scroll indicator prompt.
- **Mochi Pose & Emotion:** Natural idle, blinking, friendly wave to the visitor (`wave`).
- **Dialogue (BM):** *"Hai! Saya Mochi. Jom tengok apa yang kita boleh buat di Kerjayaku."*
- **Dialogue (EN):** *"Hey! I’m Mochi. Come see what Kerjayaku can help you with."*
- **Action:** Primary button *"Mula sekarang"* / *"Get started"* navigating directly to `/register`.

### Scene 01 — Enter Kerjayaku (Gateway)
- **Progress:** $p \in [0.08, 0.18]$
- **Visuals:** Stylised archway waypoint on the right curve of the road.
- **Mochi Pose & Emotion:** Hops forward, tilts head attentively, points toward account actions (`curious`).
- **Dialogue (BM):** *"Langkah pertama, masuk dulu ke Kerjayaku!"*
- **Dialogue (EN):** *"First, let’s get you into Kerjayaku!"*
- **Action:** Real secondary *"Log masuk"* and primary *"Daftar akaun percuma"* buttons.

### Scene 02 — Choose Where to Start (Starter Concept)
- **Progress:** $p \in [0.18, 0.28]$
- **Visuals:** Centered waypoint card displaying 3 starter choices: *Sediakan dokumen*, *Teroka peluang kerja*, and *Rancang langkah kerjaya*. Labeled with an *"Akan datang / Upcoming concept"* pill badge.
- **Mochi Pose & Emotion:** Pauses at the junction, looks thoughtfully between the options (`curious`).
- **Dialogue (BM):** *"Nak mula dari mana dulu?"*
- **Dialogue (EN):** *"What would you like to start with?"*

### Scene 03 — Tell Us Your Goals (Onboarding Question)
- **Progress:** $p \in [0.28, 0.38]$
- **Visuals:** Onboarding question card positioned along the left curve (*"Bidang apa yang anda sedang terokai?"*) with sample Malaysian industry tags (Operasi, Pemasaran, IT, Kewangan, Perkhidmatan Pelanggan).
- **Mochi Pose & Emotion:** Attentive listening pose (`sneak`), leaning in to absorb the candidate's ambitions.
- **Dialogue (BM):** *"Cerita sikit tentang diri anda."*
- **Dialogue (EN):** *"Tell me a little about your goals."*

### Scene 04 — Browse Resume Templates
- **Progress:** $p \in [0.38, 0.48]$
- **Visuals:** Curated layout cards beside the road showcasing 4 actual Malaysian-tailored templates (Classic, Modern, Minimal, Signature) with *Asas* and *Eksklusif Premium* badges.
- **Mochi Pose & Emotion:** Pulls out document cards cheerfully (`bright`), reacting to layout previews.
- **Dialogue (BM):** *"Pilih gaya resume yang sesuai dengan anda."*
- **Dialogue (EN):** *"Pick a resume style that feels right for you."*

### Scene 05 — Resume Creation & Celebration (The Emotional Apex!)
- **Progress:** $p \in [0.48, 0.58]$
- **Visuals:** Centered milestone card. A structured document forms cleanly with a completion check badge. Supporting Assist Me and Refine Me feature pills highlight guided phrasing.
- **Mochi Pose & Emotion:** Joyful celebration! Mochi's eyes widen, hands raise, and it performs a joyful jump (`dance` / `hop`). A burst of 36 colorful confetti particles disperses outward.
- **Dialogue (BM):** **"Yay! Resume dah siap!"**
- **Dialogue (EN):** **"Yay! Resume done!"**
- **Reversible Motion:** Scrolling back up smoothly collapses the confetti particles and returns Mochi from celebratory jumping to drafting posture.

### Scene 06 — Premium Tools & Pricing Checkpoint
- **Progress:** $p \in [0.58, 0.68]$
- **Visuals:** Crown waypoint marker and pricing signpost on the left curve. Transparent one-time payment disclosure in Malaysian Ringgit (RM) via HitPay.
- **Mochi Pose & Emotion:** Cheerful presenting pose (`proud`), gesturing toward the crown.
- **Dialogue (BM):** *"Nak lebih banyak bantuan? Jom tengok pelan yang ada."*
- **Dialogue (EN):** *"Want more tools? Let’s explore the available plans."*
- **Action:** Clicking *"Lihat pelan harga / Explore plans"* smoothly opens `#journey-pricing-drawer` containing the mobile swipeable carousel and desktop 3-col package grid.

### Scene 07 — Cover Letter Preparation
- **Progress:** $p \in [0.68, 0.78]$
- **Visuals:** Letter & envelope illustration on the right curve showing matching design typography. Premium crown badge where applicable.
- **Mochi Pose & Emotion:** Unfolds the letter and presents it proudly (`curious`).
- **Dialogue (BM):** *"Resume dah ada. Sekarang, jom sediakan surat iringan."*
- **Dialogue (EN):** *"Resume ready? Now let’s work on your cover letter."*
- **Reversible Motion:** Scrolling upward refolds the letter into the envelope.

### Scene 08 — Job Description Matching
- **Progress:** $p \in [0.78, 0.88]$
- **Visuals:** Dual cards comparing role vacancy requirements against candidate experience. Labeled *Dalam pembangunan*.
- **Mochi Pose & Emotion:** Analyzing and evaluating requirements thoughtfully (`sneak`).
- **Dialogue (BM):** *"Jumpa jawatan menarik? Jom semak keperluannya."*
- **Dialogue (EN):** *"Found an interesting role? Let’s check the requirements."*

### Scene 09 — Applications & Job Discovery
- **Progress:** $p \in [0.88, 0.96]$
- **Visuals:** Pipeline status board showing 4 stages: Dihantar, Disemak, Temu Duga, and Tawaran.
- **Mochi Pose & Emotion:** Encouraging and positive pose (`bright`), organizing cards.
- **Dialogue (BM):** *"Semua permohonan, lebih mudah nak pantau."*
- **Dialogue (EN):** *"Keep your applications organised in one place."*

### Scene 10 — Interview & Next Steps (Final Milestone)
- **Progress:** $p \in [0.96, 1.00]$
- **Visuals:** STAR method interview conversation coaching card, final path convergence marker, and prominent registration CTA.
- **Mochi Pose & Emotion:** Confident, supportive wave (`wave`), smiling at the candidate.
- **Dialogue (BM):** *"Langkah seterusnya? Kita hadap sama-sama."*
- **Dialogue (EN):** *"Ready for the next step? Let’s do it together."*
- **Action:** Primary button *"Cipta akaun percuma &rarr;"* navigating to `/register`.
