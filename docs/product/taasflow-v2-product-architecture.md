# TaaSFlow V2 — Product Architecture (Locked)

**Status:** Architecture lock. No implementation in this phase.
**Repository branch:** `edit/edt-5fbbae72-5375-4b0f-94cf-5e56373d14fb`
**Repository SHA:** `fcbd8472139f8bd78b4db3acfc10066d29bcbdeb`
**Deployed frontend SHA:** matches repository SHA above (Lovable auto-deploys HEAD of the working branch to the preview URL; the published URL redeploys on explicit publish).
**Backend project ref:** `nfwetiyrxsrejdodvale` (single canonical Supabase project — Lovable Cloud)
**Migration head:** `20260722214417_27616daf-aeff-43b6-aac0-b0e043999227.sql`
**Preview URL:** https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app
**Published URL:** https://clear-path-hubs.lovable.app

## 1. Canonical application definition

TaaSFlow V2 is one application with one database and one backend. It is composed of eleven surfaces:

1. **Public marketing website** — same-origin marketing pages, sitemap, robots, blog, industries.
2. **Employer intake** — 5-step wizard + idempotent server function + `/api/public/intake` POST route.
3. **Job Board** — public listing, detail, application entry.
4. **Candidate application** — CV upload + application form + reference IDs.
5. **Authentication + onboarding** — Supabase Auth (email/password + Google), master admin, `has_role()` SECURITY DEFINER, `is_org_member()`, role gating in `_authenticated` layout.
6. **Admin workspace** — universal candidate drawer, publish desk, support-mode view-as-client, org management.
7. **Client workspace** — Kanban with `STAGE_GRAPH` enforcement, decisions, messages, KPIs.
8. **Candidate workspace** — application tracking, realtime chat.
9. **Candidate-processing pipeline** — queued → parsing → hydrated → evidence → scored (+ `manual_review_required`, `failed`).
10. **Evidence-based role-specific scoring** — `candidate_evidence` per requirement, `score_runs` immutable via trigger, `final = min(raw, cap)`.
11. **Client publication + decision workflow** — publication gates, `moveMatchStage`, stage graph, audit trail.

## 2. Public route map

See `taasflow-v2-route-map.json` for the machine-readable version. Highlights:

- Marketing surface: `/`, `/solutions`, `/industries` (+ `$slug`), `/enterprise`, `/how-it-works`, `/pricing`, `/journey`, `/about`, `/resources`, `/blog` (+ `$slug`), `/contact`, `/privacy`, `/terms`.
- Product entry: `/jobs`, `/jobs/$id`, `/jobs/$id/apply`, `/get-started`.
- Auth: `/auth` (canonical), `/reset-password`, redirects from `/login` and `/signup`.
- Infra: `/sitemap.xml` (server route), `/robots.txt`.

Every marketing leaf sets canonical + og:url through `src/lib/marketing/head.ts`. Root sets sitewide defaults only.

## 3. Workspace route map

Authenticated under `_authenticated/` layout gate (redirects to `/auth`).

- **Admin:** `/admin`, `/admin/positions`, `/admin/positions/$id`, `/admin/candidates`, `/admin/candidates/$id`, `/admin/publish-desk`, `/admin/organizations`, `/admin/organizations/$id`, `/admin/support-mode`, `/admin/settings`.
- **Client:** `/client`, `/client/positions`, `/client/positions/$id`, `/client/candidates/$id`, `/client/decisions`, `/client/messages`, `/client/settings`.
- **Candidate:** `/candidate`, `/candidate/applications`, `/candidate/applications/$id`, `/candidate/messages`, `/candidate/profile`.

Role enforcement: `has_role(auth.uid(), 'platform_admin' | 'client' | 'candidate')` at RLS and `has_role()` guard in server functions. Support mode requires an active `interactive` session for admin mutations against client tables (`assertNotSupportViewReadOnly`).

## 4. Canonical backend

