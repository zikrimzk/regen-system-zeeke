# Kerjaya. · Phase 02D Design Token Specification

**Product:** Kerjaya. — Malaysian AI Career Platform  
**Version:** Phase 02D Design System  
**Authoritative Reference:** `docs/kerjaya/phase-02d/design-tokens.md`  

---

## 1. Principles & Design Contract

Kerjaya. uses a restrained, purposeful design system designed specifically for a career companion platform:
- **Calm and Trustworthy:** Neutral surfaces and pale grey-green tinted canvas allow candidate documents to stand out without artificial tech glare.
- **Restrained Malaysian Accent:** Forest Green (`#175543`) provides quiet authority and Malaysian resonance without reliance on national stereotypes.
- **Zero Decorative Noise:** No colored borders around ordinary cards, no glowing strips, no tiny uppercase kickers over every heading, and no gratuitous glassmorphism blur effects.
- **Mobile-First PWA:** Native touch targets (minimum 44px), thumb-accessible navigation, sticky save zones with safe-area insets (`env(safe-area-inset-bottom)`), and responsive fluid layout.
- **WCAG 2.2 AA Accessibility:** 4.5:1 contrast for normal text, 3:1 for large text and UI components, visible 3px focus ring with 3px offset, and strict `prefers-reduced-motion` compliance.

---

## 2. Color Palette Tokens

### 2.1 Light Theme (Default)

| Token Name | Value | Purpose / Usage |
| --- | --- | --- |
| `--color-canvas` | `#f5f7f4` | Base page background canvas |
| `--color-panel` | `#ffffff` | Primary card and workspace surface |
| `--color-subtle` | `#ecf1ed` | Secondary background, table headers, inactive tabs |
| `--color-raised` | `#e1e8e1` | Elevated elements, hover states on subtle surfaces |
| `--color-ink` | `#172b25` | Primary text and headings (high contrast, 13.8:1 on panel) |
| `--color-muted` | `#466057` | Secondary text, captions, helper notes (5.2:1 contrast) |
| `--color-line` | `#d3ded9` | Neutral dividers, structural borders |
| `--color-control-line` | `#87998e` | Form input borders, inactive icon button borders |
| `--color-action` | `#175543` | Primary buttons, active indicators, interactive links |
| `--color-action-hover` | `#124434` | Hover and active state for primary action |
| `--color-selected` | `#e2eee7` | Selected row, active navigation item, toggle background |
| `--color-on-action` | `#ffffff` | Text on primary action button |
| `--color-focus` | `#176952` | Focus ring outline for keyboard accessibility |
| `--color-scrim` | `rgba(19, 41, 30, 0.7)` | Modal and dialog backdrop scrim |

### 2.2 Dark Theme (`[data-theme="dark"]`, `[data-appearance="dark"]`)

| Token Name | Value | Purpose / Usage |
| --- | --- | --- |
| `--color-canvas` | `#111b16` | Dark base page background canvas |
| `--color-panel` | `#1a2720` | Dark card and surface |
| `--color-subtle` | `#23332a` | Dark secondary background |
| `--color-raised` | `#2c4035` | Dark elevated card, hover state |
| `--color-ink` | `#eaf2ec` | Primary text on dark surfaces |
| `--color-muted` | `#b4c8bb` | Secondary text on dark surfaces |
| `--color-line` | `#394e42` | Dark structural borders and rules |
| `--color-control-line` | `#839b8b` | Dark form input borders |
| `--color-action` | `#8fd1ae` | Light jade green action button on dark backgrounds |
| `--color-action-hover` | `#a9e1c1` | Hover state for dark action button |
| `--color-selected` | `#263f32` | Selected row or tab in dark mode |
| `--color-on-action` | `#10271d` | Dark ink text on light action button |
| `--color-focus` | `#a3dfbb` | Accessible focus ring in dark mode |
| `--color-scrim` | `rgba(6, 14, 10, 0.85)` | Modal backdrop scrim in dark mode |

### 2.3 Semantic State Tokens

| State | Text / Icon | Surface / Background | Border | Usage |
| --- | --- | --- | --- | --- |
| **Success** | `#087653` | `#e5f3ed` | `#b3d8c7` | Save confirmed, application submitted |
| **Warning** | `#805c13` | `#fff5db` | `#ecd8a5` | Session expiring, draft unsaved |
| **Danger** | `#b83232` | `#fceeed` | `#eac0bc` | Delete document, network save failure |
| **Info / Notice** | `#175543` | `#e2eee7` | `#c0dcd1` | Tip from Mochi, guidance prompt |

