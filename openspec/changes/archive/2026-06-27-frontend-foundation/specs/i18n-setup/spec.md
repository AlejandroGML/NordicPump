# Delta for i18n-setup

## ADDED Requirements

### Requirement: Language Detection Chain

The app MUST detect the user's language using this fallback chain: localStorage → navigator.language → sv (default).

| Priority | Source | Example |
|----------|--------|---------|
| 1 | localStorage lang key | "fi" |
| 2 | navigator.language (primary subtag) | "nb-NO" → "nb" |
| 3 | Default fallback | "sv" |

#### Scenario: User has localStorage preference

- GIVEN localStorage contains lang: "en"
- WHEN the app loads at /
- THEN the user is redirected to /en/dashboard
- AND navigator.language is ignored

#### Scenario: No localStorage, navigator matches supported language

- GIVEN localStorage is empty and navigator.language is "da-DK"
- WHEN the app loads at /
- THEN the user is redirected to /da/dashboard

#### Scenario: Unsupported navigator language

- GIVEN localStorage is empty and navigator.language is "de-DE"
- WHEN the app loads at /
- THEN the user is redirected to /sv/dashboard (default fallback)

#### Scenario: User manually switches language

- GIVEN the user is on /sv/dashboard
- WHEN the user selects "English" from the language switcher
- THEN the URL changes to /en/dashboard
- AND localStorage.setItem("lang", "en") is called
- AND all visible text re-renders in English

### Requirement: Route-Prefixed URLs

All routes MUST be prefixed with the language code: /:lang/dashboard, /:lang/about.

#### Scenario: Direct navigation to prefixed route

- GIVEN the user types /fi/dashboard in the browser
- WHEN the page loads
- THEN Angular resolves lang=fi, loads assets/i18n/fi.json
- AND content renders in Finnish

#### Scenario: Invalid language prefix

- GIVEN the user navigates to /de/dashboard
- WHEN the route is resolved
- THEN the app redirects to /sv/dashboard (default)
- AND no 404 is shown

#### Scenario: Root path redirect

- GIVEN the user navigates to /
- WHEN the route is resolved
- THEN the detection chain runs and redirects to the correct /:lang/dashboard

### Requirement: Translation File Structure

Translation files MUST be JSON at assets/i18n/{lang}.json with nested keys matching component scope.

#### Scenario: Translation file loaded for active language

- GIVEN the active language is nb
- WHEN a component calls translateService.instant("header.dashboard")
- THEN the value from assets/i18n/nb.json at key header.dashboard is returned

#### Scenario: Missing translation key

- GIVEN key header.settings exists in sv.json but not in fi.json
- WHEN the active language is fi
- THEN the key itself "header.settings" is displayed as fallback text
- AND a console warning is logged in development mode

### Requirement: Language Switcher

The header MUST contain a language switcher with 6 options, each showing the native language name.

#### Scenario: Switcher renders all languages

- GIVEN the app shell is loaded
- WHEN the user views the header
- THEN the switcher shows: Svenska · Dansk · Norsk bokmål · Suomi · English · Español
- AND the active language is visually highlighted

#### Scenario: Switcher triggers language change

- GIVEN the user is on /sv/dashboard
- WHEN the user selects "English" from the switcher
- THEN the app navigates to /en/dashboard preserving the route path suffix

### Requirement: RTL Preparation

All layout components MUST use CSS logical properties for future RTL support.

#### Scenario: Logical properties used

- GIVEN the layout uses margin-inline-start instead of margin-left
- WHEN dir="rtl" is set on html
- THEN layout mirrors correctly without code changes

#### Scenario: Text alignment with logical properties

- GIVEN text uses text-align: start instead of text-align: left
- WHEN dir="rtl" is set
- THEN text aligns to the right automatically
