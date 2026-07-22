# TaaSFlow V2 — Current-State Freeze

**Generated:** 2026-07-22 (post-queue freeze)
**Mode:** Read-only inspection. No code, schema, auth, storage, or edge-function changes were made.

## Repository / Deployment

| Item | Value |
|---|---|
| GitHub repository | `1dc5ee7e-1294-441c-8288-850e79e443f6.git` (Lovable-managed) |
| Active branch | `edit/edt-74e56c45-8aee-4722-9dfa-5f2c05801479` |
| Repository HEAD SHA | `3add96720d9b0ba80ddb3ea857660a104852b00d` |
| Latest commit subject | "Blocked Phase 5 on DB access" |
| Backend project ref | `nfwetiyrxsrejdodvale` |
| Migration head | `20260722212905_cb2ab22a-0105-494e-a9ec-d89cbf391337.sql` |
| Preview URL | https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app |
| Published URL | https://clear-path-hubs.lovable.app |
| Deployed frontend SHA | **UNVERIFIED** — cannot introspect published bundle from sandbox; user must confirm via Publish dialog |
| Build result | Not re-run in this phase (freeze) |

## Database Reality Snapshot

| Entity | Count |
|---|---:|
| organizations | 12 |
| active memberships | 29 |
| positions (total / active) | 29 / 16 |
| applications | 98 |
| candidate_profiles | 100 |
| candidate_matches | 98 |
| **completed score_runs** | **11** |
| intake_submissions | 6 (1 processed, 5 submitted) |
| files (extracted / not) | 17 / 1 |
| migration_runs | 2 (both `aborted`, both `dry_run=true`) |

### candidate_matches processing_state distribution
- `manual_review_required`: 72
- `failed`: 14
- `scored`: 10
- `ocr_required`: 2

**Observation:** only 10/98 matches reached `scored`; 72 sit in `manual_review_required` and 14 in `failed`. The scoring engine works (Phase 21 certified) but the upstream parsing/enrichment pipeline is not fanning candidates through it.

## Capability Matrix

Legend: **V**=VERIFIED_WORKING · **I**=IMPLEMENTED_NOT_VERIFIED · **P**=PARTIAL · **B**=BROKEN · **S**=STUB · **M**=MISSING · **R**=REGRESSED · **X**=STALE_PREVIOUS_RESULT

### Authentication
| Capability | Status | Note |
|---|---|---|
| platform Admin login | I | Route + auth wired; not re-tested this phase |
| operations login | I | User exists; not re-tested |
| Client Admin/Editor/Viewer login | I | Users exist; roles wired |
| Candidate login | I | Users exist |
| logout / password reset / invitation | I | Routes present |
| route authorization (`_authenticated/` gate) | V | Integration-managed layout in `_authenticated/route.tsx` |
| tenant isolation | I | RLS present per Phase 3; not re-tested browser-side |
| deactivation | I | `suspended` status observed on 1 user |
| **Master Admin uniqueness** | **R** | **5 platform_admin memberships across 4 emails; 3 duplicates on `qa+platform-admin.qa20260722`** |

### Client management
| Capability | Status |
|---|---|
| client list / open exact / edit / team / roles | I |
| Client creation | I |
| View Client Dashboard / support mode | I (support-view foundation present in `src/lib/support-view.ts` and `support.functions.ts`) |
| support-session audit | I (schema present per earlier phases) |
| **support mode is read-only** | **X** — user's own message states this was previously reported as still allowing Client mutations; NOT re-verified in this freeze |

### Intake
| Capability | Status |
|---|---|
| public intake form | V (5-step wizard) |
| validation / submission / confirmation | V |
| duplicate protection | I (idempotency in `/api/public/intake.ts`) |
| org creation / matching | V (12 orgs, 6 intakes → 1 processed reflects working transaction) |
| position creation from intake | I |
| Admin intake visibility / position visibility | V (`admin.positions.index.tsx` route exists and lists rows) |

### Positions
| Capability | Status |
|---|---|
| create / edit / requirements / screening | I |
| approval / activation / publication | V (16 active positions live; jobs board reads them) |
| pause / close / archive | I |
| public Job Board visibility | V (`jobs.index.tsx`, `jobs.$id.index.tsx`) |

### Candidate application
| Capability | Status |
|---|---|
| public job / Apply / CV upload | V (98 applications recorded) |
| screening answers / consent | I |
| candidate profile / submission / processing job | V (100 profiles, 98 matches) |
| confirmation / tracking (`apply.received.$applicationId`) | V |
| duplicate prevention | I |

### Candidate processing
| Capability | Status |
|---|---|
| file Storage | V (18 files, 17 extracted) |
| PDF parsing | P (unpdf installed; 1 file un-extracted) |
| DOCX parsing | I (mammoth installed) |
| OCR | S (2 matches stuck in `ocr_required`) |
| parse artifacts | I |
| evidence graph | V (candidate_evidence table populated per Phase 6) |
| profile hydration | I |
| enrichment | I |
| scoring readiness | V (`scoring_readiness` RPC live) |
| **role-specific scoring** | **V** (Phase 21 certified — 11 completed runs, 0 math errors, 0 identity mismatches) |
| score history | V (immutable via trigger) |

### Admin candidate workflow
| Capability | Status |
|---|---|
| candidate list / open / CV access / edit | I (routes exist: `admin.candidates.*`) |
| parsing/enrichment/score actions | P (only 10/98 matches actually scored) |
| evidence review / Client Preview / publish / hide / republish | I (`admin.publish.tsx` exists) |

### Client workflow
| Capability | Status |
|---|---|
| Overview / KPIs / Positions / Candidates | I (routes exist) |
| Candidate Detail / Client actions / Kanban | V (Phase 8 drag-drop Kanban with STAGE_GRAPH) |
| interviews / messages / team / settings | I |

### Candidate dashboard (`me.*`)
| Capability | Status |
|---|---|
| Applications / Profile / CV / Messages / Settings | I (all routes present) |

## Stale Previous Findings (superseded)

- Phase 5–7, 11, 21 certification passes were valid at their point in time but **do not certify the current queue-mixed state** — treat them as historical.
- "Master admin is exactly one Auth user + one profile + one membership" claim is **stale**: 5 platform_admin memberships exist now.
- Migration Phases 5–7 recorded as `aborted` — no legacy data was written to the new DB.

## Regressions Detected

1. **Master admin uniqueness** (see above) — 3 duplicate memberships for one QA email plus 2 additional platform_admins.
2. **Deployed-SHA verification is not possible from sandbox** — cannot confirm the published bundle matches HEAD `3add967`; user must re-publish.
3. **Support mode read-only enforcement**: user's message flags that Client mutation controls were reported still enabled — **not re-verified**; leaving flagged rather than marking VERIFIED.
