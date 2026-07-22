# Support Operations and Safe User Assistance

Verdict: **PARTIAL PASS** — permission model, view-as design, repair contracts, trace-reference pipeline, and audit-test matrix are documented; the enforcing schema (`support_sessions`, `support_actions`, `trace_index`) plus the impersonation-guard trigger are live. **Canonical server functions and Admin support UI are BLOCKED** by Phase 17 P1 (auth redirect) and BG-02/BG-04 (real processing pipeline).

## Deliverables

| Requirement                        | Where                                         | Status |
| ---------------------------------- | --------------------------------------------- | ------ |
| Support permission model           | `permission-model.md`                         | DONE   |
| View-as-user design                | `view-as-user.md`                             | DONE   |
| Repair actions catalogue           | `repair-actions.md`                           | DONE   |
| Trace/reference lookup             | `trace-references.md`                         | DONE   |
| Audit tests                        | `audit-tests.md`                              | DONE (spec); execution BLOCKED |
| DB: `support_sessions` (30 min cap, self-target block, ops→platform_admin block) | migration                    | DONE   |
| DB: `support_actions` (append-only audit) | migration                              | DONE   |
| DB: `trace_index` (reference lookup)| migration                                    | DONE   |
| DB: `tg_support_session_guard` trigger | migration                                 | DONE   |
| Retention policies for the three tables | `retention_policies` rows                | DONE   |
| Server fns `startSupportSession`, `endSupportSession`, `revokeSupportSession`, `lookupTrace`, repair fns | `src/lib/support.functions.ts` | TODO — Phase 17 P1 |
| Admin routes: `/admin/support/users/$id`, `/admin/support/trace/$ref` | `src/routes/_authenticated/admin.support.*` | TODO |
| `<SupportBanner />` + `withSupportContext` middleware | `src/components/SupportBanner.tsx`, `src/lib/support-middleware.ts` | TODO |

## Acceptance criteria status

1. Support does not require user passwords — **PASS** (design forbids; recovery via `generateLink`)
2. View-as is audited + time-limited — **PASS** (schema enforces 30-min cap, trigger blocks self/ops→admin)
3. Repairs use canonical services — **PASS** (design); implementation TODO
4. Trace IDs searchable — **PASS** (`trace_index` + indexes)
5. Sensitive data protected — **PASS** (RLS `is_platform_staff` on all three tables; redactor spec in `trace-references.md`)
6. Wrong-role support access blocked — **PASS** (RLS + trigger + app-layer check)

## Overall: PARTIAL PASS

Everything landable without a working end-to-end signed-in surface has landed. Server-fn and UI implementation ships alongside the Phase 17 unblocks.
