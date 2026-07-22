# Performance Budgets

Every budget is enforced by `docs/operability/performance-tests.md` scale suite once BG-SCALE-01 is unblocked. Failures are P1.

## Interaction budgets

| Interaction              | p50   | p95   | p99   | Failure rate | Notes |
| ------------------------ | ----: | ----: | ----: | -----------: | ----- |
| Login (Supabase)         | 300ms |  900ms | 1.5s  | < 0.5%       | Cold-start tolerated first hit only. |
| Overview load (Admin)    | 400ms | 1.2s  | 2.0s  | < 0.5%       | Query budget §candidate_pipeline. |
| Candidates list load     | 350ms | 1.0s  | 1.8s  | < 0.5%       | Cursor page = 50. |
| Candidate drawer open    | 200ms |  600ms | 1.0s  | < 0.5%       | Includes evidence fetch. |
| Position page            | 250ms |  800ms | 1.3s  | < 0.5%       | Preloaded via loader. |
| Intake submit            | 600ms | 1.5s  | 3.0s  | < 1.0%       | Server fn; idempotent. |
| Job application submit   | 800ms | 2.0s  | 4.0s  | < 1.0%       | Includes file upload finalize. |
| File upload (10 MB CV)   |  4s   |  10s  |  15s  | < 1.0%       | Direct-to-storage signed URL. |
| Global search            | 150ms |  500ms | 900ms | < 0.5%       | Trigram + rank. |
| Filter apply             |  50ms |  250ms | 500ms | < 0.5%       | URL round-trip only. |
| Kanban stage mutation    | 250ms |  700ms | 1.2s  | < 0.5%       | Emits event + realtime broadcast. |
| Message send             | 200ms |  600ms | 1.0s  | < 0.5%       | Realtime insert. |
| Notification fanout      | 500ms | 2.0s  |  5s   | < 1.0%       | Background; user-visible only via bell badge. |

All server-side numbers are measured at the server-function boundary; add ~80–150 ms edge RTT for real users.
