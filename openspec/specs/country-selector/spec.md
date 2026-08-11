# country-selector Specification

## Purpose

Country selection UI for NordicPump. Displays flag + country name for SE, DK, FI, NO. Emits the selected `Country` code and persists it to `CountryStateService` for app-wide consumption. Supports dropdown or button-group presentation.

## Requirements

### Requirement: Country display and selection

The component MUST render SE, DK, FI, NO as selectable options with flag icons and localized country names.

#### Scenario: All countries displayed

- **GIVEN** the component renders
- **WHEN** displayed
- **THEN** 4 country options are visible: Sweden (🇸🇪), Denmark (🇩🇰), Finland (🇫🇮), Norway (🇳🇴)
- **AND** country names respect the current active language via `TranslatePipe`

#### Scenario: Country selected via dropdown

- **GIVEN** the component uses `variant="dropdown"` (default)
- **WHEN** user selects Denmark
- **THEN** the component emits `DK` via `@Output() countrySelected`
- **AND** `CountryStateService.selectedCountry` signal is set to `DK`
- **AND** the dropdown displays the Danish flag + "Danmark" (or localized name)

#### Scenario: Country selected via button group

- **GIVEN** input: `variant="buttons"`
- **WHEN** user taps Finland button
- **THEN** the component emits `FI` via `@Output() countrySelected`
- **AND** the Finland button shows `primary` background to indicate active state
- **AND** other buttons show `surface` background

#### Scenario: Initial country from service

- **GIVEN** `CountryStateService.selectedCountry` is `SE`
- **WHEN** the component initializes
- **THEN** Sweden SHALL be pre-selected
- **AND** the dropdown or button group reflects that state

### Requirement: CountryStateService integration

The component MUST write selected country to a shared `CountryStateService` (signal-based).

#### Scenario: Service signal updates on selection

- **GIVEN** the component is mounted
- **WHEN** user selects Norway
- **THEN** `CountryStateService.selectedCountry()` returns `NO`
- **AND** any component reading the signal receives the update reactively

#### Scenario: Service initialized with Sweden

- **GIVEN** the service is instantiated
- **WHEN** no prior selection exists
- **THEN** `selectedCountry()` defaults to `SE`

### Requirement: Flag rendering

The component MUST display country flags using inline SVG (no network requests, no emoji fallback only).

#### Scenario: Flags are inline SVGs

- **GIVEN** the component renders each country option
- **WHEN** inspecting the DOM
- **THEN** flags SHALL be rendered as inline SVG elements
- **AND** each flag SHALL have appropriate `alt` text for accessibility (`role="img"`, `aria-label="Swedish flag"`)
- **AND** flags SHALL be 24×24px minimum

### Requirement: Accessibility

The component MUST support keyboard navigation and screen readers.

#### Scenario: Keyboard selection in button group

- **GIVEN** variant is `"buttons"` and buttons are focusable
- **WHEN** user tabs through country buttons and presses Enter on Denmark
- **THEN** Denmark is selected and emitted
- **AND** focus remains on the Denmark button with visible focus ring

#### Scenario: Role and label on selector

- **GIVEN** the component renders
- **WHEN** inspected by a screen reader
- **THEN** the container SHALL have `role="radiogroup"` for button variant or `role="listbox"` for dropdown
- **AND** an `aria-label` describing "Select country" (translated) is present
