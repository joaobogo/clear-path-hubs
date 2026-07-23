# TaaSFlow V2 — Entity Relationship Map

```text
                         auth.users
                              │
                    ┌─────────┴─────────┐
                    │                   │
              memberships          candidate_profiles ── files ── (storage: cvs bucket)
                    │                   │      │
                    │                   │      └── current_cv_file_id
                    ▼                   │
              organizations             │
                    │                   │
                    ├── positions       │
                    │        │          │
                    │        │  ┌───────┘
                    │        ▼  ▼
                    │    candidate_matches  (== canonical: candidate_submission)
                    │        │  │  │  │
                    │        │  │  │  ├── application_id ─► applications ── application_answers
                    │        │  │  │  │                          │
                    │        │  │  │  │                          └── file_id ─► files
                    │        │  │  │  │
                    │        │  │  │  └── approved_score_run_id ─► score_runs (immutable, identity-bound)
                    │        │  │  │                                    │
                    │        │  │  │                                    └── score_decisions
                    │        │  │  │
                    │        │  │  └── candidate_evidence (immutable snapshots, 4-id bound)
                    │        │  │
                    │        │  ├── client_decisions (append-only log; latest mirrored on submission)
                    │        │  ├── interviews (partial-unique per active status)
                    │        │  └── messages (thread_id groups; append-only)
                    │        │
                    │        └── screening_questions
                    │
                    ├── notification_events ──► notifications ──► notification_deliveries
                    │                                 (per-recipient)     (per-channel)
                    │
                    ├── audit_events (append-only, from trigger)
                    ├── support_sessions ──► support_actions
                    ├── intake_submissions (pre-org; converted by intake-admin)
                    └── retention_policies / retention_runs / cost_limits / provider_usage_events
                                                                              (REVIEW_REQUIRED)

Cross-cutting (not tenant-scoped):
  - auth.users
  - candidate_profiles (identity is global; access is scoped by matches)
  - user_roles (global platform roles)
  - contact_messages (public form)
```

## Cardinality summary

| From | To | Cardinality | Enforcement |
|---|---|---|---|
| organization | membership | 1..N | FK |
| user | membership | 1..N (multi-org) | FK + unique(user_id, organization_id) |
| organization | position | 1..N | FK |
| position | screening_question | 1..N | FK |
| candidate_profile | application | 1..N | FK |
| position | application | 1..N | FK + UNIQUE(candidate_email, position_id) |
| application | candidate_match (submission) | 1..1 | FK |
| (candidate_profile, position) | candidate_match | UNIQUE 1..1 | unique index |
| candidate_match | score_run | 1..N | FK + identity trigger |
| candidate_match | candidate_evidence | 1..N | FK |
| candidate_match | client_decision | 1..N (log) | FK |
| candidate_match | interview | 1..N (max 1 active) | partial unique index |
| candidate_match | message | 0..N | FK via thread |
| organization | notification_event | 1..N | FK |
| notification_event | notification | 1..N | FK |
| notification | notification_delivery | 1..N | FK |
| candidate_profile | file | 1..N | FK |

## Identity binding (score_runs, candidate_evidence)

Both tables carry the full 4-tuple:
`organization_id`, `position_id`, `candidate_profile_id`, `candidate_submission_id`
(also `application_id` on score_runs). The `tg_score_runs_identity` trigger
rejects any row whose 4-tuple disagrees with the parent submission — no
score can be attached to the wrong candidate, wrong position, wrong org.

## Publication path

```text
candidate_evidence (immutable snapshot)
        │
        ▼
score_run.completed (immutable)
        │
        ▼
score_decision.approved  (or admin sets approved_score_run_id directly)
        │
        ▼
candidate_match.approved_score_run_id = <run.id>
candidate_match.client_visibility = 'visible'
        │
        └── tg_candidate_matches_publish_gate validates:
            identity match, run is completed, evidence non-empty,
            final_score ≤ raw_score ≤ applied_cap.
```
