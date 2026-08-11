# seasonality-chart Specification

## Purpose

Line chart displaying monthly price trends for the selected country, highlighting seasonal patterns. Uses historical data from `/api/v1/prices/{country}`. Renders via Chart.js with animation and pattern overlays. Includes accessible data table.

## Requirements

### Requirement: Monthly trend rendering

The component MUST fetch historical prices and render a monthly trend line chart via Chart.js.

#### Scenario: Monthly price trend for Sweden

- **GIVEN** selected country is `SE` with 12+ months of historical data
- **WHEN** the component renders
- **THEN** a Chart.js line chart SHALL render with X-axis = months (Jan–Dec), Y-axis = SEK price
- **AND** Euro 95 and Diesel SHALL render as separate lines with distinct DESIGN.md colors
- **AND** line tension SHALL be `0.3` for smooth curves

#### Scenario: Insufficient data (less than 3 months)

- **GIVEN** API returns fewer than 3 distinct months of data
- **WHEN** the component renders
- **THEN** a translated informational message SHALL display: `dashboard.seasonality.insufficient_data`
- **AND** no chart SHALL render

#### Scenario: Seasonal peak annotation

- **GIVEN** data shows a price peak in July of 18.50 SEK
- **WHEN** the chart renders
- **THEN** the peak SHALL display a highlight dot with `chart-high` color
- **AND** a tooltip SHALL show month + price on hover

#### Scenario: Loading state

- **GIVEN** HTTP request is in flight
- **WHEN** component mounts
- **THEN** skeleton loader SHALL display with `aria-busy="true"`

#### Scenario: API error

- **GIVEN** API returns error
- **WHEN** component receives it
- **THEN** translated error + Retry button (≥ 44×44px) SHALL display

### Requirement: Animation

The component MUST animate with Chart.js defaults (600ms) and respect `prefers-reduced-motion`.

#### Scenario: Draw-in animation

- **GIVEN** `prefers-reduced-motion` is NOT set
- **WHEN** chart data loads
- **THEN** line SHALL animate with Chart.js `animation: { duration: 600, easing: 'easeOutQuart' }`

#### Scenario: Reduced motion

- **GIVEN** `prefers-reduced-motion: reduce`
- **WHEN** chart data loads
- **THEN** animation duration SHALL be `0`

### Requirement: Accessibility

#### Scenario: Pattern overlay on series lines

- **GIVEN** two line series render (Euro 95, Diesel)
- **WHEN** inspected visually
- **THEN** each line SHALL include a dashed/dotted pattern variant so series are distinguishable without color
- **AND** pattern SHALL be set via `borderDash` in dataset config

#### Scenario: Data table for screen readers

- **GIVEN** chart renders with monthly data
- **WHEN** a screen reader encounters the section
- **THEN** a `<table>` SHALL list months and prices for each fuel type
- **AND** seasonal peaks SHALL be marked with `title` attribute or `visually-hidden` annotation

#### Scenario: Chart canvas a11y

- **GIVEN** the `<canvas>` renders
- **WHEN** inspected
- **THEN** canvas SHALL have `role="img"` and `aria-label="Seasonality chart"`
- **AND** `aria-describedby` SHALL link to the data table

### Requirement: Responsiveness

#### Scenario: Mobile — horizontal scroll for months

- **GIVEN** viewport < 768px with 12 month labels
- **WHEN** the chart renders
- **THEN** the chart SHALL fit all labels without truncation (auto-skip every other month label if needed)
- **AND** the data table SHALL use horizontal scroll
