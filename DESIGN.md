---
version: alpha
name: NordicPump
description: "A mobile-first PWA for Nordic fuel-price comparison. Nordic-minimalist, data-dense dashboard canvas built around a deep Nordic blue (#1E40AF), a medium sky blue (#3B82F6), and a single amber accent (#F59E0B) used sparingly for highlights and CTAs. Surfaces stay near-white (#F8FAFC) to maximize chart legibility; text is a dark Nordic blue (#1E3A8A). Body type is set in Fira Sans (humanist, open counters, strong x-height for dense tables) while numeric prices and data use Fira Code (monospaced with ligatures) so columns of figures align perfectly. The system reads as Scandinavian public-sector data tooling: calm, precise, generous whitespace, no ornament."

colors:
  primary: "#1E40AF"
  on-primary: "#FFFFFF"
  primary-hover: "#1D4ED8"
  secondary: "#3B82F6"
  on-secondary: "#FFFFFF"
  accent: "#F59E0B"
  on-accent: "#1E3A8A"
  accent-hover: "#D97706"
  text: "#1E3A8A"
  text-muted: "#475569"
  text-subtle: "#64748B"
  background: "#F8FAFC"
  surface: "#FFFFFF"
  surface-muted: "#F1F5F9"
  hairline: "#E2E8F0"
  hairline-strong: "#CBD5E1"
  chart-low: "#16A34A"
  chart-mid: "#F59E0B"
  chart-high: "#DC2626"
  on-chart-low: "#FFFFFF"
  on-chart-high: "#FFFFFF"

typography:
  display:
    fontFamily: Fira Sans
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
  h1:
    fontFamily: Fira Sans
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  h2:
    fontFamily: Fira Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  h3:
    fontFamily: Fira Sans
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: Fira Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Fira Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: Fira Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: Fira Code
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  "0": "0"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"

components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.5}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "{spacing.5}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.5}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "{spacing.3}"
  badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.full}"
    padding: "{spacing.3}"
---

# NordicPump — Design System

## Identity

NordicPump is a mobile-first PWA comparing fuel prices across Sweden, Denmark,
Finland, and Norway. The visual language is **Scandinavian public-sector data
tooling**: calm, precise, generous whitespace, and zero ornament. Every chromatic
decision exists to make numbers legible.

## Color

| Token | Value | Use |
|-------|-------|-----|
| `primary` | `#1E40AF` | Headers, primary buttons, active states |
| `secondary` | `#3B82F6` | Links, secondary highlights, chart accents |
| `accent` | `#F59E0B` | CTAs, callouts, KPI highlights — use sparingly |
| `background` | `#F8FAFC` | App canvas |
| `surface` | `#FFFFFF` | Cards, inputs, sheets |
| `text` | `#1E3A8A` | Body and headings |

**Chart semantics** (price bands, EUR): `chart-low #16A34A` (<1 EUR),
`chart-mid #F59E0B` (1–3 EUR), `chart-high #DC2626` (>3 EUR). Amber is shared
between the accent and the mid-price band intentionally — it ties the brand to
the data. Every chart MUST also ship a pattern/texture overlay so the palette is
legible for colorblind users (PLAN.md a11y requirement).

The amber accent `#F59E0B` does NOT pass WCAG AA with white text, so
`on-accent` is `#1E3A8A` (dark Nordic blue) — dark-on-amber. Never put white
text on the accent.

## Typography

- **Fira Sans** — body, headings, UI. Humanist, open counters, strong x-height;
  reads cleanly in dense tables at 14–16px.
- **Fira Code** — prices, tabular data, currency. Monospaced with ligatures so
  columns of figures align perfectly and `€`, `kr`, decimals never jitter.

Load both with `font-display: swap` to avoid FOIT. Numeric prices always use
`font-variant-numeric: tabular-nums`.

## Shape & Spacing

Rounded scale: `sm 4 · md 8 · lg 12 · xl 16 · full 9999`.
Spacing scale: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48` (px). Mobile touch
targets are a minimum of 44×44px (WCAG 2.5.5).

## Components

- **button** — primary blue, white text, `rounded.md`. `button-accent` for the
  rare high-contrast CTA (amber + dark text).
- **card** — white surface, 1px hairline border, `rounded.lg`, 20px padding.
  The atomic unit of the dashboard grid.
- **input** — white field, slate border, `rounded.md`.
- **badge** — muted chip for currency / frequency tags.

## Rules

- Never hardcode hex in components — always reference tokens (Tailwind theme).
- No emojis as icons — use Lucide/Heroicons SVG at 24×24.
- `cursor-pointer` on every clickable element; visible focus ring for keyboard
  navigation.
- Respect `prefers-reduced-motion: reduce` (chart draw-in / price counters).
- Responsive checkpoints: 375 · 768 · 1024 · 1440px. No horizontal scroll.
- All images need `alt`; all form inputs need labels.
