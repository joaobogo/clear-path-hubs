# Dashboard Protected Behaviour Map

Companion to `dashboard-brand-audit.md`. Enumerates what Phase 2 (brand implementation) **must not touch**, and specifies the regression checks that must pass before any branding change is considered shipped.

## Global protected surfaces

The following are considered protected across every authenticated route. A branding edit that changes any of these is a regression, regardless of how good it looks.

- Routes and route parameters
- Page hierarchy and layout nesting under `_authenticated/`
- Navigation destinations (every `<Link to>` and `router.navigate` target)
- Database queries, RPCs, and view reads
- Edge functions and server function contracts
- Authentication flow, session shape, and redirects
- Role-based permissions and `has_role()` gates
- Tenant isolation (`is_org_member()`, RLS boundaries)
- Scoring pipeline and score outputs
- Candidate processing states and transitions
- Candidate publication (publish gate, approval flow)
- Message send/receive and thread pagination
- Interview scheduling and reminder logic
- Notification generation, delivery, and read/unread state
- Realtime subscriptions (`use-realtime-refresh`, notification bell, chat)
- Responsive breakpoints and mobile shell behaviour
- Keyboard navigation and focus order

## Component-level protected behaviour

### `components/workspace/workspace-shell.tsx`

- Sidebar collapse/expand behaviour and `taasflow:sidebar:collapsed` localStorage key
- Mobile Sheet drawer open/close
- Global search dialog trigger and scope (`admin` vs `client`)
- Breadcrumb builder (`buildBreadcrumbs`)
- Support-view banner rendering and `linkSearch` propagation
- `NotificationBell` and `SignOutButton` slot positions
- Active-link matching against router state

Only the following are safe to restyle: colour of the active-nav pill, sidebar background, sidebar border, focus outline colour, avatar shadow, brand mark padding.

### `components/ds/*`

Every DS primitive is presentation-layer. All are safe to restyle, but their public props and children slots must remain unchanged. Specifically:

- `PageHeader` — keep `title`, `description`, `actions`, `back` props intact
- `KpiCard` — keep numeric formatting and trend indicator semantics
- `StatusBadge` — keep the state → variant mapping; do not add or remove states
- `EmptyState` / `ErrorState` — keep CTA click handlers wired through props
- `LoadingSkeleton` — keep count / shape props

### `components/candidate-detail-drawer.tsx`

- Score band thresholds (numeric cutoffs for the emerald/amber/rose chips today)
- Tooltip strings on score chips
- Drawer open/close animation trigger and Escape-key handling
- Requirement rendering order and evidence quote source

Restyle is limited to: chip colours (route through `StatusBadge`), spacing, typography, drawer shadow.

### `components/notification-bell.tsx`

- Unread count query and polling/subscription
- Popover open/close
- "Mark all as read" mutation

Restyle is limited to: unread-dot colour, bell icon size, popover surface treatment.

### `components/ui/button.tsx`

- `variant="destructive"` must remain the semantic danger colour — it is used on Publish Desk Reject, Candidates Delete, and Interview Cancel flows. Do not merge destructive into a brand ramp.
- Variant surface area (`default | destructive | outline | ghost | link | secondary`) must not be reduced. New variants (e.g. `brand`) may be added.

## Route-specific protected behaviour

### Admin

- `admin.publish.tsx` — publish gate trigger, approval → client-visibility flip, reject reason capture
- `admin.candidates.$id.tsx` — evidence tab data source, verify/reject controls, insights enrichment button
- `admin.operations.tsx` — "Enrich all profiles" and "Rehydrate CVs" bulk actions
- `admin.intake.$id.tsx` — 5-step wizard state, draft-save, idempotency key propagation
- `admin.health.tsx` — pipeline health counters and their queries
- `admin.messages.tsx` — thread pagination, send flow, read receipts
- `admin.team.tsx` — role assignment mutations
- `admin.settings.tsx` — org and user preference writes

### Client

- `client.candidates.index.tsx` — filter/sort URL search params; every filter must continue to round-trip through the URL
- `client.candidates.$id.tsx` — stage transition mutations (Applied → Under review → Shortlisted → Interview → Offer) and their validation
- `client.positions.$id.tsx` — requirements editing, position status transitions
- `client.positions.$id.edit.tsx` — form validation and dirty-state guarding
- `client.interviews.tsx` — schedule read, cancel/reschedule
- `client.messages.tsx` — thread selection and send flow
- `client.team.tsx` — invite flow

### Candidate

- `me.applications.$id.tsx` — application status stream, withdraw action
- `me.cv.tsx` — CV upload validation (size, type), version history
- `me.profile.tsx` — profile write mutation
- `me.messages.tsx` — thread pagination and send flow
- `me.settings.tsx` — notification preferences write

## Cross-cutting protected flows

These flows span multiple routes and must remain end-to-end intact after any branding edit.

1. **Publish flow.** Admin approves candidate on `admin.publish.tsx` → publish gate trigger accepts → row appears in `client.candidates.index.tsx` for the correct org → notification fires → client sees badge on `notification-bell`.
2. **Application flow.** Public `/jobs/$id` apply → CV uploaded to `cvs` bucket with scoped policy → row created in `applications` → CV hydration + scoring runs → candidate visible on `admin.candidates.index.tsx` with correct state.
3. **Stage transition.** Client moves candidate from Applied → Interview on `client.candidates.$id.tsx` → mutation validated → realtime pushes new stage to admin views and candidate `me.applications.$id.tsx`.
4. **Enrichment.** Admin clicks "Enrich all profiles" on `admin.operations.tsx` → Gemini insights populate `candidate_evidence` → verify tab on `admin.candidates.$id.tsx` reflects the new evidence with a "pending review" state.
5. **Auto-provisioning on signup.** New user signs up → auto-assigned to a client membership (or platform_admin if `@taasflow` email) → lands on correct workspace shell (`/client` or `/admin`).

## Regression checks required before Phase 2 sign-off

Run in this order after any brand-token or component-restyle change:

1. Production build passes (`build:dev` and `build`).
2. Every route in scope renders without console errors when visited with the appropriate role.
3. `admin.publish.tsx` end-to-end approval still surfaces the candidate to the client workspace.
4. `client.candidates.$id.tsx` stage transitions still validate and persist.
5. `notification-bell` unread count still updates on new events in realtime.
6. `admin.candidates.$id.tsx` score bar still renders proportionally to the score value.
7. `candidate-detail-drawer.tsx` chip colours still communicate the same score bands (accessibility check: colour is not the only signal — numeric value must remain visible).
8. Sidebar collapsed state still persists across reloads via localStorage.
9. Global search still routes to the correct scope (admin vs client).
10. Mobile shell drawer still opens on the hamburger and closes on backdrop tap and Escape.
11. Keyboard focus order on `admin.candidates.index.tsx` filter row unchanged.
12. WCAG AA contrast holds for: primary button label, active-nav pill label, message bubble timestamp, score chip numeric value, chart categorical adjacency (chart-1 vs chart-2, chart-2 vs chart-3, etc.).
13. No hard-coded Tailwind colour classes remain on `admin.candidates.index.tsx`, `client.candidates.index.tsx`, or `candidate-detail-drawer.tsx` after step 4/5 of the branding sequence.
14. All `StatusBadge` state → variant mappings unchanged (grep the file before and after).

If any check fails, revert the offending step and re-audit before proceeding.
