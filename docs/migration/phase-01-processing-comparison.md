# Phase 01 — Scoring, Parsing, Enrichment Comparison

## Trigger chain

| Step | Original | New |
|---|---|---|
| Application → parse | `submit-guest-application` / `submit-intake` fires `parse-candidate-cv` (edge fn) | `POST /api/public/intake` + `/jobs/$id/apply` → row in `processing_jobs` → pg_cron `pipeline.run` → `cv-extractor.server.ts` |
| Parser | `parse-cv` / `parse-candidate-cv` (Deno edge fn) | `unpdf` (PDF) + `mammoth` (DOCX) inside Worker |
| OCR fallback | Implied via `parse-cv` internals | **not present** — decision needed (PDF images will fail) |
| Parse artifacts | Likely `parse_artifacts` table | Stored in `candidate_profiles` scalars + `candidate_evidence` rows |
| Profile hydration | `enrich-candidate-profile`, `improve-profile-quality`, `calculate-profile-completeness`, `backfill-candidate-profile-fields`, `backfill-profile-completeness` | `cv-hydration.server.ts` (Gemini 2.5 Flash) — single service; `HYDRATION_PARSER_VERSION` bumps rehydration |
| Enrichment | `force-enrich-and-score` batches enrichment + scoring together | `runEnrichmentOnly` / `runHydrationOnly` / `replaceCv` in `pipeline-runner.server.ts` |
| Evidence graph | `integrity-evidence-mismatch-scan`, `integrity-*` | `candidate_evidence` (structured JSONB per requirement) |
| Scoring readiness | Ad-hoc across many edge fns | RPC `scoring_readiness` + DB gates before publish |
| Role identity of a score | `score_runs.position_id` + `submission_id`, but many bulk fns operate globally (`full-assigned-candidate-scoring-sweep`) | **Every score is bound to a `candidate_matches.id` for one `position_id`** (contract locked) |
| Scoring blueprint | `generate-role-blueprint`, `calibrate-role`, `run-calibration`, `generate-scoring-criteria` | Position-scoped blueprint stored on `positions`; canonical `executeScoring` reads it |
| Scoring execution | ~14 edge fns overlap; drift risk | **Single entry point** `executeScoring` in `scoring-service.server.ts` |
| Score history | `score_runs` + `backfill-score-runs`; immutability implied not enforced | `score_runs` (24 cols) + `tg_score_runs_immutable` trigger; new runs on rescore |
| Evidence per requirement | `candidate_evidence` inferred; also `integrity-evidence-mismatch-scan` | `candidate_evidence` (9 cols) — canonical |
| Explanation | `regenerate-score-explanations`, `admin-regenerate-score-explanations`, `integrity-explanation-review` | Stored inside `score_runs.result` JSONB (`strengths`, `concerns`, per-requirement rationale) |
| Manual review | `ManualScoringQueue`, `ScoreBandQA`, `CredibilityReview` | Admin drawer + `/admin/publish` (`Publish Desk`) |
| Client-safe score | Rendered per-decision throughout ClientDashboard | `toClientCandidateDTO` sanitizer (`client-kpi.server.ts`) — canonical |
| Publication gate | `AdminPublishDesk` + `visibility-audit` + `danger-band-review` | `/admin/publish` + DB gates in `scoring_readiness`; missing danger-band |

## Recommendations
- **Keep new pipeline** as canonical; do not port the ~14 overlapping scoring edge functions.
- **Migrate**: role-blueprint generation, scoring-criteria generation, screening-question generation, JD parsing — as steps inside `pipeline-runner.server.ts`, using Gemini already wired in `cv-hydration.server.ts`.
- **Rebuild** OCR fallback for image-only PDFs (Cloudflare Workers cannot run tesseract natively; use Gemini's vision on the PDF binary as fallback, or call an external OCR HTTP API).
- **Rebuild** public application tracker deep link (`/applications/track/$id`).
- **Rebuild** danger-band / credibility review only if the product owner keeps them.
- **Exclude** all `backfill-*`, `bulk-repair-*`, `integrity-*` bulk repair edge fns — the new pipeline's canonical services + immutability triggers make them unnecessary; regressions become normal `processing_jobs` retries.
- **Exclude** Prime Global campaign family unless product owner keeps it.
- **Critical rule (locked)**: no global candidate score. Every score belongs to one `candidate_matches` row.

## Full edge-function migration classifications
See `phase-01-findings.json` → `edge_function_map`. Summary:
- **KEEP AS SERVER-FN** (rebuild in new): intake, applications, CV parsing, enrichment, scoring, publication, notifications, messaging, team-member management, client-user management, CV replacement, cv-serve — ~30 fns.
- **REBUILD AS DB CRON**: consent-expiry, weekly-client-summary, notify-stale-reviews, close-stale-journey-incidents — pg_cron + server routes.
- **NEW-ONLY (drop)**: bulk repair / backfill / integrity / anomaly / reconcile / prime-global-campaign / marketplace-previews — ~55 fns retired.
- **DECISION REQUIRED**: `ask-taasflow` (chatbot), `qa-*`, danger-band, credibility-review, Prime Global suite.
