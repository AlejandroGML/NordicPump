# skeleton-loader Specification

## Purpose

Accessible loading skeleton component with pulse animation. Used by dashboard components (price-current, kpi-card, charts) while API data loads. Respects `prefers-reduced-motion: reduce` by disabling animation and rendering static placeholders. Configurable dimensions via `@Input()`.

## ADDED Requirements

### Requirement: Skeleton pulse animation

The component MUST render a placeholder with pulsing animation during loading states.

#### Scenario: Default skeleton renders with pulse

- **GIVEN** the component is rendered with no inputs
- **WHEN** displayed
- **THEN** a rectangular placeholder SHALL render with `animate-pulse` class
- **AND** the placeholder SHALL have background color `surface-muted` (#F1F5F9)
- **AND** dimensions default to full width × 20px height

#### Scenario: Custom dimensions

- **GIVEN** inputs: `width="200px"`, `height="48px"`
- **WHEN** the component renders
- **THEN** the skeleton SHALL be 200px wide and 48px tall

#### Scenario: Rounded variant

- **GIVEN** input: `rounded="full"`
- **WHEN** the component renders
- **THEN** the skeleton SHALL have `border-radius: 9999px` (pill shape)
- **AND** default `rounded` (no input) SHALL use `rounded.md` (8px)

### Requirement: Reduced motion support

The component MUST disable animation when the user prefers reduced motion.

#### Scenario: User prefers reduced motion

- **GIVEN** the operating system setting `prefers-reduced-motion: reduce` is active
- **WHEN** the component renders
- **THEN** no pulse animation SHALL play (static placeholder)
- **AND** the placeholder SHALL still render with the same dimensions and color
- **AND** `aria-busy="true"` SHALL NOT be set (motion-only indicator)

#### Scenario: No reduced motion preference

- **GIVEN** `prefers-reduced-motion` is `no-preference` or not set
- **WHEN** the component renders
- **THEN** the `animate-pulse` animation SHALL play at default speed

### Requirement: Accessibility semantics

The component MUST communicate loading state to assistive technology.

#### Scenario: Loading state announced

- **GIVEN** the component renders during loading
- **WHEN** a screen reader encounters the skeleton
- **THEN** the element SHALL have `aria-busy="true"`
- **AND** `role="status"` is set on the container
- **AND** a visually-hidden "Loading..." text SHALL be present (translated via `@Input() label`)

#### Scenario: Skeleton removed when loading complete

- **GIVEN** the parent component replaces skeleton with real content
- **WHEN** the skeleton is removed from DOM
- **THEN** `aria-busy` SHALL be removed from the replaced region
- **AND** the real content SHALL receive focus if it was the loading target

### Requirement: Variants

The component MUST support text-line, card, and circle variants for different loading contexts.

#### Scenario: Text line variant

- **GIVEN** input: `variant="text"`
- **WHEN** the component renders
- **THEN** a single line skeleton SHALL render at 100% width × 16px height with `rounded.sm`

#### Scenario: Card variant

- **GIVEN** input: `variant="card"`
- **WHEN** the component renders
- **THEN** a card-shaped skeleton SHALL render (240px × 160px) with `rounded.lg`
- **AND** it SHALL contain internal placeholder lines for title and value

#### Scenario: Circle variant

- **GIVEN** input: `variant="circle"`
- **WHEN** the component renders
- **THEN** a circular skeleton SHALL render (48px × 48px) with `rounded.full`
