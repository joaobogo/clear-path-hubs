# TaaSFlow — Visual Regression Strategy

The design system's contract is only real if a screenshot check enforces it. Unit tests passing is **not** sufficient acceptance for a UI change.

## Approach

**Catalogue-driven, Playwright-native.** No Storybook install — the in-app catalogue at `/_dev/catalogue` is the single visual source of truth. Playwright screenshots the catalogue plus the top of each dashboard index route across the responsive matrix and compares against golden PNGs.

## Structure

```
e2e/
  visual/
    catalogue.spec.ts        # component library, 3 viewports
    dashboards.spec.ts       # admin, client, candidate index — 8 viewports
    _snapshots/              # golden PNGs committed to repo
```

## Rules

1. Every component listed in `docs/design/components.md` appears at least once in `/_dev/catalogue`.
2. Every state (default, hover, focus, disabled, loading, empty, error) has a rendered instance.
3. Diff tolerance: **0.5% pixels** with `maxDiffPixelRatio: 0.005`. Higher = investigate.
4. Golden updates require an explicit `--update-snapshots` run and are reviewed as part of the PR — never rubber-stamped.
5. A visual regression on a shared component blocks the merge even if the diff appears cosmetic.

## Coverage matrix

| Surface | Viewports |
|---|---|
| `/_dev/catalogue` | 375, 878, 1440 |
| `/admin` | 375, 768, 1024, 1440, 1920 |
| `/client` | 375, 768, 1024, 1440, 1920 |
| `/me/applications` | 375, 878, 1440 |
| `/jobs` (public) | 320, 375, 1024, 1440 |

## CI wiring

- Job runs after typecheck + unit tests.
- Uses `PLAYWRIGHT_BROWSERS_PATH=/` (pre-installed Chromium).
- Fails PR on any diff over threshold.
- Golden PNGs are the last-mile artefact; treat as source-controlled UI truth.
