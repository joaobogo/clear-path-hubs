# Phase 01 — Dashboard Comparison

Legend: **O_ONLY** = original only, **N_ONLY** = new only, **BOTH** = both,
**O_BETTER** / **N_BETTER** = both present but one is stronger, **BOTH_INCOMPLETE**, **MISSING_FROM_BOTH**.

## Admin

| Capability | Original | New | Verdict |
|---|---|---|---|
| Clients list | Yes (`AdminClients`, ClientVisibilityAudit) | Yes (`/admin/clients`, `admin.clients.index.tsx`) | BOTH |
| Client detail | Yes (part of consolidated Clients) | Yes (`/admin/clients/$id`, 13 org fields, archive) | **N_BETTER** (canonical `updateOrganization`) |
| Client editing (13 canonical fields, audit) | Partial (many edge fns for repair) | Full canonical service | **N_BETTER** |
| Users / team | `manage-client-users`, `create-team-member`, `manage-team-member`, `resend-team-invite` | `/admin/team` + `getClientCandidatesForOrg` | O_BETTER on features count; N_BETTER on canonical service purity |
| Positions | Yes (`AdminRequisitionsWorkspace`) | Yes (`/admin/positions`, `/admin/positions/$id`) | BOTH_INCOMPLETE — new lacks blueprint/calibration; original lacks canonical service purity |
| Candidates | Yes (`CandidateUniverse`, `AdminCandidates`) | Yes (`/admin/candidates`, 13-column workspace) | BOTH |
| Candidate detail | Yes (numerous specialty pages) | Yes — universal `CandidateDetailDrawer` (12 tabs, role-switching) | **N_BETTER** |
| CV access (download / signed URL) | Yes (`serve-cv`) | Yes (`cv-download.functions.ts`, `DownloadCvButton`) | BOTH |
| Parsing (parse-cv / parse-candidate-cv) | Yes (2 edge fns + reparse workflow) | Yes (`cv-extractor.server.ts` + `cv-hydration.server.ts`, retry/rescore/replace in drawer) | N_BETTER (single canonical pipeline) |
| Enrichment | Many edge fns (`enrich-candidate-profile`, `force-enrich-and-score`, `improve-profile-quality`) | Consolidated in `cv-hydration.server.ts` + `pipeline-runner.server.ts` | N_BETTER |
| Scoring | Many edge fns (`score-candidate`, `recalculate-scores`, `backfill-*`, `mandatory-score-repair`, `full-assigned-scoring-sweep`) | **Single canonical `executeScoring`** in `scoring-service.server.ts`; immutable score_runs trigger | **N_BETTER** |
| Score evidence | `integrity-evidence-mismatch-scan` | `candidate_evidence` table + drawer tab | N_BETTER |
| Client Preview (view-as) | `qa/ClientPreview` (admin-only route) | `support_sessions`/`support_actions` + `use-client-org.ts` + `ActionGuard` disables mutations | N_BETTER (persistent, audited) |
| Publication desk | Yes (`AdminPublishDesk` consolidated) | Yes (`/admin/publish`) | BOTH |
| Messages | Yes (relay-message, notify-status-change) | Yes (`messages` + realtime) | BOTH |
| Processing monitor | Yes (`CandidateProcessingMonitor`, `CandidateProcessingSLA`, admin-run-* fns) | Partial (`/admin/health`, `processing_jobs` table, pg_cron) | O_BETTER on surfaces, N_BETTER on infra |
| Audit history | Yes (audit-* edge fns + IntegrityCommandCentre) | Yes (`audit_events`, `trace_index`) | O_BETTER on surfaces |
| Notifications delivery / SLA | Yes (dedicated dashboards + edge fns) | Yes (`notification_events`, `notification_deliveries`) | O_BETTER (surfaces) |
| Danger band review | Yes (`danger-band-review`, `DangerBandReview`) | **MISSING** | **O_ONLY** — needs decision |
| Prime Global campaign | Yes (5 edge fns + 5 admin pages) | **MISSING** | O_ONLY — likely EXCLUDE |
| Manual scoring queue | Yes (`ManualScoringQueue`) | Partial | O_BETTER |
| Search-filter-sort audit | Yes | Partial (`saved_views`) | O_BETTER |
| Intake repair mode | Yes (AdminEditBanner) | **MISSING** | O_ONLY — REBUILD |

## Client

| Capability | Original | New | Verdict |
|---|---|---|---|
| Overview | Yes (`ClientDashboard` /overview) | Yes (`/client`) | BOTH |
| KPIs (Delivered, Top Matches, Shortlisted, Interview Process, Hires, Active Positions) | Yes | Yes — `client_dashboard_kpis` view + `client-kpi.server.ts` with PII sanitization | N_BETTER |
| Positions | Yes | Yes (`/client/positions`) | BOTH |
| Candidates | Yes | Yes with `toClientCandidateDTO` sanitization | N_BETTER |
| Candidate profile (PII-safe) | Yes | Yes | BOTH |
| CV access | Yes (`serve-cv`) | Yes (`DownloadCvButton` on client detail) | BOTH |
| Actions (Shortlist / Request Interview / Offer / Hire) | Yes | Yes — canonical `moveMatchStage` + `client_decision_type` enum incl. `'offer'` | **N_BETTER** |
| Kanban | Yes | Yes — HTML5 DnD + `STAGE_GRAPH` enforcement | BOTH (new fully wired) |
| Interviews | Yes (`interview-feedback-reminder`) | Table present, few surfaces (`interviews` table 11 cols) | O_BETTER |
| Messages | Yes | Yes (`/client/messages` + realtime) | BOTH |
| Team | Yes (client-users) | Yes (`/client/team`) | BOTH |
| Settings | Yes | Yes (`/client/settings`) | BOTH |
| Talent Database | Yes (`ClientTalentDatabase`) | **MISSING** | O_ONLY — needs decision |
| Executive view | Removed in original | n/a | n/a |

## Candidate

| Capability | Original | New | Verdict |
|---|---|---|---|
| Applications list | Public tracker + gated dashboard (`CandidateUnavailable` placeholder) | `/me/applications` (auth) | N_BETTER |
| Application tracking (public link) | Yes (`/applications/track/:applicationId`) | **MISSING** for anonymous; only authenticated tracker exists | **O_ONLY** — REBUILD (post-apply email deep link is standard) |
| Profile | `CandidateProfile` (currently gated) | `/me/profile` | N_BETTER (new is live) |
| CV replacement | Yes (`ReplaceCv`, `submit-replacement-cv`) | Missing dedicated page (drawer supports admin replace) | **O_BETTER** — REBUILD |
| Messages | `CandidateMessages` (gated) | `/me/messages` | N_BETTER |
| Preferences / settings | Basic | `/me/settings` | BOTH_INCOMPLETE |
| Public candidate profile (`/talent/:slug`) | Yes | **MISSING** | O_ONLY — needs decision |
| Candidate join / signup | Yes (`CandidateJoin`, `CandidateAuth`) | Only email-based via generic `/auth` | O_BETTER surface, N canonical auth |

## Product-decision items (require answer before rebuild)
1. Danger band review — retain, rebuild, or exclude?
2. Prime Global campaign — retain, rebuild, or exclude?
3. Talent Database (client) — retain?
4. Talent Marketplace + Talent Network + Global Talent + `/talent/:slug` — public marketing or dashboard feature?
5. Candidate public profile — enable or drop?
6. Public application tracker deep link — required for post-apply email; **strongly recommend REBUILD**.
7. i18n (10 legacy locales that already redirect to English) — drop entirely?
