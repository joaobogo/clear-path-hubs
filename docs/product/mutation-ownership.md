# TaaSFlow — Mutation Ownership (Product Truth Contract v1.0)

**Rule:** Every state-changing operation has ONE canonical server function. That function is the only writer. Components, hooks, other server functions, and edge routes MUST call it — never re-implement its INSERT/UPDATE/DELETE.

**Rule:** Every canonical writer:
1. Validates input with a Zod schema exported from the same module.
2. Enforces authorization via `requireSupabaseAuth` middleware + role/tenant check inside the handler (never trust the caller's assertion).
3. Emits a domain event via `emitEventFromServer` for downstream fan-out.
4. Writes an audit row (usually via `tg_write_audit_event` trigger; explicit `audit_events` insert if trigger unavailable).
5. Returns a typed result including new state + entity ID.

**Rule:** No two implementations. CI check greps for direct `.from('candidate_matches').update` outside the owning module — build fails on match.

---

## Mutation registry

| # | Mutation | Canonical writer (module → export) | Authorized role | Events emitted |
|---|---|---|---|---|
| 1 | Create position (draft) | `src/lib/positions.functions.ts → createPositionDraft` | client_admin, client_editor | `position.drafted` |
| 2 | Update position | `src/lib/positions.functions.ts → updatePosition` | client_admin, client_editor (own org); platform_admin, operations | `position.updated` |
| 3 | Submit intake | `src/lib/intake.functions.ts → submitIntake` | public (rate-limited); becomes client_admin on conversion | `intake.submitted` |
| 4 | Triage intake | `src/lib/intake.functions.ts → triageIntake` | platform_admin, operations | `intake.triaged` |
| 5 | Convert intake → position | `src/lib/intake.functions.ts → convertIntakeToPosition` | platform_admin, operations | `intake.converted`, `position.drafted` |
| 6 | Approve position | `src/lib/admin-positions.functions.ts → approvePosition` | platform_admin, operations | `position.approved` |
| 7 | Request clarification | `src/lib/admin-positions.functions.ts → requestPositionClarification` | platform_admin, operations | `position.clarification_requested` |
| 8 | Activate position | `src/lib/admin-positions.functions.ts → activatePosition` | platform_admin, operations | `position.activated` |
| 9 | Pause position | `src/lib/admin-positions.functions.ts → pausePosition` | platform_admin, operations; client_admin | `position.paused` |
| 10 | Close position | `src/lib/admin-positions.functions.ts → closePosition` | platform_admin, operations | `position.closed` |
| 11 | Set position visibility | `src/lib/admin-positions.functions.ts → setPositionVisibility` | platform_admin, operations | `position.visibility_changed` |
| 12 | Apply to job | `src/lib/apply.functions.ts → submitApplication` | public + candidate | `application.submitted` |
| 13 | Withdraw application | `src/lib/candidate.functions.ts → withdrawApplication` | candidate (owner) | `application.withdrawn` |
| 14 | Replace CV | `src/lib/candidate.functions.ts → replaceCandidateCv` | candidate (owner) | `candidate.cv_replaced` |
| 15 | Update candidate profile | `src/lib/candidate.functions.ts → updateCandidateProfile` | candidate (owner) | `candidate.profile_updated` |
| 16 | Enqueue processing | `src/lib/processing.functions.ts → enqueueProcessing` | system (called by application submit + admin retry) | `processing.enqueued` |
| 17 | Parse CV (step) | `src/lib/processing.functions.ts → stepParse` | system (invoked by pg_cron/worker); admin retry | `processing.parsed`, `processing.failed` |
| 18 | Enrich (step) | `src/lib/processing.functions.ts → stepEnrich` | system; admin retry | `processing.enriched`, `processing.failed` |
| 19 | Score candidate | `src/lib/processing.functions.ts → stepScore` | system; admin rescore | `candidate.scored`, `processing.failed` |
| 20 | Rescore candidate | `src/lib/admin-matches.functions.ts → rescoreMatch` | platform_admin, operations | `processing.rescore_requested`, downstream via stepScore |
| 21 | Approve candidate for client | `src/lib/admin-matches.functions.ts → approveMatchForClient` | platform_admin, operations | `candidate.approved_for_client` |
| 22 | Publish candidate (deliver) | `src/lib/admin-matches.functions.ts → publishMatch` | platform_admin, operations | `candidate.delivered` |
| 23 | Archive match (admin) | `src/lib/admin-matches.functions.ts → archiveMatch` | platform_admin, operations | `match.archived` |
| 24 | Reject match (admin) | `src/lib/admin-matches.functions.ts → rejectMatch` | platform_admin, operations | `match.rejected` |
| 25 | Shortlist (client) | `src/lib/client.functions.ts → moveMatchStage` (target=`shortlisted`) | client_admin, client_editor | `match.stage_changed` |
| 26 | Client archive | `src/lib/client.functions.ts → moveMatchStage` (target=`archived`) | client_admin, client_editor | `match.stage_changed`, `match.archived` |
| 27 | Request interview | `src/lib/client.functions.ts → requestInterview` | client_admin, client_editor | `interview.requested`, `match.stage_changed` |
| 28 | Schedule interview | `src/lib/interviews.functions.ts → scheduleInterview` | client_admin, client_editor, operations | `interview.scheduled` |
| 29 | Cancel interview | `src/lib/interviews.functions.ts → cancelInterview` | client_admin, client_editor, operations | `interview.cancelled` |
| 30 | Complete interview | `src/lib/interviews.functions.ts → completeInterview` | client_admin, client_editor, operations | `interview.completed` |
| 31 | Record interview outcome | `src/lib/interviews.functions.ts → recordInterviewOutcome` | client_admin, client_editor | `interview.outcome_recorded` |
| 32 | Extend offer | `src/lib/client.functions.ts → moveMatchStage` (target=`offer`) | client_admin | `match.stage_changed` |
| 33 | Mark hired | `src/lib/client.functions.ts → markHired` | client_admin | `candidate.hired`, `match.stage_changed` |
| 34 | Correct hire (admin) | `src/lib/admin-matches.functions.ts → correctHire` | platform_admin | `candidate.hire_corrected` |
| 35 | Send message | `src/lib/messages.functions.ts → sendMessage` | any authenticated participant | `message.sent` |
| 36 | Mark message read | `src/lib/messages.functions.ts → markMessageRead` | recipient | `message.read` |
| 37 | Invite team member | `src/lib/team.functions.ts → inviteMember` | client_admin, platform_admin | `membership.invited` |
| 38 | Accept invite | `src/lib/team.functions.ts → acceptInvite` | invitee | `membership.activated` |
| 39 | Suspend member | `src/lib/team.functions.ts → suspendMember` | client_admin, platform_admin | `membership.suspended` |
| 40 | Remove member | `src/lib/team.functions.ts → removeMember` | client_admin, platform_admin | `membership.revoked` |
| 41 | Update consent | `src/lib/candidate.functions.ts → updateConsent` | candidate (owner) | `candidate.consent_updated` |
| 42 | Request account deletion | `src/lib/candidate.functions.ts → requestAccountDeletion` | candidate (owner) | `candidate.deletion_requested` |
| 43 | Execute account deletion | `src/lib/admin-candidates.functions.ts → executeAccountDeletion` | platform_admin | `candidate.deleted` |
| 44 | Record client decision | `src/lib/client.functions.ts → recordClientDecision` | client_admin, client_editor | `client_decision.created` |
| 45 | Emit notification | `src/lib/notifications.functions.ts → emitEventFromServer` | system (called by all writers) | *(fan-out only; not itself emitting)* |
| 46 | Mark notification read | `src/lib/notifications.functions.ts → markNotificationRead` | recipient | `notification.read` |

---

## Forbidden patterns

- Direct Supabase writes from React components or route loaders. Loaders read; components render; writers are server functions.
- `supabaseAdmin` used in a component or hook.
- Any writer that does not call `emitEventFromServer` for lifecycle events (see events.ts catalogue).
- Any two functions writing to the same table's same column set for the same business meaning. Add a facade if callers need convenience.

## CI enforcement

- `scripts/lint-mutation-ownership.ts` scans `src/` for `.from('<table>').(insert|update|delete)` calls and asserts every occurrence is inside the owning module listed above. Violations fail build.
- `scripts/audit-event-emission.ts` cross-references this table's "Events emitted" column against `src/lib/events.ts` and asserts every listed event has a `case` in every audience copy map.
