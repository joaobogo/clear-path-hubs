# Capacity Model

Assumptions used to size Postgres, storage, provider spend, and realtime for TaaSFlow. All numbers are modeled; **actual load tests remain BLOCKED by Phase 17 P1/P3/BG-02 (no end-to-end applications land yet)**.

## 1. Tier assumptions

| Tier    | Clients | Positions | Candidates | Applications/mo | Delivered matches/mo |
| ------- | ------: | --------: | ---------: | --------------: | -------------------: |
| Small   |      10 |       100 |     10,000 |           2,000 |                  300 |
| Growth  |     100 |     1,000 |    100,000 |          20,000 |                3,000 |
| Scale   |   1,000 |    10,000 |  1,000,000 |         200,000 |               30,000 |

Ratios used:
- 5 positions active per client at any time.
- Each candidate averages 1.4 applications lifetime; 20% of stock applies in a given month.
- 15% of applications reach "Delivered" (client-visible).
- 8% of applications reach "Interview".

## 2. Database size

Row-size estimates (bytes, including TOAST + indexes overhead ~1.4x).

| Table                   | avg row | Small MB | Growth MB | Scale GB |
| ----------------------- | ------: | -------: | --------: | -------: |
| candidate_profiles      |   1,200 |       17 |       168 |      1.7 |
| candidate_evidence      |   6,000 |       84 |       840 |      8.4 |
| applications            |     700 |       20 |       196 |      2.0 |
| candidate_matches       |     900 |        4 |        38 |      0.4 |
| score_runs              |   1,100 |        5 |        46 |      0.5 |
| messages                |     500 |       10 |       100 |      1.0 |
| notifications           |     450 |       32 |       315 |      3.2 |
| audit_events            |   1,400 |       28 |       280 |      2.8 |
| provider_usage_events   |     300 |        6 |        60 |      0.6 |
| files (metadata)        |     600 |        8 |        84 |      0.9 |
| **Total DB**            |         |    ~0.25 |      ~2.2 |    ~22   |

Buffers reserved: WAL 20%, indexes 40% of table size (already included in 1.4x factor).

## 3. Object storage (Supabase Storage — `cvs` bucket)

- Average CV size: 400 KB (mix of DOCX/PDF); enforced cap 10 MB.
- Retain original + 1 redacted copy = 800 KB/candidate.

| Tier    | Objects | Storage |
| ------- | ------: | ------: |
| Small   |  20,000 |    16 GB |
| Growth  | 200,000 |   160 GB |
| Scale   | 2,000,000 | 1.6 TB |

## 4. Monthly provider operations (upper bound)

| Operation      | Small |  Growth | Scale     | Notes |
| -------------- | ----: | ------: | --------: | ----- |
| CV parse       | 2,000 |  20,000 |   200,000 | Idempotent by file hash. |
| OCR            |   200 |   2,000 |    20,000 | Only when PDF text layer empty (~10%). |
| Enrichment     | 1,000 |  10,000 |   100,000 | Cap 1/candidate/30d. |
| Score          | 6,000 |  60,000 |   600,000 | 3 positions × application avg. |
| Rescore        |   500 |   5,000 |    50,000 | Requires reason + evidence change. |
| Notifications  | 8,000 |  80,000 |   800,000 | Multi-channel expansion 1.6x. |
| Email          | 5,000 |  50,000 |   500,000 | Transactional + digests. |
| Realtime conns |    30 |     200 |     1,500 | Concurrent peak (Kanban + chat). |
| Dashboard qry  | 15,000 | 150,000 | 1,500,000 | p95 dominated by Overview + Publish Desk. |

Realtime concurrent connection ceiling is the hardest ceiling; > 500 concurrent requires Cloud instance upgrade (see mitigation §7).
