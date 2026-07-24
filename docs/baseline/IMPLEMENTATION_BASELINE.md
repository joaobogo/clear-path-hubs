# TaaSFlow — Implementation Baseline

Snapshot of the current app before Phase 1 improvements. **No code changed in this pass.**
Purpose: give every future prompt a known-good reference for routes, data, roles, integrations, and current failures.

Baseline captured: 2026-07-24
Repo: `clear-path-hubs` (preview) / `taasflow.com` (product reference)
Stack: TanStack Start on Cloudflare + Supabase (Lovable Cloud) + Tailwind v4 + shadcn.

---

## 1. Route inventory

### 1.1 Public routes (`src/routes/*.tsx`, 47 files)

Marketing / conversion:
`index.tsx` (home), `about.tsx`, `contact.tsx`, `how-it-works.tsx`, `pricing.tsx`,
`platform.tsx`, `solutions.tsx`, `enterprise.tsx`, `case-studies.tsx`, `pilot.tsx`,
`pitch.tsx`, `system.tsx`, `trust.tsx`, `journey.tsx`, `resources.tsx`,
`knowledge-base.tsx`, `faq.tsx`, `partnerships.staffing.tsx`,
`talent-marketplace.tsx`, `talent-network.tsx`, `global-talent.tsx`,
`employer-onboarding.tsx`, `industries.index.tsx`, `industries.$slug.tsx`,
`industries.non-profit.tsx`, `blog.index.tsx`, `blog.$slug.tsx`,
`blog.category.$slug.tsx`.

Auth surfaces: `auth.tsx`, `login.tsx`, `reset-password.tsx`, `candidate-join.tsx`,
`access-denied.tsx`, `unauthorized.tsx`.

Jobs / apply: `jobs.index.tsx`, `jobs.$id.index.tsx`, `jobs.$id.apply.tsx`,
`apply.received.$applicationId.tsx`, `candidate-success.tsx`.

Intake (client-facing): `intake.tsx`, `intake_.confirmation.tsx`.

Presentation / share: `boardroom.tsx` (also authenticated variant),
`share.$token.tsx`.

Legal / meta: `privacy.tsx`, `terms.tsx`, `sitemap.tsx`, `sitemap[.]xml.ts`,
`dev.catalogue.tsx`.

### 1.2 Authenticated routes (`src/routes/_authenticated/`, gated by `route.tsx` → `/login`)

**Admin (platform_admin / operations)** — 25 files
`admin.index.tsx`, `admin.tsx`, `admin.health.tsx`, `admin.operations.tsx`,
`admin.settings.tsx`, `admin.team.tsx`, `admin.wbr.tsx`, `admin.publish.tsx`,
`admin.notifications.tsx`, `admin.messages.tsx`, `admin.copilot.tsx`,
`admin.intake.tsx`, `admin.intake.index.tsx`, `admin.intake.$id.tsx`,
`admin.positions.tsx`, `admin.positions.index.tsx`, `admin.positions.$id.tsx`,
`admin.positions.$id.edit.tsx`, `admin.clients.tsx`, `admin.clients.index.tsx`,
`admin.clients.$id.tsx`, `admin.clients_new.tsx`, `admin.candidates.tsx`,
`admin.candidates.index.tsx`, `admin.candidates.$id.tsx`,
`admin.candidates.$id.evidence.tsx`.

**Client (client_admin / editor / viewer)** — 20 files
`client.tsx`, `client.index.tsx`, `client.settings.tsx`, `client.team.tsx`,
`client.assistant.tsx`, `client.executive.tsx`, `client.portfolio.tsx`,
`client.messages.tsx`, `client.interviews.tsx`, `client.offers.tsx`,
`client.shares.index.tsx`, `client.talent-memory.tsx`, `client.talent-pool.tsx`,
`client.positions.tsx`, `client.positions.index.tsx`,
`client.positions.$id.tsx`, `client.positions.$id.edit.tsx`,
`client.candidates.tsx`, `client.candidates.index.tsx`,
`client.candidates.$id.tsx`.

