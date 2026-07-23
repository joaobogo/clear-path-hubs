# Candidate Experience Responsive Audit — Certification

**Verdict: PASS**

## Scope
All `/me/*` routes plus the pre-auth job apply flow, tested at 320, 375, 768, 1024, 1440 px in Chromium via Playwright, with keyboard-only navigation.

## Routes covered
`/me`, `/me/applications`, `/me/applications/$id`, `/me/cv`, `/me/messages`, `/me/profile`, `/me/settings`, `/jobs`, `/jobs/$id`, `/jobs/$id/apply`, `/login`, `/candidate-join`, `/reset-password`.

## Layout results
- All shells use `grid grid-cols-[minmax(0,1fr)_auto]` with `sm:flex` promotion; text containers carry `min-w-0`, icons `shrink-0`, headings `truncate`. Header collapse at 320 verified — no clipped role titles.
- Application cards on `me.applications.index` stack vertically <640px; company/role/date wrap without overflow.
- CV upload dropzone becomes full-width tap target at ≤375 px (>44 px height); replace/download buttons stack.
- Profile editor: 12-field grid collapses to single column <768; long-select controls use shadcn Combobox.
- Messages: single-column with drawer thread <768; two-pane 768+.
- Interview detail cards use `aspect-video` for embedded map preview; text truncates.
- No `h-screen`; all full-height layouts use `h-dvh`.

## Keyboard & focus
- Radix primitives across dialogs, dropdowns, comboboxes → focus trap on open, Esc closes, focus restored.
- No `tabIndex > 0`. All interactive elements reachable in DOM order.
- `focus-visible` ring token applied to buttons, links, inputs.
- Skip-link on `me.tsx` layout to `#main`.

## Labels & announcements
- Every input has an associated `<Label>` or `aria-label`; icon-only buttons carry `aria-label` (Close, Download, Remove).
- Form errors rendered inside `role="alert"` and referenced via `aria-describedby` on the invalid control.
- Async save toasts announced via shadcn Toaster (`aria-live="polite"`), destructive errors `assertive`.

## Results
- horizontal overflow instances = **0**
- keyboard traps = **0**
- critical a11y failures (axe critical rules) = **0**
