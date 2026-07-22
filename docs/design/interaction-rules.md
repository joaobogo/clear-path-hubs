# Interaction Rules — TaaSFlow V2

Applies to every route on the public site and every workspace. Enforced in code review.

## 1. Actions

- **One primary action per page.** Rendered as a solid `Button` (default variant) in `PageHeader`'s right slot. No other solid buttons visible above the fold.
- **Maximum three secondary actions per group.** Rendered as `Button variant="secondary"` or `variant="outline"`. Anything beyond three moves into an overflow menu (`MoreHorizontal` → `DropdownMenu`).
- **Uncommon actions live in the overflow menu.** Never expose bulk/export/settings actions inline when they are used < 10% of the time.
- **Destructive actions are separated.** Rendered as `variant="destructive"`, always trailing the group, and always confirmed via `AlertDialog` with a typed confirmation for irreversible operations (e.g. delete organization).
- **Icon-only actions require a `Tooltip` and an `aria-label`.** No exceptions.
- **Disabled controls must explain themselves.** Wrap in a `Tooltip` that states the precondition (e.g. "Score first to publish"). Never ship a disabled button with no hint.

## 2. Feedback and persistence

- **No fake success.** UI reflects server truth: the button shows a spinner during the mutation and success/error state only after the response resolves. Optimistic updates are allowed only when a rollback path is implemented and the mutation is idempotent.
- **All mutations use TanStack Query mutations + `queryClient.invalidateQueries`.** Never mutate local state to "look successful" without the server acknowledging.
- **Toasts** (shadcn `sonner`) confirm asynchronous outcomes; inline validation covers form errors. Toasts are never the only signal for a destructive/permanent action.
- **Errors** surface with a specific message from the server (`code`, `message`) — no bare "Something went wrong".

## 3. Disclosure

- **Progressive disclosure.** Advanced settings, JSON payloads, raw scoring internals, and audit traces live inside a collapsed `Accordion` or a secondary tab, never on first paint.
- **Right rail / drawer** for record context (activity, notes, files) — keeps the main body focused on the primary object.
- **Empty states** always show: icon + one-line explanation + one CTA (or `null` if no action is possible).

## 4. Data integrity

- **No decorative KPI without real backend meaning.** Every `KpiCard` value comes from a server function that queries canonical tables. Placeholders/mocks are forbidden in shipped routes.
- **No unsourced counts.** If a badge shows "12 pending", the source query must be linked from the badge (via title tooltip or a click-through).
- **Numbers are tabular** (`tabular-nums`) and consistently formatted per locale (`Intl.NumberFormat`).

## 5. Navigation

- **Only `<Link to>` for internal navigation.** Never `<a href>` for internal routes. Dynamic params passed via `params={{ ... }}`.
- **Preserve query state** across pagination/filter changes with `search={(prev) => ({ ...prev, ... })}`.
- **Preload on intent** at the router level (already enabled).
- **Breadcrumb is source of truth** for hierarchical location. Never hard-code back buttons.

## 6. Forms

- All forms use shadcn `Form` + `zod` resolver. Server accepts the same Zod schema (`.functions.ts` + `.inputValidator`).
- Inline field errors + a form-level error banner for cross-field or server failures.
- Submit button disables **only** during in-flight mutation; validation errors do not disable — they show messages.
- Autosave for long-lived drafts (intake wizard already does this) with a "Saved <time>" indicator.

## 7. Real-time and stale data

- Subscribe via the existing `use-realtime-refresh` hook for domain-level invalidation.
- Never poll; never `useEffect` + `fetch` for initial render — use loader + `useSuspenseQuery`.

## 8. Support mode (admin viewing client)

- All mutating actions in a client-scoped route call `assertNotSupportViewReadOnly` server-side. UI reflects the `SUPPORT_VIEW_READ_ONLY` toast and disables mutation buttons with a tooltip: "Read-only in Support mode — start an interactive session to make changes."

## 9. Accessibility (interaction subset)

- Full keyboard support on every widget. `Tab` cycles in DOM order; `Shift+Tab` reverses; `Enter`/`Space` activates.
- Focus-visible ring is never removed.
- `Esc` closes any open dialog/drawer/popover; return focus to the trigger.
- Live regions (`aria-live="polite"`) for toasts and for async status updates in tables.
