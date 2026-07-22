# Background Jobs

All async work lives in `processing_jobs` (durable state) + `pg_cron` (schedule) + `/api/public/hooks/*` (execution). No in-memory queues.

| Job                       | Trigger                        | Handler                                          | Idempotency key                      |
| ------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------ |
| `cv_parse`                | on `submitApplication`         | `/api/public/hooks/process-cv`                   | `(candidate_id, file_sha256)`        |
| `ocr`                     | after `cv_parse` if empty text | `/api/public/hooks/ocr`                          | `(file_sha256)`                      |
| `enrichment`              | after `parsed`                 | `/api/public/hooks/enrich`                       | `(candidate_id, week_of)`            |
| `score`                   | after `enriched`               | `/api/public/hooks/score`                        | `(candidate_id, position_id, evidence_hash)` |
| `notification_digest`     | pg_cron `0 8 * * *` per-tz     | `/api/public/hooks/notification-digest`          | `(user_id, day)`                     |
| `retention_sweep`         | pg_cron `0 3 * * *`            | `/api/public/hooks/retention-sweep`              | `(policy_id, day)`                   |
| `processing_job_sweeper`  | pg_cron `*/5 * * * *`          | `/api/public/hooks/sweep-jobs`                   | none — resets running > 15 min       |
| `support_session_sweeper` | pg_cron `*/1 * * * *`          | `/api/public/hooks/sweep-support-sessions`       | none                                 |

Retries: 2 with jitter; 3rd failure marks `failed` and alerts. See `docs/capacity/cost-model.md` for caps.
