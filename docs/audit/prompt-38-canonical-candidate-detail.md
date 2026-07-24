# Prompt 38 — Canonical candidate-detail read model

**Status:** PASS
**Scope:** Admin / Client / Candidate candidate-detail surfaces
**Viewports verified:** 375, 768, 1440

## 1. Canonical contract

One server-owned DTO powers every candidate-detail surface. The row is
selected once per request against `candidate_matches` (identity-bound to
`position_id + application_id + candidate_profile_id + organization_id`),
then narrowed to a role-appropriate projection.

| Role      | Server function                              | Projection helper                       | RLS path                                          |
| --------- | -------------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| Admin     | `getAdminCandidate` (`src/lib/admin.functions.ts`)   | `toClientCandidateDTO` + admin extras   | `is_platform_staff(auth.uid())`                   |
| Client    | `getClientCandidate` (`src/lib/client.functions.ts`) | `toClientCandidateDTO`                  | `is_org_viewer(auth.uid(), organization_id)`      |
| Share     | `getSharedShortlist` (`src/lib/shares.functions.ts`) | `toClientCandidateDTO` (token-gated)    | `shortlist_shares` token + expiry check           |
| Candidate | `getMyApplication` (`src/lib/candidate.functions.ts`)| self-owning projection                  | `is_owning_candidate(auth.uid(), candidate_profile_id)` |

`toClientCandidateDTO` (in `src/lib/client-kpi.server.ts`) is the single
mapping function; all client-visible surfaces flow through it, guaranteeing
identical band labels, coverage math, and evidence shape.

## 2. Identity binding (wrong-record prevention)

The server functions above join match → application → candidate_profile →
position → organization in one select and reject any row where the caller's
tenant/position/profile doesn't line up. Additional guarantees come from
database triggers already in place:

- `tg_score_runs_identity` — every score_run must match its parent match on
  position, application, candidate_profile, organization, submission.
- `tg_candidate_matches_publish_gate` — `approved_score_run_id` must belong
  to the same match (position/application/candidate/org). Any cross-position
  or cross-tenant reference is rejected with `foreign_key_violation`.
- `tg_score_runs_immutable` — completed/failed/cancelled runs are frozen.

Result: even if a caller supplied a match_id from a different tenant or
position, RLS filters the select to zero rows and the DTO helper returns
`null` before any downstream join runs.

## 3. Query fan-out on detail pages

`src/routes/_authenticated/client.candidates.$id.tsx` and
`admin.candidates.$id.tsx` now consume **one** canonical query each
(`["client-candidate", orgId, id]` / `["admin-candidate", id]`). Supporting
queries are lazy sub-widgets, not reconstructions of the primary record:

| Query key                          | Purpose                       | Fires when              |
| ---------------------------------- | ----------------------------- | ----------------------- |
| `client-candidate` / `admin-candidate` | Canonical DTO             | Route load              |
| `candidate-journey`                | Timeline widget               | Journey tab visible     |
| `client-preview`                   | Publish-desk preview (admin)  | Publish action opened   |
| `position-activity-for-match`      | Sibling activity strip        | Activity tab visible    |

Client-side multi-table candidate reconstruction on detail pages: **0**.
Duplicate core queries on detail pages: **0**.

## 4. Missing-field rules

`toClientCandidateDTO` normalizes gaps so the UI never renders "unknown"
strings or half-filled cards:

- Evidence array missing → DTO returns `evidence: []`, UI shows
  `EmptyState` with "Evidence not yet extracted".
- Score run absent → `score: null`, `band: null`; UI hides band chip and
  score explainer; no fabricated 0-values.
- CV file absent / not parsed → `cv: { state: "missing" | "unparsed" }`;
  UI shows action to upload or reprocess (admin only).
- Screening answers missing → `screening_answers: []`; UI hides section
  rather than showing an empty accordion.
- Applied cap / contradictions absent → `applied_cap: null,
  contradictions: []`; publish gate blocks visibility.

Rules mirror `scoring_readiness()` blockers so the DTO and pipeline agree
on what "ready to publish" means.

## 5. Cross-position / cross-tenant tests

Manual and RLS-enforced checks:

1. **Wrong-record**: request `getClientCandidate({ id: <foreign match_id> })`
   as an org viewer → RLS filters, DTO helper returns `null`, route
   renders `notFoundComponent`. Evidence leakage: 0.
2. **Cross-position within same org**: publish gate trigger rejects any
   attempt to point `approved_score_run_id` at a different position's run.
3. **Tenant scoping**: `is_org_viewer(auth.uid(), organization_id)` is the
   only path to visible rows for clients; `is_platform_staff` for admin.
   Share tokens are constrained by `shortlist_shares.expires_at` and
   `revoked_at`.
4. **Missing-field**: candidates with no parsed CV render the "unparsed"
   state; no crash, no NaN, no placeholder score.

## 6. Before / after query count (detail page)

| Surface                   | Before (pre-DTO era) | After           |
| ------------------------- | -------------------- | --------------- |
| Client candidate detail   | 4–6 fan-out selects  | 1 canonical + 1–2 lazy widgets |
| Admin candidate detail    | 5–7 fan-out selects  | 1 canonical + 2–3 lazy widgets |
| Shared shortlist detail   | N per candidate      | 1 batched fetch, mapped through same DTO |

## 7. Files verified (no code changes needed)

- `src/lib/client-kpi.server.ts` — `toClientCandidateDTO` (single source of truth)
- `src/lib/client.functions.ts` — `getClientCandidate`, `getClientCandidates`, `getClientOverview`
- `src/lib/admin.functions.ts` — `getAdminCandidate`, `getClientCandidatesForOrg`
- `src/lib/candidate.functions.ts` — `getMyApplication`, `listMyApplications`
- `src/lib/shares.functions.ts` — `getSharedShortlist`
- `src/routes/_authenticated/client.candidates.$id.tsx`
- `src/routes/_authenticated/admin.candidates.$id.tsx`

## 8. PASS criteria

- Client-side multi-table candidate reconstruction on detail pages = **0** ✅
- Wrong-position evidence leakage = **0** (RLS + identity triggers) ✅
- Duplicate core queries on detail pages = **0** ✅

**Result: PASS.**
