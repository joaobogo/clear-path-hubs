# Prompt 46 — Accessibility & Visual Regression Suite

**Status:** PASS
**Date:** 2026-07-24
**Runner:** `scripts/qa/a11y_visual.py` (Playwright Chromium headless)

## Scope

Heuristic WCAG-focused checks + visual pixel-hash baselines across 6 viewports
(320, 375, 768, 1024, 1440, 1920) on 11 public routes:

`/`, `/platform`, `/how-it-works`, `/pricing`, `/industries`,
`/industries/hospitality`, `/jobs`, `/faq`, `/contact`, `/trust`, `/system`.

Total combinations audited: **66**.

## Checks

| Bucket    | Rule            | Basis                                         |
| --------- | --------------- | --------------------------------------------- |
| critical  | name-missing    | Every `<button>` / `<a>` needs an accessible name |
| serious   | image-alt       | Every `<img>` needs `alt` (empty allowed for decorative) |
| serious   | form-label      | Inputs need `<label>`, wrap-label, aria-label, or labelled ancestor (aria-hidden skipped) |
| serious   | landmark-main   | Exactly one `<main>` per page                 |
| moderate  | heading-h1      | Exactly one `<h1>`                            |
| moderate  | skip-link       | Skip-to-main-content link present             |

Visual regression: SHA-256 of a viewport-bounded top-of-page screenshot,
compared to a stored baseline hash. First run persists baselines under
`docs/audit/prompt-46-artifacts/baseline/`.

Reduced-motion is forced on the browser context so motion-sensitive users
see the same first-paint we test against.

## Result

```
critical  : 0
serious   : 0
moderate  : 0
visualDiff: 0   (baselines seeded this run)
```

Full JSON: `docs/audit/prompt-46-artifacts/report.json`.
Screenshots: `docs/audit/prompt-46-artifacts/screens/` (66 PNGs).

## Fixes applied during this sweep

1. **`/faq` was missing the site shell** → wrapped `FaqPage`'s return in
   `<SiteShell>` in `src/routes/faq.tsx`. Restores `<main id="main">`,
   the skip link, and shared header/footer landmarks.
2. **`/industries/*` dynamic pages missing the shell** →
   `IndustryTemplate` in `src/components/marketing/industry-template.tsx`
   now returns inside `<SiteShell>` (was a bare fragment). Fixes the
   landmark and skip-link gap on all 57 industry pages.

Both routes verified post-fix: `<main>` count = 1, skip link present.

## Changed files

- `src/routes/faq.tsx`
- `src/components/marketing/industry-template.tsx`
- `scripts/qa/a11y_visual.py` (new)
- `docs/audit/prompt-46-artifacts/report.json` (new)
- `docs/audit/prompt-46-artifacts/screens/*.png` (new)
- `docs/audit/prompt-46-artifacts/baseline/*.hash` (new)

## PASS gate

- critical failures = 0 ✅
- serious failures = 0 ✅
- unexplained visual diffs on approved baselines = 0 ✅
  (First run — baselines seeded. Subsequent runs compare against these.)

**PASS.**
