# Missing / Incorrect Public Routes

Companion to `docs/migration/public-route-manifest.md`. Every entry has an explicit decision — nothing is silently excluded.

## A. Missing on destination

### A.1 `/dashboard-preview`
- **Source page type:** Marketing teaser linking to a mocked dashboard view.
- **Source navigation origin:** Home page "See it live → Open dashboard preview" link.
- **Destination status:** absent.
- **Decision:** `EXCLUDE_WITH_EXPLICIT_REASON`.
- **Reason:** Displays the legacy operational dashboard UI, which is inside the protected-systems guardrail (`docs/migration/exclusions/exclusion-ledger.json` EX-001/EX-002 and `docs/migration/guardrails.md` protected list). Migrating it would recreate legacy dashboard components. If a future public workspace tour is desired, it must be built from fresh screenshots of the canonical destination workspaces — not by porting source code.

### A.2 `/subscribe`
- **Source page type:** Newsletter subscribe landing (source repo route only; not surfaced in the live header/footer).
- **Destination status:** absent.
- **Decision:** `MERGE_WITH_EXPLICIT_APPROVAL`.
- **Reason:** The destination has no newsletter provider, list, or unsubscribe flow. Building one requires an owner decision on provider, GDPR consent copy, and double-opt-in. Do not implement until approved.

## B. Incorrect / renamed on destination

### B.1 `/login` (source) vs `/auth` (destination)
- **Symptom:** `src/config/public-navigation.ts` renders `/login` in `SECONDARY_CTAS` and multiple footer groups, but the destination route file is `src/routes/auth.tsx` at path `/auth`. Result: every "Sign in" link 404s.
- **Decision:** `REDIRECT` (add `/login → /auth`, 301) **plus** correct the nav config to link `/auth` directly.
- **Note:** Auth implementation itself is protected (EX-005). Only the link target and a route-level redirect are in scope here.

### B.2 `/talent-marketplace` vs `/talent-network` overlap
- **Symptom:** Destination has both `/talent-marketplace` and `/talent-network` as separate routes. Source treats "talent network" as the live public concept; "talent marketplace" exists only in the source repo.
- **Decision:** `MERGE_WITH_EXPLICIT_APPROVAL`.
- **Options for owner:**
  1. Keep `/talent-network` canonical; redirect `/talent-marketplace → /talent-network`.
  2. Position them as distinct products (candidates hub vs. skills marketplace) — requires positioning copy that isn't in the source.
- **Default recommendation:** Option 1 unless a distinct marketplace product is being launched.

### B.3 `/candidate-join` vs legacy `/candidate/join`
- **Symptom:** Destination has a `/candidate-join` page **and** an outstanding redirect ledger entry for `/candidate/join → /jobs`. The candidate-join page duplicates job-board CTAs.
- **Decision:** `MERGE_WITH_EXPLICIT_APPROVAL`.
- **Options for owner:**
  1. Redirect `/candidate-join → /jobs` (consistent with the legacy `/candidate/join → /jobs` redirect).
  2. Keep `/candidate-join` as a marketing landing that funnels to `/jobs` — requires distinct copy.

## C. Redirects still to implement (all PENDING in ledger)

| From | To | Ledger id |
|---|---|---|
| `/taasflow-journey` | `/journey` | redirect-ledger.json #1 |
| `/candidate/join` | `/jobs` | redirect-ledger.json #2 |
| `/talent` | `/talent-network` | redirect-ledger.json #3 |

Add these on the destination via TanStack route handlers or `src/routes/api/public/*` where a full server-side 301 is required. Implementation is out of scope for this audit.

## D. Blog and industry leaves

- **Industries:** all 22 source leaves plus `/industries` and `/industries/compare` have matching destination routes (`/industries/$slug`). No gaps.
- **Blog:** destination content directory has ~304 slug files; source `sitemap-blog.xml` was not enumerated in this audit. **Follow-up decision required at content level (not route level):** confirm every source blog slug either has a matching JSON at `src/content/blog/{slug}.json` or an explicit exclusion. This does not affect route decisions (dynamic route `/blog/{slug}` matches all cases) and therefore does not block PASS on this audit.

## Result

Every gap above carries an explicit decision. **Unresolved route decisions: 0.**
