# Scale Risks and Mitigations

| # | Risk                                       | Trigger                              | Impact                       | Mitigation |
| - | ------------------------------------------ | ------------------------------------ | ---------------------------- | ---------- |
| 1 | Realtime connection ceiling on shared plan | > 500 concurrent Kanban+chat users   | Dropped subscriptions        | Upgrade Lovable Cloud compute; batch match updates via broadcast channel keyed by `position_id`. |
| 2 | Scoring cost blow-up                       | Bulk rescoring loop or bad prompt    | 10× budget spike             | `cost_limits` hard caps; `rescore` requires evidence-hash change; anomaly alert at 3× hourly median. |
| 3 | Storage cost drift                         | Retained CVs past 180d               | Linear storage growth        | Retention sweeper deletes originals per `retention_policies`; keeps redacted copy 24 months. |
| 4 | pg_trgm search latency at 1M candidates    | Global search over full-text         | p95 > 1 s                    | Partition `candidate_profiles` by created_at year; add `search_vector` tsvector column + GIN. |
| 5 | Audit table bloat                          | Every write logged                   | Query slowdown across joins  | Monthly partition on `audit_events(occurred_at)`; hot 30d retained in main table. |
| 6 | Notification fanout storm                  | Position update to 10k candidates    | DB write spike               | Batch inserts of 1k; dedupe on `(user, event_type, entity_id, day)`. |
| 7 | Provider outage                            | Lovable AI 5xx > 5 min               | Scoring backlog              | Circuit-breaker on `score_runs`; jobs stay `queued`, resume auto; SLA banner in Admin. |
| 8 | Runaway background jobs                    | Deploy bug leaves job in `running`   | Blocked queue                | 15-min sweeper resets; 3 failures disable job + page on-call. |
| 9 | Cursor pagination assumptions              | Client uses `page=` deep-links       | Slow offset scans            | Cursors are opaque + signed; expire after 24 h to force refresh. |
| 10| Cost data leak to clients                  | Bad RLS in ops view                  | Confidentiality breach       | `provider_usage_events` + `cost_limits` gated by `is_platform_staff`; contract test in privacy-tests. |
