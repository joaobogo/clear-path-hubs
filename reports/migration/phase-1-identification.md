# TAASFLOW V2 MIGRATION — PHASE 1 REPORT
Read-only environment identification. No code, data, Auth, Storage, domains or deployments were modified.

## ORIGINAL_PROJECT_MAP — Talent Streamline (reference / legacy)
- Lovable project name: **Talent Streamline**
- Lovable project ID: `079e56b8-9e44-4daa-bd34-e20508902988`
- Published URL: https://sourcing-suite-ai.lovable.app
- GitHub repository: `joaobogo/sourcing-suite-ai` (per user; not queryable from here)
- Current Git commit: not accessible from this workspace (owned by another Lovable project)
- Backend type: Supabase (self-managed / not Lovable-Cloud-managed from this workspace)
- Supabase project ref: `qldhdrxdnrnwbkaxozno` (URL: https://qldhdrxdnrnwbkaxozno.supabase.co)
- Auth implementation: Supabase Auth (`@supabase/supabase-js`), custom `useAuth` hook + `ProtectedRoute`, `GatedAdminModule`; email/password + `ResetPassword`; consent + tracking wired via `initializeTrackers`
- Routing: `react-router-dom` v6 with `App.tsx` renderRoutes and legacy locale prefixes (`ar/es/fr/de/nl/it/pt/da/ko/ja`)
- Public routes (from `src/pages/`): `/` (Index), `/how-it-works`, `/taasflow-journey`, `/about`, `/pricing`, `/pilot`, `/pilot/overview`, `/pilot/intake`, `/pilot/confirmation`, `/enterprise`, `/faq`, `/contact`, `/resources`, `/blog`, `/blog/:category`, `/blog/:slug`, `/case-studies`, `/industries` + 22 industry subpages (Tech, Legal, Public Sector, Finance, Staffing Agencies, Healthcare, Sales, Marketing, HR, Accounting, Real Estate, SaaS, Ecommerce, Insurance, Construction, Hospitality, Media, NonProfit, Private Equity, Cybersecurity, Data Analytics, Consulting), `/industries/compare`, `/staffing-partnership`, `/talent-marketplace`, `/talent-network`, `/global-talent`, `/employer-onboarding`, `/candidate-success`, `/knowledge-base`, `/jobs`, `/jobs/:id`, `/apply-tracker`, `/privacy`, `/terms`, `/reset-password`, `/access-denied`, `/unauthorized`, `/404`
- Admin routes: `src/pages/admin/*` (gated via `GatedAdminModule`)
- Client routes: `/dashboard/client/*` (Overview, TalentDatabase, …) via `DashboardRouter`
- Candidate routes: `/candidate/*` (Auth, Join, Dashboard, Profile, PublicProfile, Messages, Unavailable, ReplaceCv)
- Job Board routes: `/jobs`, `/jobs/:id`
- Intake routes: `/pilot/intake`, `/pilot/confirmation`, `dev/intake-harness`
- Scoring services (Edge Functions): `score-candidate`, `score-candidate-shadow`, `recalculate-scores`, `backfill-scores`, `backfill-score-runs`, `forced-rescore-batch`, `mandatory-score-repair`, `full-assigned-candidate-scoring-sweep`, `regenerate-score-explanations`, `generate-scoring-criteria`, `calibrate-role`, `generate-role-blueprint`, `scoring-health-check`, `integrity-score-regenerate`
- Parsing services: `parse-cv`, `parse-candidate-cv`, `parse-jd`, `replay-parse-and-score`
- Enrichment services: `enrich-candidate-profile`, `force-enrich-and-score`, `improve-profile-quality`, `calculate-profile-completeness`, `backfill-candidate-profile-fields`, `backfill-profile-completeness`
- Messaging services: `relay-message`, `notify-client-high-score`, `notify-new-application`, `notify-status-change`, `notify-stale-reviews`, `notify-teams`, `send-email`, `resend-team-invite`, `resend-delivery-webhook`, `weekly-client-summary`, `incident-digest`, `interview-feedback-reminder`
- Total Edge Functions inventoried: **>110** (see `src/pages/` structure + `supabase/functions/` listing)
- Storage buckets: not accessible from this workspace (external Supabase project)
- Database tables: not accessible from this workspace (external Supabase project — needs original owner to run a schema dump)
- Current custom domain: `taasflow.com` (per user; needs live DNS/publish confirmation from that project owner)

## NEW_PROJECT_MAP — Clear Path Hubs (destination)
- Lovable project name: **Clear Path Hubs** (`1dc5ee7e-1294-441c-8288-850e79e443f6`)
- Published URL: https://clear-path-hubs.lovable.app
- Preview URL: https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app
- GitHub repository: not connected in this workspace snapshot
- Current commit (sandbox HEAD): `4368e3ffeb5b6c127de8437143b372708ab873cf`
- Backend type: **Lovable Cloud (managed Supabase)**
- Supabase project ref: `nfwetiyrxsrejdodvale` (URL: https://nfwetiyrxsrejdodvale.supabase.co), instance size Tiny, org `wpczgwxsriezaubncuom`
- Auth implementation: Supabase Auth via `@/integrations/supabase/client` + `_authenticated/route.tsx` gate + `requireSupabaseAuth` server-fn middleware; `attachSupabaseAuth` bearer attacher; `user_roles` + `has_role()`
- Routing: **TanStack Start** file-based (`src/routes/`)
- Public routes: `/` (index), `/auth`, `/login`, `/reset-password`, `/access-denied`, `/intake`, `/intake_.confirmation`, `/jobs`, `/jobs/:id`, `/jobs/:id/apply`, `/apply/received/:applicationId`, `/dev/catalogue`
- Admin routes (`_authenticated/admin.*`): index, candidates(+$id), clients(+$id, clients_new), positions(+$id), publish, notifications, health, team, settings
- Client routes (`_authenticated/client.*`): index, candidates(+$id), positions(+$id), messages, team, settings
- Candidate routes (`_authenticated/me.*`): index, applications(+$id), messages, profile, settings
- Job Board routes: `/jobs`, `/jobs/:id`, `/jobs/:id/apply`, `/apply/received/:applicationId`
- Intake routes: `/intake`, `/intake_.confirmation`, public API `POST /api/public/intake`
- Scoring services (server-only, in `src/lib/`): `scoring-service.server.ts` (canonical `executeScoring`), `scoring-engine.server.ts`, `pipeline-runner.server.ts`
- Parsing services: `cv-extractor.server.ts` (unpdf + mammoth), `cv-hydration.server.ts` (Gemini 2.5 Flash), `cv-validation.ts`
- Enrichment services: consolidated in `cv-hydration.server.ts` + `pipeline-runner.server.ts` (`HYDRATION_PARSER_VERSION`, `runHydrationOnly`, `runEnrichmentOnly`, `replaceCv`)
- Messaging services: realtime via `use-realtime-refresh.ts` + `messages` table; `notifications.functions.ts` + `notification_events`
- Edge Functions: **none** — all server logic uses TanStack `createServerFn` and `src/routes/api/public/*` route handlers (`intake.ts`, `intake-status.$id.ts`, `pipeline.run.ts`, `qa-seed.ts`, `bootstrap-admin.ts`)
- Database tables (46 in `public`): `admin_candidate_matches_view`, `admin_clients_view`, `admin_pipeline_health`, `admin_positions_view`, `admin_work_inbox`, `application_answers`, `applications`, `audit_events`, `candidate_evidence`, `candidate_matches`, `candidate_messages_view`, `candidate_my_applications`, `candidate_profile_view`, `candidate_profiles`, `client_candidate_matches_view`, `client_dashboard_kpis`, `client_decisions`, `client_kanban_view`, `client_messages_view`, `client_positions_view`, `consent_records`, `cost_limits`, `data_subject_requests`, `export_jobs`, `files`, `intake_submissions`, `interviews`, `memberships`, `messages`, `notification_deliveries`, `notification_events`, `notifications`, `organizations`, `positions`, `processing_jobs`, `profiles`, `provider_usage_events`, `retention_policies`, `retention_runs`, `saved_views`, `score_decisions`, `score_runs`, `screening_questions`, `support_actions`, `support_sessions`, `trace_index`, `user_roles`
- Storage buckets: `cvs` (private, scoped RLS per Phase 3)
- Current record counts: organizations=12, profiles=32, positions=29, candidate_profiles=100, applications=98, candidate_matches=98, score_runs=11, files=18, messages=0, audit_events=473
- Current custom domain: none (published on `clear-path-hubs.lovable.app`)

## ENVIRONMENT_CONFLICTS
1. **Two separate Supabase projects** — legacy `qldhdrxdnrnwbkaxozno` vs new `nfwetiyrxsrejdodvale`. No shared Auth, no shared Storage, no shared data. A canonical database must be chosen in Phase 3.
2. **Different tech stacks** — legacy is Vite + React Router DOM + Supabase Edge Functions (110+). New is TanStack Start + Cloudflare Workers + `createServerFn` (no Supabase Edge Functions). Legacy edge functions cannot be lifted 1:1; each must be reclassified as server-fn / server-route / DB function / cron.
3. **Auth model differs** — legacy uses email/password + custom guards + i18n locale prefixes; new uses Supabase Auth + integration-managed `_authenticated/` layout + `user_roles` RLS. Auth users cannot be silently merged.
4. **Domain ownership** — `taasflow.com` currently points to the legacy Talent Streamline project (per user). New project has no custom domain. Cutover must be coordinated.
5. **Route naming** — legacy `/pilot/intake` vs new `/intake`; legacy `/dashboard/client/*` vs new `/_authenticated/client.*`. Redirect map required.
6. **i18n / locales** — legacy ships 10 legacy locales that redirect to English. New project has no i18n. Decision required before public site migration.
7. **Storage** — legacy CV/asset buckets are unknown from this workspace; new project has only `cvs`. Content buckets (blog images, brand assets) must be planned.
8. **Legacy DB schema is opaque** — cross-project tools cannot introspect the legacy Supabase (`qldhdrxdnrnwbkaxozno`). Phase 3 comparison requires either (a) an SQL dump from the legacy project owner, or (b) `supabase--read_query` access being granted to that ref.

## MISSING_ACCESS
- Legacy Supabase (`qldhdrxdnrnwbkaxozno`) — no read access from this workspace; cannot enumerate tables, views, functions, buckets, record counts, RLS policies, or Auth users.
- Legacy Storage buckets and object counts.
- Legacy Auth user list and MFA/OAuth provider configuration.
- Legacy Edge Function secrets and cron schedules.
- Legacy GitHub repo (`joaobogo/sourcing-suite-ai`) — not linked to this Lovable workspace; commit SHA not available.
- New project GitHub repo linkage — not configured.
- DNS control for `taasflow.com` (registrar + current A/CNAME + TXT verification).
- Cross-project workspace confirmation — both projects share owner `joaoluciano9812@gmail.com`; `cross_project--list_projects` lists both, so **cross-project referencing works** (confirmed).

## DETERMINATIONS
- Same workspace? **Yes** (both owned by `joaoluciano9812@gmail.com`; both visible via `cross_project--list_projects`).
- Cross-project referencing works? **Yes** (verified — read Talent Streamline files successfully).
- New project has a GitHub repo? **Not connected** in this workspace.
- Both apps use different Supabase projects? **Yes** — `qldhdrxdnrnwbkaxozno` (legacy) vs `nfwetiyrxsrejdodvale` (new).
- Which DB contains production clients/candidates/CVs/Auth users/complete scoring history? **Legacy `qldhdrxdnrnwbkaxozno`** is the presumed production system (needs Phase 3 read-only comparison to confirm record counts). The new project contains only QA seed data (12 orgs, 100 candidates, 98 applications, 11 score runs — all synthetic).
- Which project currently controls `taasflow.com`? **Legacy Talent Streamline** (per user; needs DNS confirmation).

## VERDICT
**PASS (with caveats).** Both projects are discoverable and cross-referenceable. Legacy DB schema/records and DNS control require external input from the owner before Phase 3 can produce a numeric comparison.

## NEXT ACTIONS REQUIRED FROM OWNER
1. Confirm `taasflow.com` DNS control account.
2. Provide read-only access to Supabase project `qldhdrxdnrnwbkaxozno` (or a full `pg_dump --schema-only` + row counts) so Phase 3 can produce a real per-entity migration map.
3. Confirm which GitHub org/repo should back the new project after cutover.
