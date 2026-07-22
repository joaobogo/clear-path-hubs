# Phase 01 — Original Project Map (Talent Streamline)

## Identity
| Field | Value |
|---|---|
| Lovable project name | Talent Streamline |
| Lovable project ID | `079e56b8-9e44-4daa-bd34-e20508902988` |
| Owner | joaoluciano9812@gmail.com |
| Workspace | Same workspace as new project (confirmed via `cross_project--list_projects`) |
| Published URL | https://sourcing-suite-ai.lovable.app |
| Preview URL | not accessible to this workspace |
| Custom domain | `taasflow.com` (per user; not queryable from here) |
| Publication status | Published, public visibility |
| GitHub repository | `joaobogo/sourcing-suite-ai` (per user; **linkage cannot be programmatically verified from this workspace** — Lovable tools do not expose the peer project's git-integration record) |
| Active branch | Not queryable |
| Current repo SHA | Not queryable |
| Deployment SHA | Not queryable |

## Backend
| Field | Value |
|---|---|
| Backend provider | Supabase (self-managed, **not** Lovable-Cloud-managed from this workspace) |
| Supabase project ref | `qldhdrxdnrnwbkaxozno` |
| Supabase URL | https://qldhdrxdnrnwbkaxozno.supabase.co |
| Anon key (public, published in project `.env`) | present |
| Auth provider | Supabase Auth (`@supabase/supabase-js`), custom `useAuth` + `ProtectedRoute` + `GatedAdminModule`, email/password, `/reset-password` |
| Storage provider | Supabase Storage (bucket inventory not accessible from this workspace) |
| Edge Function environment | Supabase Edge Functions (Deno), `supabase/functions/*` with per-function `verify_jwt` in `supabase/config.toml` |
| Environment type | Production (owns `taasflow.com`) |

## Code fingerprint
- Framework: Vite + React 18 + React Router DOM 6.30 + TypeScript + shadcn/ui + Tailwind + i18next
- Providers: `@supabase/supabase-js` 2.91, `@tanstack/react-query` 5, `react-helmet-async`, `framer-motion`, `three`, `recharts`
- Test/QA harness: Playwright, Vitest, `scripts/qa/*`, extensive audit CLI (`quality:gate`, `test:ci`, `qa:actions`, `qa:mutations`)
- SSR: none (SPA served via `public/_redirects`)
- Legacy locales: 10 (`ar/es/fr/de/nl/it/pt/da/ko/ja`) all redirect to English

## Edge Functions (110+ inventoried)
Full list in `docs/migration/phase-01-processing-comparison.md`. High-signal groupings:
- **Intake / applications**: `submit-intake`, `get-intake-status`, `submit-guest-application`, `submit-quick-application`, `submit-lead`, `submit-replacement-cv`, `request-cv-replacement`, `release-qa-intake`, `link-guest-applications`, `bulk-repair-application-links`
- **CV / parsing / OCR**: `parse-cv`, `parse-candidate-cv`, `parse-jd`, `replay-parse-and-score`, `serve-cv`, `danger-band-cv-url`
- **Enrichment**: `enrich-candidate-profile`, `force-enrich-and-score`, `improve-profile-quality`, `calculate-profile-completeness`, `backfill-candidate-profile-fields`, `backfill-profile-completeness`
- **Scoring**: `score-candidate`, `score-candidate-shadow`, `recalculate-scores`, `backfill-scores`, `backfill-score-runs`, `backfill-rescore`, `forced-rescore-batch`, `mandatory-score-repair`, `full-assigned-candidate-scoring-sweep`, `regenerate-score-explanations`, `admin-regenerate-score-explanations`, `generate-scoring-criteria`, `generate-role-blueprint`, `calibrate-role`, `run-calibration`, `scoring-health-check`, `integrity-score-regenerate`
- **Screening / matching**: `match-candidates`, `rank-talent`, `generate-jd`, `generate-screening-questions`, `recommended-jobs`
- **Notifications / messaging**: `relay-message`, `notify-new-application`, `notify-client-high-score`, `notify-stale-reviews`, `notify-status-change`, `notify-teams`, `send-email`, `resend-team-invite`, `resend-delivery-webhook`, `weekly-client-summary`, `incident-digest`, `interview-feedback-reminder`, `check-consent-expiry`
- **Integrity / repair / anomaly**: `integrity-command-centre`, `integrity-evidence-mismatch-scan`, `integrity-explanation-review`, `integrity-full-corpus-scan`, `integrity-metrics-collector`, `integrity-nightly-orchestrator`, `integrity-predeploy-gate`, `integrity-repair-executor`, `integrity-repair-planner`, `integrity-scan`, `detect-anomalies`, `detect-anomalies-compare`, `detect-anomalies-v2`, `anomaly-auto-resolver`, `audit-contradictions`, `audit-profile-hygiene`, `data-hygiene-actions`, `bulk-repair-execute`, `bulk-reclassify-submissions`, `mandatory-score-repair`, `selected-records-bulk-repair`, `snapshot-orphan-link-counts`, `reconcile-*` (3), `repair-*` (5), `recover-application-from-backup`, `recover-abuse-guard`
- **Team / user mgmt**: `create-team-member`, `manage-team-member`, `list-team-member-status`, `manage-client-users`, `revoke-user-session`, `list-user-sessions`, `delete-tenant`, `delete-application`, `delete-candidate`, `delete-candidate-account`, `repair-client-access`, `resend-team-invite`
- **Campaigns / QA / misc**: `prime-global-campaign`, `ask-taasflow` (chat), `qa-health-console`, `qa-seed-medical-writer`, `issue-simple-captcha`, `issue-simple-security-code`, `signup-abuse-guard`, `log-profile-view`, `evaluate-alerts`, `close-stale-journey-incidents`, `admin-run-candidate-queue`, `admin-run-repair-stuck-candidates`, `admin-retry-candidate-processing`, `process-candidate-queue`, `repair-candidate-processing`, `repair-stuck-candidate-processing`, `replay-notification`, `replay-parse-and-score`, `reconcile-marketplace-previews`

`verify_jwt = false` (public callable): `notify-teams`, `submit-guest-application`, `application-health-check`, `release-qa-intake`, `submit-intake`, `get-intake-status`, `submit-lead`, `submit-quick-application`, `submit-replacement-cv`, `resend-delivery-webhook`.
All others default to `verify_jwt = true`.

## Migration count
`supabase/migrations/` contains **671 SQL migrations** (approx.); indicative of heavy schema churn — a Phase 3 canonical-DB pick should not attempt a straight file replay.

## Public web assets
- Brand: `src/assets/logo-on-blue.png`, `logo-on-white.png`, `icon-white.png`, `world-map-dark.png`, `world-map-realistic.jpg`
- Founder portraits: `chris.jpg`, `christian.jpg`, `joao.jpg`
- 22 industry hero JPGs under `src/assets/industries/`
- 44 blog hero JPGs under `src/assets/blog/`
- Enterprise heroes: `hero-dashboard-cards.jpg`, `hero-globe-network.jpg`
- SEO: `public/robots.txt`, `og-image.png`, `favicon.{ico,png}`, `sitemap.xml` + `sitemap-{blog,industries,jobs,pages}.xml`, `llms.txt`, `.well-known/security.txt`, `_headers`, `_redirects`

## Missing access
- Direct SQL against `qldhdrxdnrnwbkaxozno` (no `supabase--read_query` binding for that ref in this workspace).
- Storage bucket list / file counts.
- Auth user counts + provider settings.
- Cron / pg_cron schedules.
- Edge Function secrets and per-env variables.
- GitHub commit SHA and branch state.
- Custom-domain DNS record snapshot.
