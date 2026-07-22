# Service Boundaries

| Service module                          | Owns                                       | Callable from            |
| --------------------------------------- | ------------------------------------------ | ------------------------ |
| `src/lib/intake.functions.ts`           | intake submit, retry, rollback             | public + admin           |
| `src/lib/apply.functions.ts`            | job application submit, receipt            | public                   |
| `src/lib/positions.functions.ts`        | activate/pause/close, requirements         | client_admin, staff      |
| `src/lib/matches.functions.ts`          | publish, unpublish, moveMatchStage, dedupe | staff + client roles     |
| `src/lib/scoring-engine.server.ts`      | deterministic score + evidence-first LLM call | scoring worker only   |
| `src/lib/scoring.functions.ts`          | rescore, override, revert                  | staff                    |
| `src/lib/messaging.functions.ts`        | sendMessage, listThreadMessages            | authenticated            |
| `src/lib/notifications.functions.ts`    | emit, digest, preferences                  | authenticated + hooks    |
| `src/lib/support.functions.ts`          | startSupportSession, repair actions        | staff                    |
| `src/lib/governance.functions.ts`       | DSR intake + fulfillment, retention sweep  | staff + hooks            |
| `src/lib/search.functions.ts`           | globalSearch                               | authenticated            |
| `src/routes/api/public/hooks/*`         | pg_cron/webhook callbacks                  | pg_cron with `apikey`    |

Rule: **UI never writes Supabase directly.** Every mutation goes through a `.functions.ts` server fn or a hook route. Reads may use TanStack Query with the auth-attached bearer.
