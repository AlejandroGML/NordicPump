# price-chart Specification

## Purpose

Line or bar chart displaying historical fuel prices for the selected Nordic country. Renders via Chart.js with a shared config. Includes a draw-in animation, colorblind pattern overlay, and an accessible data table below the canvas.

## Requirements

### Requirement: Historical price rendering

The component MUST fetch `GET /api/v1/prices/{country}` and render prices over time via Chart.js.

#### Scenario: Swedish historical prices render as line chart

- **GIVEN** selected country is `SE`
- **WHEN** `GET /api/v1/prices/se` returns `200` with 4+ weeks of price data
- **THEN** a Chart.js line chart SHALL render with X-axis = dates, Y-axis = SEK price
- **AND** labels SHALL use Fira Code via Chart.js global font config
- **AND** an accessible `<table>` listing all data points SHALL appear below the canvas

#### Scenario: Diesel and Euro 95 as separate series

- **GIVEN** API returns both `euro_95` and `diesel` price records
- **WHEN** the chart renders
- **THEN** two line/bar datasets SHALL be displayed with distinct DESIGN.md chart colors
- **AND** a legend SHALL identify each fuel type

#### Scenario: Loading state

- **GIVEN** HTTP request is in flight
- **WHEN** component is mounted
- **THEN** skeleton loader SHALL occupy the chart area with `aria-busy="true"`
- **AND** no canvas SHALL be rendered until data arrives

#### Scenario: API error

- **GIVEN** API returns `404` or `503`
- **WHEN** the component receives the error
- **THEN** a translated error message SHALL be displayed with a Retry button
- **AND** the Retry button SHALL be ≥ 44×44px (WCAG 2.5.5)

### Requirement: Animation and motion

The component MUST animate chart draw-in with a 600ms ease-out and respect user motion preferences.

#### Scenario: Chart animates on load

- **GIVEN** `prefers-reduced-motion` is NOT set
- **WHEN** chart data is loaded
- **THEN** the chart SHALL animate with `duration: 600, easing: 'easeOutQuart'`
- **AND** animation SHALL use Chart.js `animation` config

#### Scenario: Reduced motion respected

- **GIVEN** `prefers-reduced-motion: reduce` is active
- **WHEN** chart data is loaded
- **THEN** animation duration SHALL be `0`
- **AND** the chart SHALL render fully without transitions

### Requirement: Colorblind accessibility

The component MUST render pattern overlays so price bands are distinguishable without color.

#### Scenario: Pattern overlay on bars/lines

- **GIVEN** chart renders with price data
- **WHEN** inspected visually
- **THEN** each price-band dataset (low/mid/high) SHALL include a distinct Canvas fill pattern (stripes, grid, dots)
- **AND** patterns SHALL be generated via `CanvasRenderingContext2D.createPattern()` on an offscreen canvas

### Requirement: Keyboard and screen reader access

The component MUST provide a keyboard-navigable data table below each chart.

#### Scenario: Data table is focusable

- **GIVEN** the chart is rendered with data
- **WHEN** a user tabs to the data table
- **THEN** each row SHALL be focusable and announced by screen readers
- **AND** table SHALL have `role="table"` with proper `scope` attributes on headers

#### Scenario: Chart canvas has accessible fallback

- **GIVEN** the `<canvas>` element renders
- **WHEN** inspected by a screen reader
- **THEN** the canvas SHALL have `role="img"` and `aria-label` describing the chart content
- **AND** `aria-describedby` SHALL reference the data table `id`

### Requirement: Responsiveness

The component MUST resize the chart on container width changes and respect mobile breakpoints.

#### Scenario: Mobile viewport

- **GIVEN** viewport width < 768px
- **WHEN** the chart renders
- **THEN** the chart SHALL fill full width with 16px horizontal padding
- **AND** the data table SHALL scroll horizontally with `overflow-x: auto`

#### Scenario: Desktop viewport

- **GIVEN** viewport width ≥ 1024px
- **WHEN** the chart renders
- **THEN** the chart SHALL render at full container width within a `max-w-4xl` card