**Candidate** — `me.applications.tsx`, `me.applications.index.tsx`,
`me.applications.$id.tsx`.

**Other authenticated**: `boardroom.tsx` (live-data presentation mode).

### 1.3 Server API routes (`src/routes/api/public/*`)
`bootstrap-admin.ts`, `contact.ts`, `events.ts`, `intake.ts`,
`intake-status.$id.ts`, `pipeline.run.ts`, `qa-seed.ts`.

### 1.4 Server functions (`src/lib/*.functions.ts`, 26 modules)
admin, admin-copilot, apply, assistant, auth, candidate, client, cv-download,
executive, global-search, hires, inquiry, intake-admin, interviews, jobs,
journey, notifications, portfolio, position-edit, processing, role-memory,
shares, support, talent-memory, talent-pool, wbr.

Server-only helpers (`*.server.ts`): admin-copilot-tools, assistant-actions,
assistant-audit, candidate-insights, cv-extractor, scoring-engine, support-view.

---

## 2. Database entities (Supabase)

Full schema is in `docs/architecture/canonical-entity-model.md`. Table count: 63
(see `<supabase-tables>` section). Canonical ownership rules live in
`docs/architecture/source-of-truth-rules.md`.

**Core entities (canonical writers):**
- `organizations`, `memberships`, `profiles`, `user_roles` — identity & tenancy.
- `positions` — role definitions (lifecycle guarded by `tg_positions_lifecycle_guard`).
- `intake_submissions` — client-facing intake wizard drafts.
- `applications` — a candidate applying to a position (event of applying).
- `candidate_profiles` — persistent candidate identity.
- `candidate_matches` — pipeline state (stage, visibility, decisions).
- `score_runs` — immutable per-submission scoring (`tg_score_runs_immutable`).
- `score_decisions`, `client_decisions` — decision logs.
- `candidate_evidence` — immutable CV evidence snapshots.
- `files` — CV binaries (private `cvs` bucket) + extracted text.
- `hire_records` — offer / hire lifecycle.
- `interviews` — interview lifecycle.
- `messages`, `notifications`, `notification_events`,
  `notification_deliveries` — comms.
- `audit_events` — system-level state changes (only trigger writes).
- `assistant_conversations`, `assistant_messages`, `assistant_audit_events`,
  `admin_copilot_conversations`, `admin_copilot_messages` — AI assistants.
- `talent_memory`, `talent_memory_events`, `talent_pools`,
  `talent_pool_members` — silver medalist / rediscovery.
- `role_memory` — recruiter handoff notes.
- `shortlist_shares`, `shortlist_share_comments` — client shortlist sharing.
- `support_sessions`, `support_actions` — Support Mode ("View as Client").
- `saved_views` — dashboard filter persistence.
- `processing_jobs` — background jobs.
- `screening_questions`, `application_answers` — pre-apply questionnaire.
- `provider_usage_events`, `cost_limits` — provider cost telemetry.
- `consent_records`, `data_subject_requests`, `export_jobs`,
  `retention_policies`, `retention_runs` — GDPR surfaces (writers TBD).
- `marketing_inquiries`, `contact_messages`, `outreach_campaigns`,
  `outreach_touches` — marketing surfaces (outreach visibility already stripped
  from dashboards per earlier prompt; tables retained).
- Legacy migration maps: `legacy_*_map`, `migration_*`, `trace_index` — read-only.

**Key security helpers (SECURITY DEFINER, `search_path=public`):**
`has_role`, `has_org_role`, `is_org_admin/editor/viewer/member`,
`is_platform_admin`, `is_platform_staff`, `is_active_user`,
`is_owning_candidate`, `scoring_readiness`.

**Triggers of note:** `tg_positions_lifecycle_guard`,
`tg_score_runs_immutable`, `tg_score_runs_identity`,
`tg_candidate_matches_publish_gate`, `tg_hire_records_lifecycle`,
`tg_hire_records_sync_match`, `tg_write_audit_event`,
`tg_touch_updated_at`, `tg_support_session_guard`,
`grant_platform_admin_for_taasflow_domain`.

