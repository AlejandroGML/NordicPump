# kpi-card Specification

## Purpose

Reusable KPI (Key Performance Indicator) card component. Displays a title, large value (monospaced), optional subtitle, and optional trend indicator. Follows Nordic-minimalist design with DESIGN.md card tokens (white surface, hairline border, `rounded.lg`, 20px padding).

## Requirements

### Requirement: KPI card rendering

The component MUST render a title, value, subtitle, and optional trend based on `@Input()` bindings.

#### Scenario: Full KPI card with trend

- **GIVEN** inputs: `title="Euro 95"`, `value="14,50 kr"`, `subtitle="per liter"`, `trend="down"`
- **WHEN** the component renders
- **THEN** "Euro 95" is displayed as the title in `text-subtle` (#64748B) at `body-sm` size
- **AND** "14,50 kr" is displayed in `Fira Code` mono font at `display` size
- **AND** "per liter" is displayed as subtitle
- **AND** a green down arrow (↓) is shown for trend

#### Scenario: Minimal KPI card — value only

- **GIVEN** inputs: `title="Current Price"`, `value="14,50 kr"`, no subtitle, no trend
- **WHEN** the component renders
- **THEN** the title and value are displayed
- **AND** no empty subtitle or trend space SHALL be rendered (no layout shift)

#### Scenario: Trend values

- **GIVEN** trend input values: `"up"`, `"down"`, `"neutral"`, or `undefined`
- **WHEN** the component renders each
- **THEN** `"up"` renders red ↑ arrow, `"down"` renders green ↓ arrow, `"neutral"` renders gray → dash
- **AND** `undefined` or `null` renders no trend indicator

### Requirement: Design token compliance

The component MUST use DESIGN.md tokens and never hardcode hex values.

#### Scenario: Card visual structure

- **GIVEN** the component is rendered
- **WHEN** inspecting the DOM
- **THEN** the card SHALL have background `surface` (#FFFFFF)
- **AND** a 1px border in `hairline` (#E2E8F0)
- **AND** `border-radius` matching `rounded.lg` (12px)
- **AND** padding matching `spacing.5` (20px)

#### Scenario: Glassmorphism variant

- **GIVEN** input: `variant="glass"`
- **WHEN** the component renders
- **THEN** the card SHALL use `backdrop-filter: blur(12px)` and semi-transparent background
- **AND** the default `variant="solid"` SHALL render the standard card surface

### Requirement: Accessibility

The component MUST be keyboard-navigable and screen-reader-friendly.

#### Scenario: Card is focusable when interactive

- **GIVEN** input: `clickable="true"` (optional)
- **WHEN** the card receives keyboard focus via Tab
- **THEN** a visible focus ring SHALL appear (primary color, 2px outline)
- **AND** Enter/Space triggers the card action

#### Scenario: Screen reader reads value

- **GIVEN** the component renders with a value
- **WHEN** a screen reader encounters the card
- **THEN** the value SHALL have `aria-label` describing both title and value
- **AND** trend direction is included in the aria-label when present
