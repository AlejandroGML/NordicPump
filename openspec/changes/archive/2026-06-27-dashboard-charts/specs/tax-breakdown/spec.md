# tax-breakdown Specification

## Purpose

Stacked bar chart decomposing the fuel price into its components: product cost, excise duty, VAT, and other taxes. Uses stagger animation (500ms per bar). Derives breakdown from API `price_breakdown` field when available, or computes from raw price data. Includes pattern overlay and accessible data table.

## Requirements

### Requirement: Tax decomposition chart

The component MUST render a stacked bar chart showing price decomposition for the selected country's fuel types.

#### Scenario: API provides price_breakdown

- **GIVEN** `GET /api/v1/prices/se` returns `price_breakdown: { product_cost, excise_duty, vat, other_taxes }`
- **WHEN** the component renders for Euro 95 and Diesel
- **THEN** each fuel type SHALL display as a stacked bar with segments: product cost (chart-low), excise duty (chart-mid), VAT (accent), other taxes (secondary)
- **AND** segment heights SHALL be proportional to SEK values
- **AND** a stacked bar legend SHALL label each segment

#### Scenario: No price_breakdown — derived calculation

- **GIVEN** API response has no `price_breakdown` field
- **WHEN** the component renders
- **THEN** the component SHALL derive approximate breakdown using Swedish reference rates (product cost ≈ 55%, excise ≈ 25%, VAT ≈ 20%)
- **AND** a note SHALL display: "Estimated from reference rates — actual breakdown not available"
- **AND** the derive logic SHALL be documented with source references

#### Scenario: Stagger animation on load

- **GIVEN** `prefers-reduced-motion` is NOT set
- **WHEN** chart data loads
- **THEN** each bar SHALL animate with a delay of `N * 100ms` (first bar 100ms, second 200ms, etc.) over 500ms total per bar
- **AND** bars SHALL grow from bottom via Chart.js `animation.onProgress` config

#### Scenario: Reduced motion respected

- **GIVEN** `prefers-reduced-motion: reduce` is active
- **WHEN** chart data loads
- **THEN** all animations SHALL be disabled (duration: 0)
- **AND** bars SHALL render instantly at full height

### Requirement: Loading and error states

#### Scenario: Loading state

- **GIVEN** HTTP request is in flight
- **WHEN** component mounts
- **THEN** skeleton loader SHALL display with `aria-busy="true"`

#### Scenario: API error

- **GIVEN** API returns `404` or `503`
- **WHEN** the component receives error
- **THEN** translated error message SHALL display with Retry button (≥ 44×44px)

### Requirement: Accessibility

#### Scenario: Pattern overlay for colorblind

- **GIVEN** stacked bars render with 4 segment colors
- **WHEN** visually inspected
- **THEN** each segment color SHALL include a distinct Canvas fill pattern (diagonal lines, crosshatch, dots, horizontal lines)
- **AND** patterns SHALL be applied via Chart.js plugin using offscreen canvas

#### Scenario: Data table below chart

- **GIVEN** the chart is rendered with data
- **WHEN** a screen reader encounters the section
- **THEN** a `<table>` SHALL list each fuel type row and component columns (Product, Excise, VAT, Other)
- **AND** SEK values SHALL use `aria-label` with the full currency description

#### Scenario: Chart canvas a11y

- **GIVEN** the `<canvas>` element renders
- **WHEN** inspected
- **THEN** the canvas SHALL have `role="img"` and `aria-label="Tax breakdown chart"`
- **AND** `aria-describedby` SHALL link to the data table

### Requirement: Responsiveness

#### Scenario: Mobile viewport

- **GIVEN** viewport < 768px
- **WHEN** the chart renders
- **THEN** segment labels SHALL be abbreviated (e.g. "Exc." for excise duty)
- **AND** the data table SHALL use `overflow-x: auto`
