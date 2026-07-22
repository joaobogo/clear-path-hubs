# Phase 01 — New Project Map (Clear Path Hubs → TaaSFlow V2)

## Identity
| Field | Value |
|---|---|
| Lovable project name | Clear Path Hubs |
| Lovable project ID | `1dc5ee7e-1294-441c-8288-850e79e443f6` |
| Owner | joaoluciano9812@gmail.com |
| Workspace | Same as Talent Streamline |
| Published URL | https://clear-path-hubs.lovable.app |
| Preview URL | https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app |
| Custom domain | **none** |
| Publication status | Published, public |
| GitHub repository | **NEW_GITHUB_NOT_CONNECTED** (no repo linked in this workspace snapshot) |
| Active branch | n/a |
| Sandbox HEAD SHA | `4368e3ffeb5b6c127de8437143b372708ab873cf` |
| Deployment SHA | equal to sandbox HEAD after publish |

## Backend
| Field | Value |
|---|---|
| Backend provider | **Lovable Cloud** (managed Supabase) |
| Supabase project ref | `nfwetiyrxsrejdodvale` |
| Organization | `wpczgwxsriezaubncuom` |
| Instance size | Tiny |
| Paused | false |
| Supabase URL | https://nfwetiyrxsrejdodvale.supabase.co |
| Auth provider | Supabase Auth via `@/integrations/supabase/client` + integration-managed `_authenticated/route.tsx` gate + `requireSupabaseAuth` server-fn middleware; `user_roles` + SECURITY-DEFINER `has_role()` |
| Storage provider | Supabase Storage — **1 bucket** (`cvs`, private, 18 objects) |
| Edge Function environment | **none** — all server logic runs in TanStack Start server functions (`createServerFn`) and file-based server routes under `src/routes/api/public/*` executed on Cloudflare Workers |
| Environment type | QA / staging (no production traffic; all data is seeded) |

## Code fingerprint
- Framework: **TanStack Start v1** + React 19 + Vite 7 + TypeScript strict + Tailwind v4 + shadcn/ui + TanStack Query
- Router: file-based (`src/routes/`), auto-generated `src/routeTree.gen.ts`
- SSR: on for public routes; `ssr: false` for `_authenticated/` layout
- No i18n

## Routes (33 files)
Public (13): `__root.tsx`, `index.tsx`, `auth.tsx`, `login.tsx`, `reset-password.tsx`, `access-denied.tsx`, `intake.tsx`, `intake_.confirmation.tsx`, `jobs.index.tsx`, `jobs.$id.index.tsx`, `jobs.$id.apply.tsx`, `apply.received.$applicationId.tsx`, `dev.catalogue.tsx`

`_authenticated/` layout gate + 25 child routes:
- Admin (10): `admin.tsx` layout, `admin.index.tsx`, `admin.candidates.tsx`, `admin.candidates.index.tsx`, `admin.candidates.$id.tsx`, `admin.clients.tsx`, `admin.clients.index.tsx`, `admin.clients.$id.tsx`, `admin.clients_new.tsx`, `admin.positions.tsx`, `admin.positions.index.tsx`, `admin.positions.$id.tsx`, `admin.publish.tsx`, `admin.notifications.tsx`, `admin.health.tsx`, `admin.team.tsx`, `admin.settings.tsx`
- Client (8): `client.tsx`, `client.index.tsx`, `client.candidates.tsx`, `client.candidates.index.tsx`, `client.candidates.$id.tsx`, `client.positions.tsx`, `client.positions.index.tsx`, `client.positions.$id.tsx`, `client.messages.tsx`, `client.team.tsx`, `client.settings.tsx`
- Candidate (6): `me.tsx`, `me.index.tsx`, `me.applications.tsx`, `me.applications.index.tsx`, `me.applications.$id.tsx`, `me.messages.tsx`, `me.profile.tsx`, `me.settings.tsx`

Server routes: `src/routes/api/public/{bootstrap-admin,intake,intake-status.$id,pipeline.run,qa-seed}.ts`

## Service layer (`src/lib/`)
`admin.functions.ts`, `admin-candidate-edit.functions.ts`, `apply.functions.ts`, `apply-schema.ts`, `auth.functions.ts`, `candidate.functions.ts`, `client.functions.ts`, `client-kpi.server.ts`, `cv-download.functions.ts`, `cv-extractor.server.ts` (unpdf + mammoth), `cv-hydration.server.ts` (Gemini 2.5 Flash), `cv-validation.ts`, `intake-schema.ts`, `jobs.functions.ts`, `notifications.functions.ts`, `pipeline-runner.server.ts`, `processing.functions.ts`, `roles.ts`, `scoring-engine.server.ts`, `scoring-service.server.ts` (canonical `executeScoring`), `search.functions.ts`, `support.functions.ts`, `support-view.ts`, `use-client-org.ts`.

## Database (46 objects in `public` — see `phase-01-database-comparison.md`)
Current row counts (QA seed):
| Table | rows |
|---|---|
| organizations | 12 |
| profiles | 32 |
| memberships | 30 |
| user_roles | 16 |
| auth.users | 32 |
| positions | 29 |
| screening_questions | 12 |
| applications | 98 |
| application_answers | 6 |
| candidate_profiles | 100 |
| candidate_matches | 98 |
| candidate_evidence | 26 |
| score_runs | 11 |
| score_decisions | 3 |
| client_decisions | 6 |
| interviews | 0 |
| messages | 0 |
| notifications | 32 |
| intake_submissions | 6 |
| processing_jobs | 154 |
| audit_events | 473 |
| trace_index | 0 |
| files | 18 |

## Missing / not yet built
- No public marketing pages beyond `/` (no About, Pricing, Enterprise, Industries, FAQ, Contact, Resources, Blog, Case Studies, Journey, Knowledge Base, Legal, Talent Marketplace, Talent Network, Global Talent, Employer Onboarding, Candidate Success, Application Tracker at `/applications/track/:id`, Staffing Partnership)
- No brand assets (logo, industry heroes, blog images, world map, founder photos)
- No sitemaps, robots, `og-image.png` beyond template
- No GitHub linkage
- No custom domain
- No i18n (legacy locales absent — decision required)
