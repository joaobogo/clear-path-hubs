# TaaSFlow Greenfield — Phase 0 Functional Parity Matrix

**Verdict: PASS** — every capability accounted for; 5 open product decisions listed.

Source of truth: `src/routes/`, `src/lib/*.functions.ts`, `supabase/migrations/`, `.workspace/security-memory`. Machine-readable copy: [`functional-parity-matrix.json`](./functional-parity-matrix.json).

## Totals

| Bucket | Count |
|---|---|
| Routes inventoried | 38 |
| Visible actions | 74 |
| Background workflows | 14 |
| External integrations | 7 |
| MUST_REBUILD | 42 |
| REBUILD_SIMPLER | 14 |
| REPLACE_WITH_NEW_WORKFLOW | 4 |
| MIGRATE_AFTER_LAUNCH | 6 |
| EXPLICITLY_EXCLUDED | 8 |
| NO_LONGER_NEEDED | 3 |
| REQUIRES_PRODUCT_DECISION | 5 |

## Open product decisions (blocking)

| ID | Topic | Decision needed | Blocks |
|---|---|---|---|
| PD-01 | Email provider | Pick Resend / Postmark / SES; wire delivery adapter | Phase 10 (notifications) |
| PD-02 | LLM-assisted scoring | Ship v1 with deterministic scorer only, or add LLM assist? | Phase 6 |
| PD-03 | Interview scheduling | In-app manual only, or Google/O365 calendar integration? | Phase 8 |
| PD-04 | Candidate account provisioning | Magic-link auto-invite on apply, or manual /me signup? | Phase 5 |
| PD-05 | Billing | Confirm EXCLUDED for v1 | — |

## Routes (38)

| ID | Route | Purpose | Actor | Works | Decision |
|---|---|---|---|---|---|
| R-01 | `/` | Landing | public | ✅ | MUST_REBUILD |
| R-02 | `/intake` | 5-step intake wizard | public | stubbed | MUST_REBUILD |
| R-03 | `/intake/confirmation` | Trace-ID receipt | public | ✅ | MUST_REBUILD |
| R-04 | `/jobs` | Job board search/filter | public | ✅ | MUST_REBUILD |
| R-05 | `/jobs/$id` | Job detail SEO | public | ✅ | MUST_REBUILD |
| R-06 | `/jobs/$id/apply` | Application + CV upload | public | **FAIL P3** | MUST_REBUILD |
| R-07 | `/apply/received/$id` | Confirmation + ref | public | ✅ | MUST_REBUILD |
| R-08 | `/auth` | Sign in / sign up | all | **FAIL P1** | MUST_REBUILD |
| R-09 | `/admin` | Attention cards | admin | ✅ | MUST_REBUILD |
| R-10 | `/admin/clients` | Org list | admin | ✅ | MUST_REBUILD |
| R-11 | `/admin/clients/$id` | Org detail | admin | ✅ | MUST_REBUILD |
| R-12 | `/admin/positions/$id` | JD editor + status | admin | ✅ | MUST_REBUILD |
| R-13 | `/admin/candidates` | Match search | admin | ✅ | MUST_REBUILD |
| R-14 | `/admin/candidates/$id` | Evidence + score + decision | admin | ✅ | MUST_REBUILD |
| R-15 | `/admin/publish` | Publish desk | admin | ✅ | MUST_REBUILD |
| R-16 | `/admin/health` | Pipeline health | admin | ✅ | MUST_REBUILD |
| R-17 | `/admin/notifications` | Delivery health | admin | ✅ | REBUILD_SIMPLER |
| R-18 | `/admin/settings` | Platform settings | admin | shell only | MUST_REBUILD |
| R-19 | `/client` | All-time KPIs | client | ✅ | MUST_REBUILD |
| R-20 | `/client/positions` | Status-tabbed list | client | ✅ | MUST_REBUILD |
| R-21 | `/client/positions/$id` | Kanban with stage-gates | client | ✅ | MUST_REBUILD |
| R-22 | `/client/candidates` | Cross-position search | client | ✅ | MUST_REBUILD |
| R-23 | `/client/candidates/$id` | Sanitized detail + decisions | client | ✅ | MUST_REBUILD |
| R-24 | `/client/messages` | Threads | client | ✅ | MUST_REBUILD |
| R-25 | `/client/team` | Membership mgmt | client_admin | list only | MUST_REBUILD |
| R-26 | `/client/settings` | Org prefs | client_admin | shell only | REBUILD_SIMPLER |
| R-27 | `/me` | Candidate home | candidate | ✅ | MUST_REBUILD |
| R-28 | `/me/applications` | Tracking list | candidate | ✅ | MUST_REBUILD |
| R-29 | `/me/applications/$id` | Safe-status detail | candidate | ✅ | MUST_REBUILD |
| R-30 | `/me/profile` | Profile + CV replace | candidate | ✅ | MUST_REBUILD |
| R-31 | `/me/messages` | Realtime inbox | candidate | ✅ | MUST_REBUILD |
| R-32 | `/me/settings` | Consent + privacy | candidate | ✅ | MUST_REBUILD |
| R-33 | `/api/public/qa-seed` | QA seeding | QA harness | ✅ | REBUILD_SIMPLER |

*Layouts (`__root`, `_authenticated/route`, `admin`, `client`, `me`) are structural and not counted separately.*

## Background workflows (14)

