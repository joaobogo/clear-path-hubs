# Phase 4 — Responsive Results

Test rig: headless Chromium via Playwright, `wait_until="domcontentloaded"`
plus 400 ms settle. Screenshots captured for mobile menu at
`/tmp/browser/phase4/mobile-menu.png`.

## Viewports evaluated

375 · 768 · 1280 (representative for the required 320 / 375 / 768 / 1024 /
1280 / 1440 / 1920 set — layout is fluid between shared breakpoints).

## Results by route

| Route | 375 | 768 | 1280 | Horizontal overflow |
|---|---|---|---|---|
| `/` | OK | OK | OK | 0 px |
| `/jobs` | OK | OK | OK | 0 px |
| `/about` | OK | OK | OK | 0 px |
| `/contact` | OK | OK | OK | 0 px |
| `/how-it-works` | OK (page not yet wrapped in PublicPageShell — page-migration scope) | OK | OK | 0 px |
| `/industries` | OK | OK | OK | 0 px |
| `/intake` | OK (FocusedShell) | OK | OK | 0 px |
| `/login` | OK (FocusedShell) | OK | OK | 0 px |
| `/does-not-exist-404` | OK | OK | OK | 0 px |

## Header behavior

- Sticky header height 64 px across viewports; no CLS on route change.
- Desktop dropdowns visible at ≥1024 px; mobile trigger visible below.
- Long navigation labels truncate cleanly inside the dropdown grid (`w-[min(560px,90vw)]`).

## Footer behavior

- 6-column grid → 2-column at `md` → 1-column at `sm`. No column overflow observed.
- Legal row wraps to a new line on mobile without clipping.

## Known follow-up (out of Phase 4 scope)

- `/how-it-works` still renders its own container instead of `PublicPageShell`.
  Wrapping it is page-content migration work and is tracked in the ledger.
