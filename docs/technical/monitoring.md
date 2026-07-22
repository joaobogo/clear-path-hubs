# Monitoring

## Signals

- Worker logs: `stack_modern--server-function-logs` (last hour, filterable).
- Postgres: `supabase--db_health`, `supabase--slow_queries`, `supabase--analytics_query`.
- App analytics: `analytics--read_project_analytics`.
- Provider usage: `provider_usage_events` (see `/admin/operations` — to build).
- Trace lookup: `trace_index` (see `docs/support/trace-references.md`).

## Golden signals per surface (targets from `docs/capacity/performance-budgets.md`)

- Latency (p50/p95/p99), error rate, throughput, saturation (connections, memory).

## Alerts (to wire once metrics pipeline exists)

| Alert                                    | Condition                                    | Owner        |
| ---------------------------------------- | -------------------------------------------- | ------------ |
| Auth failure spike                        | > 3× 7d hourly median                        | Security     |
| Scoring failure rate                      | > 10% hourly                                  | Scoring      |
| Provider hourly spend                     | > 3× 7d hourly median                         | Engineering  |
| DB connections > 80%                      | 5 min sustained                               | Engineering  |
| Support session count                     | > 5 concurrent for > 15 min                   | Security     |
| Realtime disconnect ratio                 | > 5% subscribers/min                          | Engineering  |