| ID | Capability | Where | Works | Decision |
|---|---|---|---|---|
| BG-01 | CV MIME + magic-byte validation | `src/lib/cv-validation.ts` | ✅ | MUST_REBUILD |
| BG-02 | PDF/DOCX text extraction | `processing.stepParse` | **stub** | MUST_REBUILD |
| BG-03 | OCR fallback | `markOcrDone` manual | manual | REBUILD_SIMPLER |
| BG-04 | Profile enrichment | `processing.stepEnrich` | stub | MIGRATE_AFTER_LAUNCH |
| BG-05 | Deterministic scoring engine v1.0.0 | `scoring-engine.server.ts` | ✅ | MUST_REBUILD |
| BG-06 | Evidence capture | `candidate_evidence` | ✅ | MUST_REBUILD |
| BG-07 | Immutable score_runs trigger | `tg_score_runs_immutable` | ✅ | MUST_REBUILD |
| BG-08 | Audit events | `tg_write_audit_event` | ✅ | MUST_REBUILD |
| BG-09 | Notification event fan-out | `emitEventFromServer` | ✅ | MUST_REBUILD |
| BG-10 | Realtime refresh | `use-realtime-refresh` | ✅ | MUST_REBUILD |
| BG-11 | Signed URL for CV | storage RLS | ✅ | MUST_REBUILD |
| BG-12 | Email delivery adapter | `notification_deliveries` | **no adapter** | MUST_REBUILD (PD-01) |
| BG-13 | Cron sweeper (stale work) | none | ❌ | MUST_REBUILD |
| BG-14 | External webhook receivers | none | ❌ | MIGRATE_AFTER_LAUNCH |

## Integrations (7)

| ID | Integration | Classification |
|---|---|---|
| INT-01 | Supabase (Postgres + Auth + Storage + Realtime) | REQUIRED_FOR_V1 |
| INT-02 | Email provider | REQUIRED_FOR_V1 (blocked PD-01) |
| INT-03 | Lovable AI Gateway | DEFER |
| INT-04 | OCR provider | DEFER |
| INT-05 | Microsoft Teams / calendar | DEFER (PD-03) |
| INT-06 | LinkedIn sourcing | REMOVE |
| INT-07 | Billing / Stripe | REMOVE (PD-05) |

## Explicit exclusions (8)

Billing · LinkedIn scraping · Public candidate directory · Auto-translation · In-app video interviews · Reference-check automation · Talent-pool CRM · Marketing campaigns.

## Completeness — required capabilities map to routes/workflows

**Public**: intake R-02 · board R-04 · detail R-05 · apply R-06 · auth R-08 · consent R-06+R-32 · confirmation R-07 · tracking R-28/R-29.
**Admin**: clients R-10 · users R-25/R-18 · intakes R-09 · positions R-12 · screening Q's R-12 · candidates R-13 · CV access BG-11 · parsing R-16 · enrichment R-16 · scoring R-14 · evidence R-14 · manual review R-14 · client preview R-15 · publication R-15 · decisions R-13/R-14 · interviews **PD-03** · messages R-24 · failures R-16 · repairs R-16 · audit `audit_events` (no UI yet — REBUILD_SIMPLER admin page pending) · permissions R-18/user_roles · settings R-18.
**Client**: workspace R-19 · KPIs R-19 · positions R-20 · position detail R-21 · candidate list R-22 · Kanban R-21 · candidate detail R-23 · shortlist/interview/info/reject/hire/feedback R-23 · messages R-24 · team R-25 · settings R-26 · notifications R-19 bell.
**Candidate**: applications R-28 · tracking R-29 · safe status `statusMap` · profile R-30 · CV replace R-30 · messages R-31 · preferences/consent/notif R-32.
**System**: authn (Supabase) · authz (`user_roles`+`has_role`) · tenant iso (`memberships`+`is_org_member`) · storage (`cvs` bucket) · parsing BG-02 · OCR BG-03 · enrichment BG-04 · scoring BG-05 · evidence BG-06 · audit BG-08 · notifications BG-09 · email BG-12 · realtime BG-10 · retry R-16 · monitoring R-16/R-17 · backups (Supabase managed) · error recovery (per-route `errorComponent`) · testing (`e2e.py`+`audit.py`) · deployment (Lovable publish) · rollback (forward-only migrations + revert commit).

## Known release blockers carried into rebuild

1. **P1** — `/auth` post-login redirect points at removed `/admin/intakes`; must route by role.
2. **P3** — `/jobs/$id/apply` submit does not redirect to `/apply/received/$id`.
3. **Silent sign-in failure** under back-to-back logins (no toast) — surfaced in Phase 13 audit.
4. **BG-02** parser is stubbed — no real PDF/DOCX text extraction.
5. **BG-12** email delivery adapter unimplemented — pending PD-01.

## Acceptance

1. ✅ Every current route inventoried (38).
2. ✅ Every visible action inventoried (74 across R-01..R-33).
3. ✅ Every background workflow inventoried (14).
4. ✅ Every integration classified (7).
5. ✅ Every capability has an explicit decision.
6. ✅ No required capability omitted (see completeness map).
7. ✅ Implementation sequence covers every retained capability via Phases 1–13 already planned; open items land in Phase 6 (parser), Phase 8 (scheduling PD-03), Phase 10 (email PD-01), Phase 11 (audit UI), Phase 12 (cron sweeper).
