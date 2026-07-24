# Prompt 35 — Client Workspace Polish

**Verdict: PASS**

## Scope
Client routes (`src/routes/_authenticated/client.*.tsx`). Visual and hierarchy polish — stages, permissions, KPI math, and visibility rules preserved.

## Pages audited
| Section | Route | Layout | "One obvious next action" | Notes |
|---|---|---|---|---|
| Overview | `client.index.tsx` | KPI row → attention rail → active positions | "Review shortlist" primary CTA when candidates awaiting decision | KPI drill uses `KpiCard.drillTo`. |
| Positions | `client.positions.index.tsx` | Card grid | "Open shortlist" on each card | Stage tone via `StageIndicator`. |
| Position Detail | `client.positions.$id.tsx` | Header → coverage → shortlist | "Advance selected" | `RequirementCoverage` block prominent above the fold. |
| Candidates | `client.candidates.index.tsx` | Filter rail + list | "Compare" / "Advance" | Fit band + coverage summary per row. |
| Candidate Detail | `client.candidates.$id.tsx` | Dossier | "Move to interview" | `ScoreDisplay` band-first, evidence-first sections. |
| Comparison | `client.candidates.tsx` (Comparison Tableau) | Column tableau | "Select finalist" | Coverage grid, quotes with citations. |
| Messages | `client.messages.tsx` | Thread list + pane | "Reply" | Realtime hook preserved. |
| Team | `client.team.tsx` | Members table | "Invite" (client_admin only) | Role gating unchanged. |
| Settings | `client.settings.tsx` | Sectioned form | "Save" | Branding + notifications only. |
| Executive / Interviews / Offers / Portfolio / Talent Memory / Talent Pool / Sources / Outreach / Shares / Assistant | Corresponding files | `PageHeader + Section` | Consistent | Client-safe copy verified. |

## Evidence-first clarity
- `ScoreDisplay` renders band label ("Strong fit", "Aligned", "Partial", "Below") — never raw internal score without band.
- `RequirementCoverage` renders met / partial / missing with icon + text (not color-alone).
- Every candidate row exposes 1–3 evidence quotes with citation ("mentioned in CV, section 3.2") pulled from `candidate_evidence`.

## Client-safe terminology
Verified vocabulary across all client routes:
- "Shortlist" not "queue"
- "Fit band" not "raw score"
- "Advance" / "Pause" / "Decline" not "reject" / "kill"
- "Processing" not "pipeline_state=parsing"
- No admin-only fields exposed: `scoring_run_id`, `retry_count`, `pipeline_state`, `assistant_audit_events`, `talent_memory.internal_note` all filtered from client responses.

## Permissions / visibility retest
- **client_admin**: full CRUD; sees team management, branding, all positions.
- **client_editor**: can shortlist and message; team management hidden, branding hidden.
- **client_viewer**: read-only; action CTAs hidden or disabled; comparison read-only.
- **Cross-org**: attempting `/client/positions/{other-org-id}` returns access-denied via RLS + `_authenticated` gate.
- **Unpublished**: candidates in `pipeline_state ∈ {parsing, scoring, failed}` are excluded from client-visible queries — verified against `admin.candidates` counts.

## Viewport check
320 / 375 / 768 / 1024 / 1440 rendered clean. KPI row collapses to 2-up at 375; Comparison Tableau switches to horizontal scroll with sticky candidate name column at <1024.

## Result
- Client functionality regressions: **0**
- Internal data exposed: **0**
- Client-safe terminology violations: **0**

**PASS.**
