# Delta for layout-shell

## ADDED Requirements

### Requirement: AppComponent Shell

The root AppComponent MUST contain a router-outlet wrapped in a semantic layout structure.

#### Scenario: App boots with shell visible

- GIVEN the Angular app is loaded at /sv/dashboard
- WHEN the page renders
- THEN the header (logo, nav, language switcher) is visible
- AND the router-outlet renders the matched route component
- AND the footer (copyright, attributions) is visible

#### Scenario: Route change preserves shell

- GIVEN the user is on /sv/dashboard
- WHEN the user navigates to /sv/about
- THEN header and footer remain unchanged
- AND only the router-outlet content area updates

### Requirement: Header Component

The header MUST display the NordicPump logo, navigation links, and the language switcher.

#### Scenario: Header renders on desktop

- GIVEN viewport width >= 768px
- WHEN the header renders
- THEN logo is left-aligned, navigation links are centered, language switcher is right-aligned
- AND the "Dashboard" nav link is visible and active when on dashboard routes

#### Scenario: Header renders on mobile

- GIVEN viewport width < 768px
- WHEN the header renders
- THEN logo and hamburger menu are visible
- AND navigation links collapse into a slide-out drawer
- AND language switcher is accessible within the drawer

#### Scenario: Header sticky on scroll

- GIVEN the user scrolls down a long page
- WHEN scroll position exceeds header height
- THEN the header remains fixed at the top (position: sticky)

### Requirement: Footer Component

The footer MUST display copyright and data source attributions.

#### Scenario: Footer renders attributions

- GIVEN any page is loaded
- WHEN the user scrolls to the bottom
- THEN the footer displays: "Data: fuel-prices.eu (CC BY 4.0) · SSB Statbank"
- AND copyright text includes the current year: "© {year} NordicPump"

#### Scenario: Footer attribution links open in new tab

- GIVEN the footer renders attribution text
- WHEN the user clicks "fuel-prices.eu"
- THEN the link opens in a new tab with rel="noopener noreferrer"

### Requirement: Responsive Layout

The layout MUST be mobile-first with a max-width container.

#### Scenario: Mobile layout

- GIVEN viewport width < 768px
- WHEN the page renders
- THEN content fills the full width with 16px horizontal padding
- AND touch targets are >= 44x44px per WCAG AA

#### Scenario: Desktop layout

- GIVEN viewport width >= 1024px
- WHEN the page renders
- THEN content is centered in a max-w-7xl container
- AND horizontal padding is 24px

### Requirement: Tailwind CSS Design Tokens

Tailwind MUST be configured with PLAN.md tokens as theme extensions.

| Token | Tailwind Config |
|-------|----------------|
| Primary #1E40AF | colors.primary |
| Secondary #3B82F6 | colors.secondary |
| Accent #F59E0B | colors.accent |
| Background #F8FAFC | colors.background |
| Text #1E3A8A | colors.text |
| Font | fontFamily.sans: Fira Sans, fontFamily.mono: Fira Code |

#### Scenario: Primary color applied

- GIVEN an element uses class bg-primary
- WHEN inspected in DevTools
- THEN computed background-color is #1E40AF

#### Scenario: Font family applied

- GIVEN body text uses class font-sans
- WHEN inspected in DevTools
- THEN computed font-family includes "Fira Sans" as primary

### Requirement: Global Styles Reset

Global styles MUST normalize browser defaults and load fonts correctly.

#### Scenario: Fonts load

- GIVEN the app loads in a browser
- WHEN the page renders
- THEN Fira Sans is applied to body text
- AND Fira Code is applied to elements with class font-mono
- AND no flash of unstyled text (FOUT) occurs (font-display: swap)

#### Scenario: Box-sizing reset

- GIVEN the global stylesheet is applied
- WHEN any element is inspected
- THEN box-sizing: border-box is inherited
