# tank-calculator Delta Spec

## ADDED Requirements

### Requirement: Tank size input

The component MUST provide an adjustable tank size via dual input — a range slider (1-200L) and a synced number input. Default value SHALL be 50 liters.

#### Scenario: Slider adjusts displayed liters

- **GIVEN** the component renders with default 50L
- **WHEN** the user drags the slider to 80L
- **THEN** the number input displays 80
- **AND** the cost calculations update to reflect 80 liters

#### Scenario: Number input syncs slider

- **GIVEN** the slider shows 50L
- **WHEN** the user types 35 in the number input and presses Enter
- **THEN** the slider position updates to 35
- **AND** the cost calculations reflect 35 liters

#### Scenario: Input clamped to min

- **GIVEN** the user types 0 in the number input and blurs
- **WHEN** the blur event fires
- **THEN** the value SHALL clamp to 1
- **AND** the slider updates to position 1

#### Scenario: Input clamped to max

- **GIVEN** the user types 250 in the number input and blurs
- **WHEN** the blur event fires
- **THEN** the value SHALL clamp to 200
- **AND** the slider updates to position 200

### Requirement: Cost calculation display

The component MUST fetch prices from `/api/v1/prices/{selectedCountry}` and multiply `price_sek` × tank liters for both Euro 95 and Diesel. Results SHALL be formatted with `Intl.NumberFormat('sv-SE')` and displayed in Fira Code monospace.

#### Scenario: Costs calculated for 50L tank

- **GIVEN** selected country is SE, Euro 95 at 14.50 SEK/L, Diesel at 16.20 SEK/L
- **WHEN** tank size is 50L
- **THEN** the component displays "725,00 kr" for Euro 95 and "810,00 kr" for Diesel
- **AND** prices use Fira Code monospace with `font-variant-numeric: tabular-nums`

#### Scenario: Native currency also displayed

- **GIVEN** selected country is DK, Euro 95 at 10.00 DKK/L native, tank size 50L
- **WHEN** the component renders costs
- **THEN** the native currency line shows "500,00 kr." (DKK format) for Euro 95
- **AND** the native line includes the currency code (e.g., "in DKK")

#### Scenario: Savings delta between fuels

- **GIVEN** Euro 95 costs 725 kr and Diesel costs 810 kr for 50L
- **WHEN** the component computes the difference
- **THEN** it displays "You save 85,00 kr with Euro 95" using translated string
- **AND** the cheaper fuel label is highlighted

### Requirement: Reactivity to country change

The component MUST re-fetch prices and recalculate costs when `CountryStateService.selectedCountry()` signal changes.

#### Scenario: Country changes from SE to NO

- **GIVEN** SE prices are displayed for 50L
- **WHEN** the user selects Norway via `CountrySelectorComponent`
- **THEN** the component fetches `GET /api/v1/prices/no`
- **AND** costs are recalculated with Norwegian prices
- **AND** native currency subtitle shows "in NOK"

#### Scenario: Country changes during loading state

- **GIVEN** a fetch for DK prices is in-flight
- **WHEN** the user quickly switches to FI
- **THEN** the DK response SHALL be discarded
- **AND** only the FI response drives the cost display

### Requirement: Loading, error, and empty states

The component MUST handle asynchronous price fetching with appropriate UI states.

#### Scenario: Loading state

- **GIVEN** prices have not yet loaded
- **WHEN** the component renders
- **THEN** `app-skeleton-loader` placeholders SHALL be displayed
- **AND** `aria-busy="true"` is set on the container

#### Scenario: API error

- **GIVEN** `GET /api/v1/prices/{country}` returns 404 or 503
- **WHEN** the component receives the error
- **THEN** it SHALL render a translated error message (`dashboard.tank.error`)
- **AND** a retry button SHALL be displayed with 44×44px minimum size

#### Scenario: Empty price array

- **GIVEN** the API returns `{ "prices": [] }`
- **WHEN** the component processes the response
- **THEN** it SHALL render a translated "no data" message (`dashboard.tank.noPrice`)

### Requirement: Accessibility

The component MUST meet WCAG AA requirements.

#### Scenario: Screen reader announces cost changes

- **GIVEN** tank size changes from 50L to 60L
- **WHEN** costs are recalculated and DOM updated
- **THEN** the cost container SHALL have `aria-live="polite"`
- **AND** the new total cost is announced to screen readers

#### Scenario: Touch targets

- **GIVEN** the slider thumb, number input, and retry button
- **WHEN** measured in the rendered DOM
- **THEN** all interactive elements SHALL be at least 44×44px

#### Scenario: Input label association

- **GIVEN** the tank size number input field
- **WHEN** inspected for accessibility
- **THEN** it SHALL have a visible `<label>` associated via `for`/`id`
- **AND** the label text is translated

#### Scenario: Keyboard operability

- **GIVEN** the component is focused
- **WHEN** the user navigates with Tab
- **THEN** slider, number input, and retry button SHALL be reachable
- **AND** each SHALL have a visible focus ring

### Requirement: Responsive layout

The component MUST adapt to mobile (375px) through desktop (1440px) without horizontal scroll.

#### Scenario: Mobile layout

- **GIVEN** viewport width is 375px
- **WHEN** the component renders
- **THEN** cost comparison SHALL stack vertically (single column)
- **AND** slider and input SHALL fill available width
- **AND** no horizontal scrollbar appears

#### Scenario: Desktop layout

- **GIVEN** viewport width is 1024px
- **WHEN** the component renders
- **THEN** cost comparison MAY render side-by-side (two columns)
- **AND** the component follows DESIGN.md card spacing

### Requirement: Visual design compliance

The component MUST use NordicPump design tokens from DESIGN.md.

#### Scenario: Nordic minimalist card

- **GIVEN** the component renders
- **WHEN** inspecting the DOM
- **THEN** the container SHALL use `bg-surface`, `border-hairline`, `rounded-lg`, and `padding-5`
- **AND** the slider track color SHALL be `primary` (#1E40AF)
- **AND** the slider thumb color SHALL be `accent` (#F59E0B)
- **AND** price values SHALL use `font-mono` (Fira Code)