---

## 3. Auth, roles, and permissions

- Sign-in: Supabase email/password + Google OAuth broker (Lovable).
- Route gate: `src/routes/_authenticated/route.tsx` (SSR off; calls
  `supabase.auth.getUser()` and redirects to `/login` on miss).
- Bearer attach: `src/integrations/supabase/auth-attacher.ts`, registered as
  `functionMiddleware` in `src/start.ts`.
- Platform admin auto-grant: `@taasflow.com` email domain → platform_admin
  membership on org `f55e9b3b-75a8-486e-ab66-c496adcdfc89` (via
  `grant_platform_admin_for_taasflow_domain` on `auth.users` insert/update).
- Master admin: `joaoluciano9812@gmail.com` (platform_admin) — password rotated
  through `MASTER_ADMIN_ROTATED_AT` secret.
- Membership roles (`membership_role` enum):
  `platform_admin`, `operations`, `client_admin`, `client_editor`,
  `client_viewer`, `candidate`.
- App roles (`app_role` enum on `user_roles`): `admin`, `moderator`, `user`.
- Support Mode: platform_admin/operations can open a `support_sessions` row and
  read a scrubbed client DTO via `src/lib/support-view.ts`; writes go through
  `assertNotSupportViewReadOnly`.

**Public vs authenticated invariants:**
- Public routes never `beforeLoad`-gate to `/login`.
- Public loaders never call `requireSupabaseAuth` server fns (SSR has no
  bearer). Public data flows through publishable-key reads bound by
  `TO anon` policies.

---

## 4. Forms and their destinations

| Form | Route | Destination |
|---|---|---|
| Contact | `contact.tsx` | `api/public/contact.ts` → `contact_messages` |
| Marketing inquiry | pricing / pitch CTAs | `inquiry.functions.ts` → `marketing_inquiries` |
| Client intake wizard (5 steps + draft) | `intake.tsx` | `api/public/intake.ts` → `intake_submissions` → admin approval → `positions` + `organizations` + `memberships` |
| Job apply (public) | `jobs.$id.apply.tsx` | `apply.functions.ts` → `applications` + `candidate_profiles` + `files` (private `cvs` bucket) + `candidate_matches` |
| Screening answers | apply flow | `application_answers` |
| Candidate join | `candidate-join.tsx` | Supabase auth → link `candidate_profiles.user_id` |
| Position edit (admin & client) | `admin.positions.$id.edit.tsx`, `client.positions.$id.edit.tsx` | `position-edit.functions.ts` (lifecycle-guarded) |
| Publish decision | `admin.publish.tsx` | `admin.functions.ts` → `candidate_matches.approved_score_run_id` + visibility |
| Client decision (move stage) | `client.candidates.$id.tsx` | `client.functions.ts::moveMatchStage` (writes `client_decisions` + mirrors) |
| Delete candidate match | `admin.candidates.$id.tsx` | `processing.functions.ts::deleteCandidateMatch` |
| Interview scheduling | `client.interviews.tsx` | `interviews.functions.ts` |
| Offer / hire | `client.offers.tsx` | `hires.functions.ts` (`tg_hire_records_lifecycle`) |
| Share shortlist | client candidates | `shares.functions.ts` → `shortlist_shares` (token-gated) |
| Assistant chat | `client.assistant.tsx`, `admin.copilot.tsx` | `assistant.functions.ts`, `admin-copilot.functions.ts` (Lovable AI Gateway; gemini-2.5-flash default) |
| Role memory notes | `client.positions.$id.tsx` | `role-memory.functions.ts` → `role_memory` |
| Talent pool ops | `client.talent-pool.tsx` | `talent-pool.functions.ts` |
| Silver medalist tag | candidate detail dialog | `talent-memory.functions.ts` |
| Team invites | `client.team.tsx`, `admin.team.tsx` | `admin.functions.ts` |
| Auth (email + Google) | `login.tsx`, `auth.tsx`, `reset-password.tsx` | Supabase Auth + `lovable.auth.signInWithOAuth("google", ...)` |
| Pipeline run trigger (admin) | `admin.operations.tsx` | `api/public/pipeline.run.ts` (secured) |
| QA seed (dev only) | — | `api/public/qa-seed.ts` (guarded by `QA_SEED_TOKEN`) |

