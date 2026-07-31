# What TaaSFlow actually holds

A written map of every durable signal in the platform, where it comes from,
who writes it, and what it can honestly be used for. If a number appears on a
client or candidate screen and is not traceable to a row below, it is a defect.

Last reviewed: 2026-08-01

## 1. Identity spine — the compounding layer

| Table | What it holds | Written by | Compounds because |
|---|---|---|---|
| `talent_persons` | One row per human, across every org and every application | `resolve_talent_person` RPC, triggered from `candidate_profiles` | A repeat applicant is the same person, not a new record |
| `talent_person_identifiers` | Email, phone, LinkedIn, auth user id | Same RPC; merges on collision | Identity survives a changed email or a new CV |
| `talent_graph_edges` | Every role seen, evidence extracted, interaction, stage change, outcome | Triggers on `candidate_profiles`, `applications`, `score_runs`, `hire_records` | Person-level history, not application-level history |

## 2. Evidence layer — why we said what we said

| Table | What it holds | Written by |
|---|---|---|
| `candidate_evidence` | Immutable snapshot per submission, 8-field contract | `pipeline-runner.server.ts`, `cv-hydration.server.ts` |
| `candidate_evidence_items` | Per-requirement result, source passage, integrity flag, reviewer status | `evidence/evidence.functions.ts` (auto on scoring, manual on admin review) |
| `score_runs` | Final score, fit label, category breakdown; immutable once terminal | `scoring-service.server.ts` |
| `rubric_versions` | The exact rubric a score was produced under | Admin rubric publication |
| `eligibility_checks` | Hard gates checked before scoring | Scoring pipeline |

Every published score points at a rubric version and a set of evidence items
with source passages. There is no unexplained number in the scoring path.

## 3. Outcome layer — what actually happened

| Table | What it holds | Written by |
|---|---|---|
| `applications` | The apply event, immutable | Public apply route |
| `candidate_matches` | Stage, visibility, decision mirror — the pipeline state of record | `apply.functions.ts`, `client.functions.ts::moveMatchStage`, publish desk |
| `candidate_stage_history` | Every stage transition with timestamps | Stage triggers |
| `client_decisions` | Advance / hold / decline log with reason | `client.functions.ts` |
| `interviews`, `interview_scorecards` | Scheduling lifecycle and structured feedback per requirement | `interviews.functions.ts`, `scorecards.functions.ts` |
| `hire_records` | Accepted package, start date, guarantee terms, close reason | `hires.functions.ts` |
| `recruiting_spend_entries` | Client-entered spend by period and category | Manual finance entry |
| `position_commitments` | The promise: first shortlist days, shortlist size, response hours | Role setup |

## 4. Engagement layer

| Table | What it holds | Written by |
|---|---|---|
| `outreach_campaigns`, `outreach_touches` | Channel, send time, engagement state, reply category | Campaign workers |
| `conversations`, `messages` | One thread per role/candidate | `sendMessage` |
| `talent_memory`, `talent_memory_events` | Silver medallists kept deliberately, with consent state and reason | `talent-memory.functions.ts` |
| `role_memory` | Recruiter briefs, risks and handoff notes per role | `role-memory.functions.ts` |

## 5. Write-back layer — the flywheel

`search_signals` is the point of the whole system. When a search closes,
`write_back_closed_search(position_id)` records, for that role family and
region:

- how long each stage actually took
- where candidates dropped out and why
- which evidence requirements predicted an advance and which predicted nothing
- whether the requirement list was realistic against the applicant pool
- the accepted package, when a hire happened

`market_intelligence` aggregates those signals into benchmarks by role family,
region and measure, carrying `closed_searches` and `record_count` with every
row.

## 6. Rules that keep this honest

1. **No figure without provenance.** Client-facing derived numbers are wrapped
   in `Sourced<T>` (`src/lib/provenance.ts`) and rendered through
   `ProvenanceFigure`, which shows the source tables, record count and window.
2. **Minimum sample size.** A market benchmark is not published below
   `MIN_CLOSED_SEARCHES` (5) closed searches. Thin rows are withheld and
   counted, never smoothed.
3. **No seeded accounts.** A new organisation sees a plain "nothing held yet"
   state, not sample data.
4. **External benchmarks are labelled.** SHRM and Ashby 2025 figures used in
   marketing comparisons (`src/components/marketing/agency-comparator.tsx`,
   `src/config/public-pricing.ts`) are third-party references and must never be
   presented as TaaSFlow platform data.
5. **State vs event.** `candidate_matches` is the only truth for stage and
   visibility. Everything else is an append-only event over it.

## 7. Where the surfaces are

| Surface | Route | Audience |
|---|---|---|
| Your data advantage | `/client/data` | Client |
| Market benchmarks | `/client/data` (gated on sample size) | Client |
| Data health console | `/admin/data-health` | Platform staff |
| Pipeline and job health | `/admin/health`, `/admin/operations` | Platform staff |

## 8. Known gaps

- `outreach_touches` and `recruiting_spend_entries` have no in-app writer in
  `src/lib`; they are populated by workers or manual entry.
- Client decision mirror reconciliation job is still unbuilt (see
  `docs/architecture/source-of-truth-rules.md` §3.3).
