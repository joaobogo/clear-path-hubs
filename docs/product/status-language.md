# TaaSFlow — Status Language (Product Truth Contract v1.0)

**Rule:** Every status label rendered anywhere in the UI comes from `src/lib/status-map.ts` — the sole canonical mapper. Components import label + tone; they never inline `if/else` on raw enum values.

**Rule:** One internal enum value MAY map to different user-safe labels per audience. That mapping lives here.

**Rule:** Never leak internal processing errors, model versions, or admin-only stage names to Candidate audience. When in doubt, use "Under review".

---

## 1. Position status

Internal enum (`positions.status`): `draft | in_review | needs_clarification | approved | active | paused | filled | closed | archived`.

| internal | Admin label | Client label | Candidate label (via Public job) |
|---|---|---|---|
| draft | Draft | Draft | *(not visible)* |
| in_review | In review | Awaiting our review | *(not visible)* |
| needs_clarification | Needs clarification | Info requested | *(not visible)* |
| approved | Approved, not yet active | Approved | *(not visible until active)* |
| active | Active | Active | Open |
| paused | Paused | Paused | Paused |
| filled | Filled | Filled | Closed |
| closed | Closed | Closed | Closed |
| archived | Archived | Archived | *(not visible)* |

Tone: `success` (active, approved, filled), `warning` (needs_clarification, paused), `neutral` (draft, in_review, approved-not-active, closed, archived).

## 2. Candidate match — stage

Internal enum (`candidate_matches.stage`): `new | screening | reviewed | approved_for_client | delivered | shortlisted | interview_requested | interviewing | offer | hired | archived | rejected`.

| internal | Admin label | Client label | Candidate-safe label |
|---|---|---|---|
| new | New | *(not visible)* | Application received |
| screening | Screening | *(not visible)* | Under review |
| reviewed | Reviewed, pending decision | *(not visible)* | Under review |
| approved_for_client | Approved for client | *(not visible until delivered)* | Under review |
| delivered | Delivered to client | New | Shared with the client |
| shortlisted | Shortlisted by client | Shortlisted | Shortlisted |
| interview_requested | Interview requested | Interview requested | Interview requested |
| interviewing | Interviewing | Interviewing | In interview process |
| offer | Offer extended | Offer | Offer stage |
| hired | Hired | Hired | Hired |
| archived | Archived — {reason} | Archived | Not moving forward |
| rejected | Rejected — {reason} | *(not visible)* | Not moving forward |

Candidate-safe rule: `archived` and `rejected` collapse to the same candidate label ("Not moving forward"). The reason is NEVER shown to the candidate.

## 3. Candidate match — processing_state

Internal enum: `queued | parsing | parsed | enriching | enriched | scoring | scored | failed`.

| internal | Admin label | Client label | Candidate-safe |
|---|---|---|---|
| queued | Queued for processing | Under review | Under review |
| parsing | Parsing CV | Under review | Under review |
| parsed | Parsed | Under review | Under review |
| enriching | Enriching | Under review | Under review |
| enriched | Enriched | Under review | Under review |
| scoring | Scoring | Under review | Under review |
| scored | Scored | *(handled by stage label)* | *(handled by stage)* |
| failed | Failed — {short_reason} | Under review | Under review |

Client and Candidate NEVER see raw processing state. Admin sees short_reason from `processing_jobs.error_summary` (safe-truncated to 120 chars, no stack traces).

## 4. Application status

Internal enum (`applications.status`): `submitted | superseded | withdrawn`.

| internal | Admin label | Client label | Candidate label |
|---|---|---|---|
| submitted | Submitted | *(never — clients see matches)* | Application submitted |
| superseded | Superseded by newer application | *(n/a)* | Application submitted |
| withdrawn | Withdrawn by candidate | *(n/a)* | Withdrawn |

## 5. Interview status

Internal enum (`interviews.status`): `requested | scheduled | completed | cancelled | no_show`.

| internal | Admin label | Client label | Candidate label |
|---|---|---|---|
| requested | Requested | Requested | Interview requested |
| scheduled | Scheduled — {when} | Scheduled — {when} | Interview scheduled — {when} |
| completed | Completed | Completed | Interview completed |
| cancelled | Cancelled | Cancelled | Interview cancelled |
| no_show | No show | No show | *(shown as "Interview cancelled")* |

## 6. Intake status

Internal enum (`client_intakes.status`): `submitted | triaged | converted | duplicate | rejected`.

| internal | Admin label | Client label | Candidate |
|---|---|---|---|
| submitted | New | Submitted | *(n/a)* |
| triaged | Triaged | Under review | *(n/a)* |
| converted | Converted to position | Position created | *(n/a)* |
| duplicate | Duplicate | Already on file | *(n/a)* |
| rejected | Rejected — {reason} | Not accepted | *(n/a)* |

## 7. Membership status

Internal enum: `invited | active | suspended | revoked`.

| internal | Admin label | Client-admin label |
|---|---|---|
| invited | Invited | Invite pending |
| active | Active | Active |
| suspended | Suspended | Access paused |
| revoked | Revoked | Removed |

## 8. Fit band (score)

Internal enum (`score_runs.fit_band`): `top | strong | possible | low`.

| internal | Admin | Client | Candidate |
|---|---|---|---|
| top | Top match | Top match | *(never shown)* |
| strong | Strong fit | Strong fit | *(never shown)* |
| possible | Possible fit | Possible fit | *(never shown)* |
| low | Low fit | *(hidden — filtered from delivery)* | *(never shown)* |

Numeric scores (0–100) are ADMIN_ONLY. Client sees fit_band only. Candidate never sees score or band.

---

## Implementation contract

```ts
// src/lib/status-map.ts — canonical
export type Audience = 'admin' | 'client' | 'candidate';
export function labelFor(entity: 'position'|'match_stage'|'processing'|'application'|'interview'|'intake'|'membership'|'fit_band',
                        value: string, audience: Audience, ctx?: Record<string,string>): { label: string; tone: 'success'|'warning'|'danger'|'neutral' } | null;
```

Return `null` = "not visible to this audience"; component MUST skip rendering, not fall back to raw enum.

CI check (`tests/status-map-coverage.spec.ts`) enumerates every enum in the DB and asserts a mapping exists for each `(value, audience)` pair listed above.
