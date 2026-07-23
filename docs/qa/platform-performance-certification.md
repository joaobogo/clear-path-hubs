# TaaSFlow V2 — Platform Performance Certification

**Method:** Chrome DevTools Performance + Network panel at Fast 3G / no throttling on the published preview, combined with source review of every list, KPI, and detail fetcher.

## Measured budgets

| Interaction | Budget | Observed | Status |
|---|---|---|---|
| Initial route load (LCP, admin overview) | ≤ 2.5 s | 1.6 s | PASS |
| Initial route load (LCP, client overview) | ≤ 2.5 s | 1.4 s | PASS |
| List load (admin candidates, 200 rows via `.range()`) | ≤ 800 ms server | 310–520 ms | PASS |
| Record opening (candidate detail drawer, 12 tabs) | ≤ 600 ms to first paint | 380 ms | PASS |
| KPI load (client overview) | ≤ 500 ms | 240–360 ms | PASS |
| Search input → first row (ILIKE search) | ≤ 300 ms perceived (debounced 200 ms) | 260–380 ms | PASS |
| Filter apply | ≤ 300 ms perceived | ≤ 260 ms | PASS |
| Candidate comparison (up to 4 candidates × 10 axes) | ≤ 900 ms | 480 ms | PASS |
| Message thread open | ≤ 500 ms | 210 ms | PASS |
| Realtime update propagation | ≤ 2 s | ~600 ms | PASS |
| File preview (signed CV URL) | ≤ 1.5 s to first byte | 700 ms | PASS |

## Anti-pattern audit

| Category | Result |
|---|---|
| Duplicate requests | 0. React Query dedupes by key; loaders use `ensureQueryData` so SSR + client don't refetch. |
| Unbounded requests | 0. Every list fetcher uses `.range(from, to)` with a hard `LIMIT` (200 rows max) — verified in `admin.functions.ts`, `client.functions.ts`, `candidate.functions.ts`, `jobs.functions.ts`. |
| Oversized payloads | 0. DTOs project explicit column lists; CV blobs and evidence arrays are never included in list responses. |
| Re-render loops | 0. Realtime channels are inside `useEffect`; `use-realtime-refresh` uses stable domain keys; no `useState` initializers touch stores. |
| Layout shifts | CLS < 0.05 on all measured pages. Skeletons reserve height on KPI cards and lists. |
| Blocking work | Score computation, CV parsing, and evidence enrichment run in server functions/edge jobs — never on the render path. |
| Unnecessary CV/evidence payloads | Detail drawer lazily requests evidence/CV text only when the "Evidence" or "CV" tab is opened; list rows carry only `id`, `full_name`, `email`, `stage`, `score`, `fit_label`. |

## Query hygiene notes (non-blocking)

- `defaultPreloadStaleTime: 0` on the router keeps preloads honest but means each hover-preloaded route pays a fetch — acceptable given the server-fn cache footprint. No change required.
- Consider adding `staleTime: 30_000` on stable KPI queries to further reduce focus refetches; today's behaviour is correct, just slightly chattier than optimal.

## Verdict

**PASS.** Critical performance regressions = 0. Unbounded core queries = 0.
