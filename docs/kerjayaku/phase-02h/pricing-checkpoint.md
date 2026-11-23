# Kerjayaku Phase 02H — Pricing Checkpoint & Transparent Value Architecture
**Document ID:** `docs/kerjayaku/phase-02h/pricing-checkpoint.md`  
**Product:** Kerjayaku.  
**Phase:** 02H (Mochi's Animated Career Journey)  
**Status:** Completed & Verified  

---

## 1. Journey Integration & Narrative Role

In traditional SaaS landing pages, pricing tables are often dumped awkwardly between feature lists or pushed to a sterile separate page. In Kerjayaku Phase 02H, pricing is seamlessly woven into the scrollytelling narrative as **Scene 06: Gerbang Nilai Telus (Transparent Value Checkpoint)**.

```
[ Scene 05: Celebration ]  ──▶  [ Scene 06: Checkpoint ]  ──▶  [ Scene 07: Cover Letter ]
  • First resume ready            • Mochi stands proud            • Advanced applications
  • Confetti detonates            • Glowing crown arch            • Envelope sealed
                                  • "Lihat Pelan & Token"
                                             │
                                             ▼
                         [ Dedicated Pricing Drawer Modal ]
                           • 3-Tier transparent packages
                           • Malaysian Ringgit (RM)
                           • FPX / DuitNow QR / Cards
```

When Mochi reaches progress interval $p \in [0.55, 0.64]$, he stands proud (`proud` emotion state: hands on hips, confident upward chin tilt) before a glowing checkpoint arch. The narrative emphasizes transparency: *no hidden monthly traps, no predatory auto-renewals, and free core tools for students and interns.*

---

## 2. Dedicated Pricing Drawer Architecture (`#journey-pricing-drawer`)

Clicking the checkpoint button `[ Lihat Pelan & Token (Dari RM0) ]` opens an accessible, lightweight drawer dialog without redirecting away from the story.

### 2.1 Modal Specifications
- **HTML Container:** `<aside id="journey-pricing-drawer" role="dialog" aria-modal="true" aria-labelledby="journey-pricing-title">`
- **Backdrop:** 12px backdrop blur with 60% neutral black scrim.
- **Dismiss Mechanics:**
  - Dedicated accessible close button (`aria-label="Tutup pelan harga"` with `<span aria-hidden="true">&times;</span>`).
  - Native `Escape` key capture.
  - Backdrop tap/click dismissal.
  - Focus trap returning focus to the checkpoint button upon closure.

---

## 3. Malaysian Transparent Pricing Tiers

All pricing is denominated in Ringgit Malaysia (RM) and settles directly through Bank Negara Malaysia-compliant rails via HitPay (FPX, DuitNow QR, TNG eWallet, GrabPay, Visa/Mastercard):

| Tier Name | Price (RM) | Target Audience | Included Entitlements & Features |
| :--- | :--- | :--- | :--- |
| **Pelan Asas** *(Percuma)* | **RM 0** | Pelajar, intern, graduan baru bersedia awal | • 1 Profil Kerjaya Utama<br>• 1 Resume ATS Standard<br>• Muat turun PDF tanpa had (Asas)<br>• Pratonton Mochi percuma |
| **Pakej Kerjaya** *(Paling Popular)* | **RM 19** *(Pas Sekali Bayar)* | Graduan aktif & calon awal kerjaya | • **50 Token AI** Mochi<br>• Resume ATS tanpa had<br>• Penjana Surat Iringan tersuai<br>• Eksport PDF berkualiti tinggi<br>• Analisis Padanan Deskripsi Kerja (JD) |
| **Pakej Profesional** | **RM 49** *(Pas Seumur Hidup)* | Profesional berpengalaman & penukar kerjaya | • **200 Token AI** Mochi<br>• Akses ke semua 16+ template premium<br>• Penyesuaian profil lanjutan<br>• Simulasi soalan temu duga bersama Mochi<br>• Sokongan semakan resume keutamaan |

> **Malaysian Value Commitment:** No candidate is ever surprised by recurring credit card deductions. Token packs never expire, and core editing capabilities remain accessible even on the free tier.

---

## 4. Responsive Presentation (Desktop Grid vs. Mobile Carousel)

### 4.1 Desktop Viewport ($> 900\text{px}$)
The drawer displays a balanced 3-column comparative grid (`display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;`).
- The center card (**Pakej Kerjaya**) features an emerald accent border, an elevated elevation shadow, and an official badge: `Pilihan Ramai`.
- Action buttons are full-width, high-contrast, and keyboard accessible.

### 4.2 Mobile Viewport ($< 768\text{px}$)
On handheld screens, vertical scrolling through 3 dense cards can cause interaction fatigue. The mobile drawer employs a horizontal snap carousel:
- `display: flex; overflow-x: auto; scroll-snap-type: x mandatory;`
- Each card occupies `85vw` with centered snapping (`scroll-snap-align: center;`).
- Touch momentum provides silky 60fps sliding between tiers, with a visual indicator dot strip showing the active card.

---

## 5. Visual Evidence References

- **Scene 06 Checkpoint on Desktop:** [journey-s6-pricing-checkpoint-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/journey-s6-pricing-checkpoint-desktop.png)
- **Pricing Drawer Open (Desktop 3-Column Grid):** [pricing-drawer-open-desktop.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/pricing-drawer-open-desktop.png)
- **Pricing Drawer Open (Mobile Snap Carousel, 390px):** [pricing-drawer-open-mobile.png](file:///c:/Users/User/Desktop/Home/File/Web%20Development%20Project/resume-builder/docs/kerjayaku/phase-02h/screenshots/pricing-drawer-open-mobile.png)