- **Single Supabase project:** `nfwetiyrxsrejdodvale`.
- **Single database.** No dual-writes, no legacy mirror.
- **Storage:** private `cvs` bucket with scoped RLS.
- **Auth:** Supabase Auth, Google + email/password. Master admin: `kasprzakjoao@taasflow.com`.
- **Edge functions:** only new V2 functions; no legacy function URLs.
- **Server logic:** TanStack `createServerFn` (`*.functions.ts`) for app-internal calls; `/api/public/*` file routes for external callers (intake webhook currently the only one).

## 5. Preserved new-system components (do not replace)

| Area | Modules |
|---|---|
| Intake | `src/lib/intake-schema.ts`, `src/lib/intake.functions.ts`, `src/routes/api/public/intake.ts`, 5-step wizard |
| Job Board | `src/routes/jobs.tsx`, `src/routes/jobs.$id.tsx`, `src/routes/jobs.$id.apply.tsx`, `src/lib/apply-schema.ts`, `src/lib/apply.functions.ts` |
| Auth | `_authenticated/route.tsx` gate, `is_org_member()`, `has_role()`, `is_master_admin` flag + unique index |
| Admin | `src/routes/_authenticated/admin.*`, `src/components/candidate-detail-drawer.tsx`, `src/lib/admin-candidate-edit.functions.ts` |
| Client | `src/routes/_authenticated/client.*`, Kanban with `STAGE_GRAPH`, `moveMatchStage`, `clientAction`, `sendClientMessage` |
| Candidate | `src/routes/_authenticated/candidate.*`, realtime chat via Supabase subscriptions |
| Pipeline | `src/lib/pipeline-runner.server.ts`, `src/lib/processing.functions.ts`, `ProcessingCode` (`missing_usable_cv`, etc.) |
| Scoring | `src/lib/scoring-service.server.ts`, `src/lib/scoring-engine.server.ts`, `score_runs` immutability trigger |
| Evidence | `candidate_evidence` table, admin review before publication |
| Notifications | `notification_events`, `src/hooks/use-realtime-refresh.ts` |
| Support mode | `assertNotSupportViewReadOnly`, `interactive` session, audit trail |
| Design system | `src/components/ds/*`, OKLCH tokens in `src/styles.css` |
| Marketing shell | `src/components/marketing/*`, `src/lib/marketing/content.ts`, `src/lib/marketing/head.ts`, `src/routes/sitemap[.]xml.ts` |

## 6. Excluded legacy components

See `legacy-exclusion-rules.md`. Summary: no legacy DB, Supabase project, edge functions, dashboard code, Job Board logic, intake handlers, application handlers, parsing/scoring code, or user/candidate data is imported.

## 7. Unresolved architecture decisions

1. **`/solutions` and `/journey` scope.** Neither exists on the source at parity — need product owner to define whether `/solutions` is a real IA node or a redirect to `/industries`, and whether `/journey` is a merge of `/about` timeline or a standalone brand narrative.
2. **`/get-started` behavior.** Redirect to `/intake` (fast path) vs. lightweight qualifier form vs. two-CTA landing (pilot vs enterprise) — pending product owner decision.
3. **VERIFY-flagged claims from `public-content-inventory.md`** (13 items) — pricing, timelines, geography, volumes, guarantees, compliance posture. Blocks publishing hero, pricing, pilot, about, case-studies, global-talent, privacy, terms.
4. **Blog re-crawl policy.** 232 sparse articles remain; run single-threaded re-crawl before enabling them in the sitemap decision list, or accept the 72 rich subset as MVP.
5. **Domain strategy.** Custom domain vs. `clear-path-hubs.lovable.app` for the launch — affects canonical URLs baked into `marketing/head.ts` and `sitemap[.]xml.ts`.
6. **Master admin recovery.** Break-glass process for `is_master_admin` when the single canonical admin loses access — not yet documented.
7. **Client publication SLA.** No formal target for "time from `scored` to client-visible" — required to substantiate the "14-day first shortlist" claim.
