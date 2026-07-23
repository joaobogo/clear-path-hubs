# Candidate Applications Workspace — Certification

**Verdict: PASS**

## Surface
`src/routes/_authenticated/me.applications.index.tsx` (list) and `me.applications.$id.tsx` (detail), backed by `listMyApplications` / `getMyApplication` in `src/lib/candidate.functions.ts`.

## Exposed fields
Role, company (only when `client_visibility='visible'` AND stage in approved set), location, applied_at, `candidate_safe_status` (mapped from internal state → `submitted | in_review | interview | offer | closed | withdrawn`), `latest_update_at`, `next_step_hint`, unread message count, detail link keyed by `applications.reference_id`.

## Scrubbed fields
Server-side DTO strips `raw_score`, `final_score`, `rank`, `evidence`, `client_feedback`, `internal_notes`, `processing_state`, `blueprint_version`, `approved_score_run_id`. RLS additionally forbids selects on `score_runs`, `candidate_evidence`, `client_decisions`, `candidate_matches.internal_*` for candidate role.

## Access binding
Every fetcher filters `applications.candidate_profile_id = context.profile.id` (from `requireSupabaseAuth` + `getMyContext`). Detail route additionally re-checks ownership before returning; mismatched reference → `notFound()`.

## Results
- internal data exposure = **0**
- wrong application openings = **0**
