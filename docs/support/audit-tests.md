# Audit Tests

To be executed once Phase 17 blockers clear. All tests run against seeded fixtures.

| # | Test                                                                                          | Expected result                                                                                              | Enforced by |
| - | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| 1 | Client user calls `startSupportSession` via server fn                                         | 403 Forbidden; no row in `support_sessions`; no `support_actions` row                                        | RLS + role check |
| 2 | Ops user tries to view-as a platform_admin                                                    | `insufficient_privilege` from trigger `tg_support_session_guard`; no row                                     | DB trigger |
| 3 | platform_admin starts view-as with `expires_at = now() + 45 min`                              | Insert rejected by `CHECK expires_at <= started_at + interval '30 minutes'`                                  | DB CHECK |
| 4 | Successful view-as: verify banner visible + target user sees notification                     | `<html data-support="active">` present in DOM; notification row exists                                       | E2E |
| 5 | While `scope='read_only'`, staff attempts `moveMatchStage`                                    | `SupportReadOnlyError`; no candidate_match state change; audit row absent                                    | Writer wrapper |
| 6 | While `scope='elevated'`, staff performs `resendInvitation`                                   | 1 `support_actions('resend_invitation')` row with `session_id` set + `before/after_state`                    | Canonical service |
| 7 | Exit support session (button)                                                                 | Cookie cleared; `ended_at` set; `end_reason='user_exit'`; banner disappears                                  | Middleware |
| 8 | Expiry reached without exit                                                                   | Cookie treated as invalid; next request has `supportActive=false`; ledger updated with `end_reason='expired'`| Middleware |
| 9 | Client user queries `support_sessions`                                                        | 0 rows (RLS filters)                                                                                          | RLS |
|10 | Support looks up `err_XXX` on `/admin/support/trace/$ref`                                     | Returns request + user + tenant + failure_reason; no PII (no email/CV bytes) in `request_summary`            | Redactor |
|11 | Deactivate user                                                                                | Profile status='disabled'; all sessions invalidated; memberships marked inactive; `deactivate_user` action logged | Canonical service |
|12 | Two rapid identical `unlockAccount` calls within 60 s                                         | Second call short-circuits and returns same `traceId`; only 1 audit row                                      | Idempotency key |

## Status

- Rules 1–3, 9 are enforced by the schema/policies/triggers landed in this phase and can be smoke-tested with SQL today.
- Rules 4–8, 10–12 depend on server fns + Admin UI, which are BLOCKED by Phase 17 P1 (auth redirect) and BG-02/BG-04 (real processing pipeline).