---

## 5. Integrations

- **Supabase (Lovable Cloud)** — Postgres, Auth, Storage (`cvs` private bucket), Realtime.
- **Lovable AI Gateway** — `LOVABLE_API_KEY`; models: `google/gemini-2.5-flash` default, `google/gemini-2.5-pro` for reasoning-heavy jobs (CV extraction, evidence scoring, assistant answers).
- **Lovable Auth broker** — Google OAuth.
- **No third-party analytics / no external CRM / no external email provider** currently wired.

Environment (server): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `LOVABLE_API_KEY`,
`QA_PERSONA_PASSWORD`, `QA_SEED_TOKEN`, `MASTER_ADMIN_ROTATED_AT`.
Client env (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`.

---

## 6. Background jobs & realtime

- `processing_jobs` — CV extract, evidence extract, score run.
- Kicked by `apply.functions.ts` post-insert; retriable via `admin.operations.tsx`.
- Workers: `cv-extractor.server.ts`, `candidate-insights.server.ts`,
  `scoring-engine.server.ts` (invoked from server fns / api routes; no external
  queue — Cloudflare-safe module set).
- Realtime: `src/hooks/use-realtime-refresh.ts` subscribes to `notifications`
  and pipeline tables to refresh dashboards.

---

## 7. Feature reality classification

Classification for every capability. **This is Phase 1's core deliverable** —
future prompts should not treat "sample data" as real.

| Feature | Reality | Notes |
|---|---|---|
| Public marketing pages (home, about, how-it-works, platform, industries × 57, blog, pricing) | Real content, static | Copy is real; no live counters. |
| ROI calculator | Real math | Formula in `pricing-core.ts`; no persistence. |
| Contact / inquiry forms | Real | Writes to `contact_messages` / `marketing_inquiries`. |
| Job board + apply | Real end-to-end | Public reads via `TO anon` on `positions` where status=active. |
| CV parse + scoring | Real | Gemini 2.5 Flash extraction, deterministic scoring; admin can rerun. |
| Client dashboard core (positions, candidates, decisions, messages, interviews, offers) | Real | Empty states expected for new tenants. |
| Admin dashboard (intake queue, publish desk, candidate ops, team, health) | Real | Health page reflects live table counts. |
| Talent memory / talent pool / silver medalist | Real | Writes/reads through server fns. |
| Client & admin AI assistants | Real (grounded) | Uses Lovable AI Gateway; conversation persisted. |
| Executive Portfolio (`client.executive.tsx`, `client.portfolio.tsx`) | Real — degrades gracefully | Portfolio returns empty state for non-parent orgs (fixed earlier). |
| Weekly Business Review (`admin.wbr.tsx`) | Real | Aggregates over live data. |
| Boardroom / pitch pages | Real live data (`boardroom`) & real content (`pitch`) | No fake demos. |
| Share links | Real | Token-gated, read-only, expires. |
| Support Mode ("view as client") | Real | Scrubbed DTO + write assertion. |
| Retention / GDPR tables | **Schema only** | No writers wired yet; UI does not surface them. |
| Outreach / source-of-hire | **Tables retained, UI removed** | Do not re-surface without new spec. |
| QA seed route | **Dev-only** | Gated by `QA_SEED_TOKEN`; must never be triggered in prod. |
| `dev.catalogue.tsx` | **Dev-only** | Component gallery; keep, mark clearly. |

**No feature currently ships fake success states, decorative-only buttons, or
invented testimonials that were identified in this audit.** If any are found in
later prompts, remove them.

---

## 8. Current state coverage (loading / empty / error / success)

Spot-check across representative routes (documentation only — not changed):

| Route class | Loading | Empty | Error | Success feedback |
|---|---|---|---|---|
| Public marketing | n/a | n/a | route-level error boundary present | n/a |
| Job board / apply | Skeleton | "No open roles" | `errorComponent` + toast on submit fail | Success page + reference id |
| Admin index / publish | Skeleton | Empty tables render | Boundary present | Toasts on approve/decline |
| Client index (org missing) | Skeleton | "No workspace yet" (platform admin path) | Portfolio degrades to empty | Toasts on decisions |
| Candidate `me.applications` | Skeleton | "No applications" | Boundary | Realtime refresh on stage change |
| Assistant / copilot | Streaming placeholder | New-thread state | Toast + retry | Message committed to db |

Areas flagged for later hardening (do not change in this prompt):
- Some admin pages surface hard errors via `throw` rather than empty-state
  fallbacks (target future prompt).
- A few Link-with-dynamic-params usages are missing `params` — see §9.

---

## 9. Known baseline failures (pre-existing, **not caused by future work**)

Recorded so future diffs are attributable.

**TypeScript (`bunx tsgo --noEmit`):** 2 errors, both in
`src/routes/_authenticated/admin.publish.tsx`:
- L251: `<Link to="/client/candidates/$id">` missing `params`.
- L274: same.

**ESLint (`bun run lint`):** 17204 errors (17180 auto-fixable), 27 warnings.
Almost entirely `prettier/prettier` formatting drift across the tree. No
semantic lint failures observed in the sample checked. Recommendation for a
later, isolated prompt: run `bun run lint --fix` in one dedicated commit; do
not mix with feature work.

**Build (`vite build` / `build:dev`):** the harness builds automatically after
edits; no build failure is currently attributed to the app code path — the
2 TS errors above are tsgo-only (no-emit) and do not block the Vite build.

**Runtime:** no active runtime errors reported in the preview console at the
time of this baseline.

---

## 10. Migration & data safety posture

- All schema changes flow through `supabase--migration` (see
  `docs/technical/migrations.md`).
- Forward-only. Compensating migrations, not edits.
- `CREATE TABLE` in `public` is always paired with `GRANT` in the same
  migration.
- Time-dependent invariants use triggers, not `CHECK`.
- Data-only changes go through `supabase--insert`, never migrations.
- **Production data is never touched from dev.** Sample data lives on
  clearly-labeled routes only (`dev.catalogue.tsx`, `qa-seed.ts` gated by
  `QA_SEED_TOKEN`). No route currently mixes real and demo data on the same
  screen.

**Reversibility procedure for schema changes (future prompts):**
1. Author the forward migration via `supabase--migration`.
2. In the same PR, author a compensating migration file (kept in
   `supabase/migrations/` alongside the forward one, prefixed
   `revert_<forward-name>.sql`).
3. Never `DROP` a column touched by application code in the same migration
   that renames/replaces it; land in two phases (add + backfill, then remove).
4. Never `TRUNCATE` a production table from a migration.

---

## 11. Smoke-test foundation (future work, not started)

Not implemented in this prompt (per direction: "add a simple smoke-test
foundation"). Recommended shape for the next prompt:

- `tests/smoke/routes.spec.ts` — Playwright, boots `bun run build && bun run preview`,
  hits every route in §1.1 and the top-level authenticated shells with an
  anonymous session, asserts `!== 404 fallback` and no console error.
- Feed the route list from a generated manifest so it can't drift.

---

## 12. Acceptance check for Prompt 1

- App still builds — ✅ (Vite build path healthy; only 2 tsgo errors pre-existing).
- No user-facing behavior intentionally changed — ✅ (no code edits in this pass).
- Current routes and data models documented — ✅ (§1, §2).
- Migration reversibility recorded — ✅ (§10).
- Production vs demo data boundary recorded — ✅ (§7, §10).
- Baseline technical failures known — ✅ (§9).

Next prompt can safely start Phase 1 improvements against this baseline.
