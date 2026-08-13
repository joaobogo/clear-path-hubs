# MVP Readiness Sign-Off — Client Dashboard

Run date: 2026-08-13 (UTC)
Scope: signed-in client dashboard (`/client/*`) plus the public surfaces that lead into it.
Method: every line below is evidence observed in this run (SQL against the live database, Vitest, tsgo, security scanner, Playwright against `localhost:8080`). Anything not observed is recorded as such rather than assumed.

## Scorecard

| # | Criterion | Verdict | Evidence observed |
|---|-----------|---------|-------------------|
| 1 | Data completeness (demo workspace) | PASS | SQL on `Northwind Talent (Demo)`: 1 position, 10 applications, 10 candidate profiles, `profiles_incomplete = 0` (name/email/city/years_experience/headline/skills/current_cv_file_id all populated), `apps_without_cv = 0`, 31 score runs with `score_runs_bad = 0` (all have `fit_label`, `score`, status `completed`), 10 candidate matches. |
| 2 | Cross-surface number consistency | PASS | `client_dashboard_kpis` for the demo org returns visible_matches 10, shortlisted 4, in_interview 2, offers 1, hires 1. Visible matches equals the raw `candidate_matches` count (10); stage buckets sum to 8, with 2 candidates still in pre-shortlist stages — consistent, no double counting. |
| 3 | Zero console errors | PARTIAL | Public routes `/`, `/jobs`, `/pricing`, `/login` and the signed-out `/client` redirect produced no app-origin console errors. Two non-app findings: (a) every page logs one 400 from `aplo-evnt.com/api/v1/intent_pixel/track_request` — third-party Apollo pixel replying "app_id not configured, or there is no valid domain configured for app_id" for the localhost origin, not our code; (b) one transient React hydration warning fired during the client-side redirect from `/client/candidates` to `/login`; direct loads of `/login?redirect=...` produced zero page errors on retry. Signed-in routes were not sampled this run (see #6). |
| 4 | Empty / error / permission states | PASS (permission path) | Signed-out `/client` redirected to `/login?redirect=%2Fclient` and `/client/candidates` to `/login?redirect=<encoded filters>`, both HTTP 200 with the sign-in form rendered — no leak of workspace data, no blank screen. Empty and error states are covered by unit tests in the green suite; not re-shot in the browser this run. |
| 5 | Mobile pass | PASS | Measured `scrollWidth <= clientWidth` at 390px, 768px and 1440px on `/`, `/jobs`, `/pricing`, `/login`: 12/12 "ok", zero horizontal page scroll. Signed-in dashboard breakpoints were fixed and screenshot-verified in the previous run (header stacking, compact list column hiding, 44px List/Board toggle) and are unchanged in code since. |
| 6 | Test suite green | PARTIAL | Vitest: 112 files, **1044/1044 passed**, 0 failed. Typecheck (`tsgo --noEmit`): **0 errors**. Playwright signed-in specs (`client-dashboard.spec.ts`, `candidates-board.spec.ts`) **skipped**: `DEMO_CLIENT_EMAIL` / `DEMO_CLIENT_PASSWORD` are not present in this environment and no Supabase preview session was injected (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`), so signed-in end-to-end coverage was not executed here. |
| 7 | Security scan clean | PARTIAL | Scan at 2026-08-13T22:00Z: 0 critical, 0 error, **5 warnings**: `SUPA_anon_security_definer_function_executable`, `SUPA_authenticated_security_definer_function_executable`, `jd_bucket_missing_ownership_check` (job-descriptions bucket policy trusts the folder UUID), `position_locations_public_exposure` (headcount/notes readable by anon on active public positions), `messages_thread_id_auth_uid_design` (latent design risk). No missing-RLS or exposed-table findings. |
| 8 | Demo walkthrough under five minutes | NOT VERIFIED | Cannot be timed without demo credentials or an injected session (same blocker as #6). Public-route loads measured well under 3s each, so the path length is plausible, but the signed-in walkthrough itself was not executed and is therefore not claimed. |

## Verdict

**NOT READY — sign-off blocked on verification, not on known defects.**

The dashboard's data, numbers, typecheck, unit suite, permission redirects and responsive layout all pass on observed evidence. What is missing is proof for the three signed-in criteria, plus two security warnings that touch real data exposure.

## Shortest blocking list

1. Provide demo client credentials to the test environment (`DEMO_CLIENT_EMAIL`, `DEMO_CLIENT_PASSWORD`, optional `DEMO_CLIENT_WORKSPACE`) or sign in once via the preview so a session is injected, then run `client-dashboard.spec.ts` and `candidates-board.spec.ts` and record the pass counts plus a timed walkthrough (login → roles → candidates list → candidate detail → CV download).
2. Restrict anon-readable columns on `position_locations` so headcount and notes are not public (`position_locations_public_exposure`).
3. Add an ownership join to the `job-descriptions` bucket read policy instead of trusting the path's org UUID (`jd_bucket_missing_ownership_check`).
4. Confirm the Apollo pixel `app_id` has the production domain configured, so the 400 disappears on `taasflow.com` rather than only being a localhost artifact.

Non-blocking follow-ups: the transient hydration warning on the signed-out `/client/candidates` redirect, and the `messages.thread_id` design refactor.

## How to compare the next run

Re-run in this order and diff against the table above: Vitest totals, `tsgo` error count, the demo-workspace completeness SQL (expect all `*_incomplete` / `*_bad` / `*_without_cv` counters at 0), `client_dashboard_kpis` vs raw match counts, the security scan counts by level, the three-width overflow matrix, and the signed-in Playwright specs. A criterion may only be marked PASS with output from that run attached.
