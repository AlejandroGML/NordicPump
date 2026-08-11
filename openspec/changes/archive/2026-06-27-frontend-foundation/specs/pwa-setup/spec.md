# Delta for pwa-setup

## ADDED Requirements

### Requirement: Web App Manifest

The app MUST serve a valid `manifest.webmanifest` with the tokens defined in PLAN.md.

| Field | Value |
|-------|-------|
| name | NordicPump |
| short_name | NordicPump |
| theme_color | #1E40AF |
| background_color | #F8FAFC |
| display | standalone |
| scope | / |
| start_url | /sv/dashboard |
| icons | 192×192, 512×512 (PNG) |

#### Scenario: Manifest served correctly

- GIVEN the app is deployed
- WHEN Lighthouse audits PWA installability
- THEN the manifest passes validation with all required fields
- AND score is 100% PWA

#### Scenario: Installed app uses standalone display

- GIVEN the user installs the PWA on Android/iOS
- WHEN the app launches from the home screen
- THEN it renders in standalone mode (no browser chrome)
- AND theme_color #1E40AF is applied to the title bar

#### Scenario: Manifest missing icon sizes

- GIVEN only 192×192 icon defined, 512×512 missing
- WHEN Lighthouse audits
- THEN PWA installability fails with "maskable icon" warning

### Requirement: Service Worker — stale-while-revalidate

The service worker MUST cache API responses with a stale-while-revalidate strategy. Cached API responses SHALL expire after 24 hours.

| Asset | Strategy | Max Age |
|-------|----------|---------|
| App shell (HTML/CSS/JS) | Cache-first | 7 days |
| /api/* | Stale-while-revalidate | 24h |
| /assets/i18n/*.json | Cache-first | 7 days |
| /assets/icons/* | Cache-first | 30 days |

#### Scenario: Online — API served from network, cache updated

- GIVEN the device is online and SW is active
- WHEN a request to /api/v1/prices/se is made
- THEN the response comes from the network
- AND the cache is updated for offline use

#### Scenario: Offline — stale API cache served with freshness indicator

- GIVEN the device is offline and cached API data exists
- WHEN the user navigates to /sv/dashboard
- THEN cached API data is served
- AND a freshness banner displays "Showing cached data from {date}"

#### Scenario: Offline — no cache available

- GIVEN the device is offline with no cache (first visit)
- WHEN the user navigates to /sv/dashboard
- THEN an offline fallback page is shown
- AND the page states "You need an internet connection for the first visit"

#### Scenario: Cache expiration

- GIVEN cached API data older than 24h
- WHEN the device is offline
- THEN the service worker SHOULD still serve the stale data
- AND the freshness banner MUST display the stale date prominently

### Requirement: Install Prompt UX

The app MUST display an install prompt after the third page view, using the `beforeinstallprompt` event.

#### Scenario: User accepts install

- GIVEN the install prompt is shown
- WHEN the user clicks "Install"
- THEN the native PWA install dialog opens
- AND the prompt is dismissed and never reshown

#### Scenario: User dismisses install

- GIVEN the install prompt is shown
- WHEN the user clicks "Not now"
- THEN the prompt hides for the session
- AND reappears after 7 days or 5 more page views

#### Scenario: Already installed — prompt suppressed

- GIVEN the app is already installed (standalone display-mode)
- WHEN the page loads
- THEN no install prompt is ever shown

### Requirement: Splash Screen

The app MUST display a splash screen during cold starts in standalone mode.

#### Scenario: Splash screen renders

- GIVEN the PWA is installed
- WHEN the user opens it from the home screen (cold start)
- THEN a splash screen with NordicPump logo and background #F8FAFC is shown
- AND splash transitions to app shell once Angular bootstraps

### Requirement: PWA Scope and Route Prefixes

The service worker scope MUST be `/` to cover all route-prefixed language paths.

#### Scenario: SW controls all language routes

- GIVEN SW registered with scope /
- WHEN the user navigates to /da/dashboard or /fi/dashboard
- THEN the SW intercepts and applies caching strategy
- AND offline behavior is identical across all languages
