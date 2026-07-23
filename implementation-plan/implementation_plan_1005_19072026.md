# Zeeke Resume Gen — Implementation Plan

## Overview

A mobile-first, browser-based resume builder that guides users step-by-step through filling in their information, then generates a professionally formatted, downloadable resume matching the provided CV template. No laptop required — designed for smartphone use first.

---

## Template Analysis (from `Curriculum Vitae Fresh Graduate.docx`)

The template follows this exact section order:

| # | Section | Fields |
|---|---------|--------|
| 1 | **Personal Info** | Photo, Full Name, Job Title/Field, Phone, Email, LinkedIn, Address |
| 2 | **Summary** | Paragraph of career summary |
| 3 | **Education** | Degree, Institution, Date Range, CGPA (repeatable) |
| 4 | **Work Experience** | Job Title, Company, Date Range, Bullet points (repeatable) |
| 5 | **Academic Projects** | Project Title, Description, Bullet points (repeatable) |
| 6 | **Extracurricular Activities** | Club/Org Name, Role, Bullet points (repeatable) |
| 7 | **Skills** | Interpersonal, Software, Technical, Language (key-value pairs) |
| 8 | **Achievement** | List of achievements |
| 9 | **License & Certification** | List of certifications |
| 10 | **References** | Name, Position, Email, Phone (repeatable) |

---

## Tech Stack

- **Backend**: Node.js + Express.js (MVC architecture)
- **Frontend**: HTML + Vanilla CSS + Vanilla JS (no framework needed)
- **PDF Generation**: `puppeteer` (headless Chrome — renders HTML to PDF perfectly)
- **Photo Upload**: `multer` (multipart form uploads)
- **Session Storage**: `express-session` + in-memory store (simple, no DB needed for v1)

> Why Node.js/Express? Zero setup for the user, runs easily locally, and Puppeteer gives pixel-perfect PDF output from HTML — matching the template styling exactly.

---

## Project Structure

```
resume-builder/
├── template/                          # Original DOCX template (existing)
├── server.js                          # Entry point
├── package.json
├── .env
│
├── app/
│   ├── config/
│   │   └── session.js                 # Session config
│   │
│   ├── controllers/
│   │   ├── resumeController.js        # Save/load resume data from session
│   │   └── pdfController.js           # Trigger PDF generation
│   │
│   ├── models/
│   │   └── resumeModel.js             # Data schema / validation logic
│   │
│   ├── routes/
│   │   ├── index.js                   # Route aggregator
│   │   ├── resumeRoutes.js            # /api/resume/* routes
│   │   └── pdfRoutes.js               # /api/pdf/* routes
│   │
│   ├── services/
│   │   └── pdfService.js              # Puppeteer PDF generation logic
│   │
│   ├── middleware/
│   │   └── upload.js                  # Multer config for photo upload
│   │
│   └── views/
│       └── resume-template.html       # Puppeteer resume HTML template
│
├── public/
│   ├── index.html                     # Main SPA shell
│   │
│   ├── css/
│   │   ├── main.css                   # Global styles, design tokens
│   │   ├── stepper.css                # Step navigation styles
│   │   ├── form.css                   # Form input styles
│   │   └── preview.css                # Resume preview panel styles
│   │
│   ├── js/
│   │   ├── app.js                     # App bootstrap & state manager
│   │   ├── stepper.js                 # Multi-step navigation logic
│   │   ├── api.js                     # Fetch wrapper for backend API calls
│   │   ├── preview.js                 # Live resume preview renderer
│   │   └── sections/
│   │       ├── personal.js            # Personal info section logic
│   │       ├── summary.js             # Summary section logic
│   │       ├── education.js           # Education section logic (repeatable)
│   │       ├── experience.js          # Work experience logic (repeatable)
│   │       ├── projects.js            # Academic projects logic (repeatable)
│   │       ├── extracurricular.js     # Activities logic (repeatable)
│   │       ├── skills.js              # Skills section logic
│   │       ├── achievements.js        # Achievements logic
│   │       ├── certifications.js      # License & Certifications logic
│   │       └── references.js          # References logic (repeatable)
│   │
│   └── assets/
│       └── logo.svg                   # Zeeke brand logo
│
└── uploads/                           # Temp photo uploads (gitignored)
```

---

## UI/UX Design

### Step-by-Step Wizard (Mobile-First)

- **Progress stepper** at the top — numbered dots showing current step (1 of 10)
- Each section = one screen/step, scrollable
- **Skip button** available on every step (top-right corner)
- **Back / Next** navigation at the bottom
- **Live preview panel** — on desktop, shows resume preview beside the form; on mobile, a floating "Preview" button opens a modal

### Design Aesthetic

- **Color palette**: Deep navy `#0F172A` background, vibrant teal accent `#14B8A6`, warm white `#F8FAFC` cards
- **Typography**: `Outfit` (headings) + `Inter` (body) from Google Fonts
- **Glassmorphism** cards for form sections
- **Micro-animations**: Smooth step transitions, input focus glow, button ripple effects
- **Photo upload**: Drag-and-drop zone with crop preview, with aspect-ratio guidance (portrait 3:4)

### Resume Output (PDF)

Matches the DOCX template exactly:
- Times New Roman font
- Name in large bold at top-right of photo
- Horizontal rule separators between sections
- Section headers in caps (SUMMARY, EDUCATION, etc.)
- Two-column references at the bottom

---

## Key Features

1. **Step wizard** — 10 steps, each skippable
2. **Repeatable entries** — Add multiple education, experience, project, activity, reference records
3. **Photo upload** — Accepts JPG/PNG, stores in session, embedded in PDF
4. **Live preview** — Real-time resume preview updates as user types
5. **PDF download** — Puppeteer renders perfect HTML→PDF matching template
6. **Session persistence** — Data survives page refreshes during a session
7. **Mobile-first** — Works well on small screens, touch-friendly

---

## Open Questions

> [!IMPORTANT]
> **Q1: Academic Projects section** — The template has "Academic Projects" as a section. Should this be included as a separate step (making it 10 steps), or combined with Work Experience?

> [!IMPORTANT]
> **Q2: PDF Download only?** — Should the user only be able to download a PDF, or also save/share a link? For v1 I'll implement PDF download only.

> [!NOTE]
> **Q3: Language** — The template sample is in English. Should the UI support other languages (e.g., Bahasa Melayu) later? For v1, English UI only.

---

## Proposed Steps (Wizard Flow)

| Step | Section | Skippable |
|------|---------|-----------|
| 1 | Personal Information (name, photo, contact) | No (required) |
| 2 | Summary | Yes |
| 3 | Education | Yes |
| 4 | Work Experience | Yes |
| 5 | Academic Projects | Yes |
| 6 | Extracurricular Activities | Yes |
| 7 | Skills | Yes |
| 8 | Achievements | Yes |
| 9 | Licenses & Certifications | Yes |
| 10 | References | Yes |
| — | Preview & Download | — |

---

## Verification Plan

### Automated
- `npm start` — server starts without errors
- POST to `/api/resume/save` returns 200
- GET `/api/pdf/generate` returns a valid PDF binary

### Manual
- Fill all steps on mobile viewport (375px) — layout must not break
- Upload photo — appears in preview and PDF
- Skip all optional steps — PDF still generates cleanly
- Download PDF — visually matches the DOCX template structure

