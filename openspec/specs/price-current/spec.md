# price-current Specification

## Purpose

Display current Euro 95 and Diesel prices for the selected Nordic country. Formats values in SEK with `Intl.NumberFormat`, shows a trend indicator (up/down arrow vs last week), and applies price-band color coding from DESIGN.md (green <1 EUR, amber 1-3 EUR, red >3 EUR).

## Requirements

### Requirement: Price display for selected country

The component MUST fetch and display Euro 95 and Diesel prices from `GET /api/v1/prices/{country}` when the selected country changes via `CountryStateService`.

#### Scenario: Swedish prices loaded

- **GIVEN** the selected country is `SE`
- **WHEN** `GET /api/v1/prices/se` returns `200` with Euro 95 at 14.50 SEK and Diesel at 16.20 SEK
- **THEN** the component displays "14,50 kr" for Euro 95 and "16,20 kr" for Diesel
- **AND** prices use `Fira Code` monospace font with `font-variant-numeric: tabular-nums`

#### Scenario: Norwegian prices with native currency

- **GIVEN** the selected country is `NO`
- **WHEN** `GET /api/v1/prices/no` returns `200` with `price_sek` values
- **THEN** the component displays SEK-converted prices (not native NOK)
- **AND** a subtitle shows native currency ("22,40 kr" equivalent shown as SEK)

#### Scenario: API returns error

- **GIVEN** the API returns `404` or `503`
- **WHEN** the component receives the error response
- **THEN** the component SHALL render a translated error state (`dashboard.price.error`)
- **AND** the component SHALL show a retry button

#### Scenario: Loading state

- **GIVEN** the component is waiting for the API response
- **WHEN** the HTTP request is in flight
- **THEN** the component SHALL render `app-skeleton-loader` placeholders
- **AND** `aria-busy="true"` is set on the container

### Requirement: Trend indicator

The component MUST show a trend arrow (↑/↓) comparing current price to the previous week's price for the same fuel type.

#### Scenario: Price increased vs last week

- **GIVEN** current Euro 95 is 15.00 SEK and last week was 14.00 SEK
- **WHEN** the component calculates the trend
- **THEN** an up arrow (↑) is displayed with `chart-high` color (#DC2626)
- **AND** the difference in SEK is shown ("+1,00 kr")

#### Scenario: Price decreased vs last week

- **GIVEN** current Euro 95 is 14.00 SEK and last week was 15.00 SEK
- **WHEN** the component calculates the trend
- **THEN** a down arrow (↓) is displayed with `chart-low` color (#16A34A)
- **AND** the difference is shown ("-1,00 kr")

#### Scenario: No historical data available

- **GIVEN** only one week of price data exists
- **WHEN** the component attempts trend calculation
- **THEN** no trend arrow SHALL be displayed
- **AND** the price value SHALL still render normally

### Requirement: Price-band color coding

The component MUST color-code price values based on EUR-equivalent bands defined in DESIGN.md.

#### Scenario: Price below 1 EUR

- **GIVEN** Euro 95 price in SEK converts to 0.95 EUR
- **WHEN** the component renders the price
- **THEN** the price text color is `chart-low` (#16A34A)

#### Scenario: Price between 1-3 EUR

- **GIVEN** Diesel price in SEK converts to 2.00 EUR
- **WHEN** the component renders the price
- **THEN** the price text color is `chart-mid` (#F59E0B)

#### Scenario: Price above 3 EUR

- **GIVEN** Euro 95 price in SEK converts to 3.10 EUR
- **WHEN** the component renders the price
- **THEN** the price text color is `chart-high` (#DC2626)

### Requirement: Accessibility

The component MUST meet WCAG AA accessibility requirements.

#### Scenario: Screen reader announces price changes

- **GIVEN** the price updates from a new API response
- **WHEN** the DOM is updated
- **THEN** the price container SHALL have `aria-live="polite"`
- **AND** the fuel type label is announced before the price value

#### Scenario: Touch target size

- **GIVEN** the retry button is displayed
- **WHEN** measured
- **THEN** the button SHALL be at least 44×44px (WCAG 2.5.5)
