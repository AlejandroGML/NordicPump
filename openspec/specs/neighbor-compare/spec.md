# neighbor-compare Specification

## Purpose

Horizontal bar chart comparing current fuel prices across all 4 Nordic countries (SE, DK, FI, NO). Fetches all countries in parallel, sorts cheapest→most expensive, and applies price-band color coding per DESIGN.md. Includes pattern overlay and accessible data table.

## Requirements

### Requirement: Multi-country comparison chart

The component MUST fetch prices for all 4 countries and render a sorted horizontal bar chart.

#### Scenario: All countries fetched and sorted

- **GIVEN** the component is mounted
- **WHEN** API calls for SE, DK, FI, NO all return `200`
- **THEN** a horizontal bar chart SHALL render with countries on Y-axis, sorted cheapest→most expensive
- **AND** each bar SHALL display the price in SEK (Fira Code)
- **AND** Y-axis labels SHALL show flag + country name (localized)

#### Scenario: Price-band color on bars

- **GIVEN** prices range from 13.00 to 19.00 SEK
- **WHEN** each country's EUR-equivalent is mapped to a band
- **THEN** bars SHALL use `chart-low` (#16A34A) for <1 EUR, `chart-mid` (#F59E0B) for 1-3 EUR, `chart-high` (#DC2626) for >3 EUR
- **AND** a legend SHALL explain the color bands

#### Scenario: One API fails

- **GIVEN** NO API returns `503` but SE/DK/FI succeed
- **WHEN** the component renders
- **THEN** the chart SHALL display SE/DK/FI bars normally
- **AND** NO SHALL show a "Data unavailable" placeholder bar with `surface-muted` color
- **AND** the data table SHALL mark the NO row with "Unavailable"

#### Scenario: All APIs fail

- **GIVEN** all 4 API calls fail
- **WHEN** the component renders
- **THEN** a translated error message SHALL display: `dashboard.compare.error`
- **AND** a Retry button SHALL be present

### Requirement: Loading and empty states

#### Scenario: Loading state

- **GIVEN** HTTP requests are in flight
- **WHEN** component is mounted
- **THEN** skeleton loader SHALL occupy the chart area with `aria-busy="true"`

#### Scenario: Zero data returned

- **GIVEN** all APIs return `200` with empty `prices` arrays
- **WHEN** the component renders
- **THEN** a translated message SHALL read `dashboard.compare.no_data`

### Requirement: Accessibility

The component MUST provide pattern overlays and a data table.

#### Scenario: Pattern overlay for colorblind

- **GIVEN** the chart renders with 4 country bars
- **WHEN** inspected
- **THEN** each bar SHALL include a Canvas pattern overlay (distinct per color band)
- **AND** patterns SHALL be stripes for low, grid for mid, dots for high

#### Scenario: Data table for screen readers

- **GIVEN** the chart is rendered with data
- **WHEN** a screen reader encounters the section
- **THEN** a `<table>` below the canvas SHALL list country, fuel type, price (SEK), and EUR-equivalent
- **AND** sorted order SHALL match the chart (cheapest first)

### Requirement: Responsiveness

#### Scenario: Horizontal layout on desktop

- **GIVEN** viewport ≥ 1024px
- **WHEN** the chart renders
- **THEN** bars SHALL have 24px height minimum with readable labels

#### Scenario: Mobile viewport

- **GIVEN** viewport < 768px
- **WHEN** the chart renders
- **THEN** country labels SHALL use abbreviated codes (SE/DK/FI/NO) instead of full names
- **AND** the chart SHALL be scrollable within a horizontal container if needed
