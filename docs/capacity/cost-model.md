# Cost Model

Per-operation cost estimates (US$ micro-cents; `cost_estimate_micros` in `provider_usage_events`).

## Unit costs (assumed)

| Operation      | Provider       | Unit cost (est.) | Basis |
| -------------- | -------------- | ---------------: | ----- |
| CV parse       | Lovable AI + docx/pdf reader | $0.0020 | ~2k tokens @ Gemini Flash. |
| OCR            | Lovable AI vision | $0.0080 | Per page average. |
| Enrichment     | Lovable AI     | $0.0040 | 1 pass. |
| Score          | Lovable AI     | $0.0060 | Per candidate × position; evidence-first prompt ~4k in / 1k out. |
| Rescore        | Lovable AI     | $0.0060 | Same as score; gated. |
| Notification   | internal       | $0.00005 | DB + realtime. |
| Email          | Resend / SES   | $0.0004 | Per send. |
| Storage/GB/mo  | Supabase       | $0.021  | Only marginal above included tier. |

## Projected monthly spend

| Tier   | Parse | OCR  | Enrich | Score | Rescore | Notif | Email | Storage | **Total** |
| ------ | ----: | ---: | -----: | ----: | ------: | ----: | ----: | ------: | --------: |
| Small  | $4    | $2   | $4     | $36   | $3      | $1    | $2    | $0.4    | **~$52** |
| Growth | $40   | $16  | $40    | $360  | $30     | $4    | $20   | $3.4    | **~$513** |
| Scale  | $400  | $160 | $400   | $3,600 | $300    | $40   | $200  | $34     | **~$5,134** |

Score dominates spend at every tier — the caps in `cost_limits` are set accordingly.

## Enforced limits (see `cost_limits` table)

| Op          | per entity/day | per org/day | per platform/hr | Notes |
| ----------- | -------------: | ----------: | --------------: | ----- |
| cv_parse    | 3              | 200         | 2,000           | Idempotent by SHA-256 file hash; extra calls short-circuit. |
| ocr         | 2              | 100         | 1,000           | Only when text-layer empty. |
| enrichment  | 1              | 50          | 500             | 1x per 30d per candidate; retry cap 1. |
| score       | 5              | 500         | 5,000           | Blocks duplicate scoring within window. |
| rescore     | 2              | 200         | 1,000           | Requires reason + evidence hash change. |
| notification| 50             | 5,000       | 20,000          | Per-user per-day. |
| email       | 20             | 2,000       | 10,000          | Excludes transactional receipts. |

## Prevention rules

- **Duplicate parse**: guard by `(candidate_profile_id, file_sha256)` unique key on `processing_jobs`.
- **Duplicate enrichment**: `enriched_at` on candidate_profiles + 30d window.
- **Duplicate score**: unique `(candidate_profile_id, position_id, evidence_hash)` on `score_runs`.
- **Provider retry**: max 2 retries with jitter; a 3rd failure marks job `failed` and requires manual retrigger.
- **Oversized files**: 10 MB hard cap at server; rejected before storage put.
- **Runaway jobs**: `processing_jobs` older than 15 min in `running` state auto-reset by sweeper; jobs failed 3× disabled and paged.

## Cost visibility (Admin only)

Route: `/admin/operations` (to build). Shows, over 24h/7d/30d:
- provider usage volume by operation
- processing volume (successes) vs. failures vs. retries
- ≈ operational cost from `SUM(cost_estimate_micros)/1e6`
- spike detection: any operation with hourly volume > 3× 7d-hour-of-week median flags red

Never surfaced to client or candidate roles (RLS enforced by `is_platform_staff` on both `provider_usage_events` and `cost_limits`).
