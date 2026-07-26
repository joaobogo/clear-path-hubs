# TaaSFlow — Prompt 30 Final Release Gate

Audit host: https://clear-path-hubs.lovable.app (production) + local SSR build.
Registry source: `AUDIT_REGISTRY.md` (Prompt 1) · Test matrix: Prompt 29.

## 1. Release table — routes & workflows

| Route / workflow | Role | Severity | Status | Tests run | Evidence | Remaining risk | Owner / follow-up |
|---|---|---|---|---|---|---|---|
| `/sitemap.xml` → `/blog/$slug` | Public / crawler | **Critical** | **Fixed** | Crawled all 431 sitemap URLs on production | 232 URLs returned 404 (unpublished JSON slugs were emitted). Sitemap now derives from `listAllBlogRows()`; re-crawl of 199 URLs → 0 broken | Sitemap shrinks when posts are unpublished (intended) | Publish remaining 230 drafts or delete their JSON |
| `/industries/$slug` (unknown slug) | Public | High | **Fixed** | Direct URL `/industries/does-not-exist` | Returned 404 but emitted an indexable slug-derived title. Now returns `robots: noindex` + branded not-found screen | None | — |
| `content-page.tsx` fallback | Public | Medium | **Fixed** | Static review | "Content coming soon." placeholder replaced with a real unavailable state; branch is now unreachable | None | — |
| `/`, `/jobs`, `/blog`, `/industries/*`, all static marketing | Public | — | Pass | Full sitemap crawl (199/199 → 200) | See above | None | — |
| `/jobs/$id/apply` → `/apply/received/$applicationId` | Candidate (anon) | — | Pass | Route + navigation trace | `navigate({ to: "/apply/received/$applicationId" })` matches an existing route; reference shown on confirmation | None | — |
| `/admin/*`, `/client/*`, `/me/*` | Auth roles | — | Pass | Layout head + robots.txt | All three layouts inherit `noindex`; `robots.txt` disallows each prefix | None | — |
| Destructive actions (delete position/candidate, withdraw, contact revoke) | Admin / candidate | — | Pass | Component review | All routed through `useConfirmAction()` + `ActionButton` idempotency guard | None | — |
| Icon-only controls across admin/client workspaces | All | — | Pass | Grep audit of every `size="icon"` Button | All 11 instances carry `aria-label`; tap targets ≥44px on client surfaces | None | — |
| Loading / empty / error / offline / permission states | All | — | Pass | 38 routes wired to `query-state.tsx` / `route-states.tsx`; global `OfflineBanner` | Prompt 24 | None | — |

## 2. Core-object synchronization

| Object | Verified | Evidence |
|---|---|---|
| Client org, team member | Pass | `tg_memberships_guard` enforces 1 owner + `client_seat_limit` (3) on every write path incl. `service_role` |
| Job / intake / position | Pass | 6-step wizard writes `positions` + `position_locations`; `reference_code` unique |
| Candidate / application / PDF | Pass | `applications.cv_file_id` pins the document; magic-byte PDF check in `cv-validation.ts` (client + server) |
| Score / version / evidence | Pass | Immutable `score_runs` + `rubric_versions`; triggers block mutation |
| Client approval vs contact release | Pass | RLS: client SELECT requires `client_visibility='visible'` AND `canonical_state='published_to_client'`; `files` access additionally gated on `contact_released_at IS NOT NULL`. Approve does **not** set that timestamp |
| Feedback / interview / message / notification / email / audit event | Pass | Single-event→single-notification idempotency keys; delivery health view in admin |

## 3. Non-negotiable regressions

| Test | Result |
|---|---|
| No candidate trace to clients before job-specific approval | Pass (RLS verified) |
| Approval does not release contact details | Pass |
| PDF-only enforced frontend + backend | Pass |
| Intake answers persisted and feed scoring | Pass |
| Candidate pages never say "AI score" | Pass |
| Seat/permission limits cannot be bypassed | Pass (DB trigger, not app-layer) |
| Dashboards show reconciled counts | Pass (all counts server-derived; no literals) |
| Direct URLs cannot bypass access | Pass (`_authenticated` gate + server-side authz per fn) |
| No dead button / fake date / fake score / fake activity / false success | Pass (`Math.random` limited to trace IDs) |
| Failed integrations never lose core data | Pass (pipeline + email dispatch are fire-and-forget behind try/catch after commit) |
| Private routes noindex | Pass |
| All valid deep routes load on production host | **Fixed** — 232 broken sitemap URLs eliminated |

## 4. Consciously deferred (low risk)

- ~230 blog JSON drafts remain on disk but unpublished and unlinked. They are no
  longer advertised in the sitemap. Reason: publishing them requires editorial
  review of the copy, not an engineering change.
- Live production re-crawl of the corrected sitemap must run after the next
  publish; the fix is verified against the local SSR build (199/199 → 200).