---

## 3. Typography Hierarchy

Kerjaya. uses **Inter** throughout, with a disciplined and consistent type scale:

| Level | Size (rem / px) | Line Height | Weight | Letter Spacing | Usage |
| --- | --- | --- | --- | --- | --- |
| **Hero Display** | `clamp(2.25rem, 5vw, 3.5rem)` (36–56px) | 1.08 | 750 | `-0.045em` | Marketing landing page hero title only |
| **Page Title (`h1`)** | `1.75rem` (28px) | 1.2 | 700 | `-0.03em` | Primary view headings (Dashboard, Studio, Cover Letters) |
| **Section Title (`h2`)** | `1.375rem` (22px) | 1.25 | 650 | `-0.02em` | Major content cards, walkthrough steps, template categories |
| **Card Heading (`h3`)** | `1.125rem` (18px) | 1.3 | 600 | `-0.015em` | Form step titles, document item titles, dialog headers |
| **Body (`p`, `input`)** | `1rem` (16px) | 1.5 | 400 | `0` | Standard paragraphs, form input text, resume body text |
| **Controls / Action** | `0.875rem` (14px) | 1.4 | 600 | `0` | Buttons, navigation links, form labels, table cells |
| **Metadata / Badge** | `0.8125rem` (13px) | 1.4 | 500 | `0.01em` | Timestamps, status pills, secondary helper notes |
| **Fine Print** | `0.75rem` (12px) | 1.35 | 400 | `0` | Disclosures, legal attribution, footer copyright |

*Rule:* Never use uppercase kicker text as a decorative element. Headings must be direct and purpose-led.

---

## 4. Spacing Scale (8-Point Grid with 4px Subdivisions)

```css
--space-1: 4px;   /* Fine inline gaps, tight borders */
--space-2: 8px;   /* Icon-to-text gap, button internal padding-y */
--space-3: 12px;  /* Control internal padding-x, tight card padding */
--space-4: 16px;  /* Standard content gap, mobile container gutters */
--space-5: 20px;  /* Card internal padding, form row spacing */
--space-6: 24px;  /* Section header margin, grid gap */
--space-8: 32px;  /* Large component padding, desktop gaps */
--space-10: 40px; /* Section vertical padding on mobile */
--space-12: 48px; /* Section vertical padding on tablet */
--space-16: 64px; /* Major section breaks on desktop */
```

---

## 5. Shape, Radius & Elevation

| Token | Value | Applied To |
| --- | --- | --- |
| `--radius-control` | `8px` | Buttons, input fields, selects, segmented controls |
| `--radius-panel` | `12px` | Content cards, walkthrough containers, gallery cards |
| `--radius-dialog` | `18px` | Modal dialogs, bottom sheets, full preview sheets |
| `--elevation-card` | `0 1px 3px rgba(18, 41, 30, 0.05), 0 4px 12px rgba(18, 41, 30, 0.03)` | Subtle card elevation |
| `--elevation-overlay` | `0 12px 40px rgba(18, 41, 30, 0.14)` | Modals, dropdown menus, popovers |
| `--target-min` | `44px` | Strict minimum height & width for any interactive element |

---

## 6. Responsive Breakpoint Contract

| Breakpoint | Screen Target | Layout Behavior |
| --- | --- | --- |
| **320px** | Ultra-compact phones (SE, older devices) | Single-column, no horizontal overflow, compact padding (12px) |
| **360–390px** | **Primary Mobile Standard** (iPhone 13–15, Galaxy S21–S24) | Native mobile PWA feel; sticky bottom save bar; 44px touch targets; drawer for sections |
| **430px** | Large phones (Pro Max, Plus) | Roomier gutters (16px), optimized single column |
| **768px** | Tablets / portrait iPads | 2-column layout; outline drawer + editor; bottom navigation dock |
| **1024px** | Small laptops / desktop | 3-column Studio (Outline 220px / Form 1fr / Preview 380px); topbar navigation |
| **1440px** | Large desktop | Centered container (`max-width: 1240px`), generous gutters (40px) |

---

## 7. Motion & Accessibility

```css
--duration-quick: 140ms;
--duration-standard: 200ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-quick: 0ms;
    --duration-standard: 0ms;
  }
  html {
    scroll-behavior: auto !important;
  }
}
```
