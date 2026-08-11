# Archive Report — dashboard-core

**Change**: dashboard-core
**Archive date**: 2026-06-27
**Mode**: hybrid (OpenSpec + Engram)
**Verify verdict**: PASS WITH WARNINGS (no CRITICAL)
**Archived to**: `openspec/changes/archive/2026-06-27-dashboard-core/`

---

## Pre-Archive Gates

| Gate | Result |
|------|--------|
| Verify verdict | ✅ PASS WITH WARNINGS — 0 CRITICAL (both prior CRITICALs resolved) |
| Task completion | ✅ 6/6 tasks `[x]`, all genuinely reflect production code |
| Build (tsc) | ✅ exit 0 |
| Tests (vitest) | ✅ 281/281 passed (+11 since prior verify) |

> No CRITICAL issues present. The single open item (trend SEK-difference text not rendered) is WARNING-level — headline trend behavior (arrow + color + no-arrow-on-first-load) is implemented and tested. Archive permitted.

---

## Specs Synced (delta → main source of truth)

All 4 delta specs were NEW domains (none existed under `openspec/specs/`). Per convention, each was copied directly with `## ADDED Requirements` normalized to `## Requirements` to match the established main-spec format.

| Domain | Action | Details |
|--------|--------|---------|
| price-current | **Created** `openspec/specs/price-current/spec.md` | 4 requirements, 12 scenarios |
| kpi-card | **Created** `openspec/specs/kpi-card/spec.md` | 3 requirements, 7 scenarios |
| country-selector | **Created** `openspec/specs/country-selector/spec.md` | 4 requirements, 9 scenarios |
| skeleton-loader | **Created** `openspec/specs/skeleton-loader/spec.md` | 4 requirements, 10 scenarios |

No MODIFIED/REMOVED/RENAMED requirements — purely additive. No merge conflicts; existing main specs (data-ingestion, i18n-setup, layout-shell, price-cache, prices-api, pwa-setup) untouched.

---

## Archive Contents

- proposal.md ✅
- design.md ✅
- tasks.md ✅ (6/6 tasks complete)
- verify-report.md ✅ (re-verify: PASS WITH WARNINGS)
- specs/ ✅ (4 delta specs: country-selector, kpi-card, price-current, skeleton-loader)
- archive-report.md ✅ (this file)

---

## Source of Truth Updated

The following main specs now reflect the new behavior:
- `openspec/specs/price-current/spec.md`
- `openspec/specs/kpi-card/spec.md`
- `openspec/specs/country-selector/spec.md`
- `openspec/specs/skeleton-loader/spec.md`

## Engram Traceability (hybrid mode)

Artifact observation IDs for this change:
- `sdd/dashboard-core/proposal` — #885
- `sdd/dashboard-core/specs` — #886
- `sdd/dashboard-core/design` — #887
- `sdd/dashboard-core/tasks` — #888
- apply-progress (CRITICAL fixes) — #889
- prior verify (FAIL) — #891 (historical — documents the first verify failed before fixes)
- verify-report (re-verify, PASS WITH WARNINGS) — `sdd/dashboard-core/verify-report` (this archive)
- archive-report — `sdd/dashboard-core/archive-report` (this observation)

---

## Intentional Warnings (non-blocking, recorded)

1. **Trend SEK-difference not rendered** — trend-up/down show arrow + correct color but not the "+1,00 kr / -1,00 kr" difference text. Secondary spec clause; tracked for a future enhancement.
2. Retry button 44×44px implemented but untested.
3. country-selector keyboard Enter/Space keydown test missing.
4. Norwegian native-currency subtitle scenario not directly tested.

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified (re-verified), and archived. Ready for the next change.
