# TAASFLOW V2 — Public Migration Guardrails

Authoritative reference for every public-migration change. Applies to all repair-queue work and any content sourced from https://taasflow.com.

## Roles

- **Source (reference only)**: https://taasflow.com — used for marketing content and route intent.
- **Destination (canonical, do not modify from legacy)**: https://clear-path-hubs.lovable.app

## Protected canonical systems (destination is source of truth)

Do NOT import legacy code, do NOT recreate legacy logic for:

- Admin dashboard
- Client dashboard
- Candidate dashboard
- Employer intake
- Job Board
- Job details
- Candidate application
- Authentication (login / signup / password reset)
- Account creation
- Application tracking
- Database
- CV processing
- Enrichment
- Evidence
- Scoring
- Publication
- Messages
- KPIs
- Realtime synchronization

Any repair task that would touch these systems must stop and be re-scoped.

## Commercial-claim gate: `OWNER_DECISION_REQUIRED`

When any source page references the values below, preserve the surrounding
structure (heading, layout, CTA) but replace the value with the literal
placeholder `OWNER_DECISION_REQUIRED` unless the value has already been
verified for the new site in `docs/migration/verified-claims.json`.

Gated claims:

1. `$399 pilot`
2. `$6,999 pricing`
3. `7–14 day delivery`
4. Candidate-placement totals
5. Countries covered
6. Company totals
7. Savings percentages
8. Cancellation terms
9. Discounts
10. Enterprise volume claims
11. Visa or relocation support

## Verification ledger

- Approved rewrites: `reports/public-parity/approved-rewrites.json` (create as needed)
- Approved asset replacements: `reports/public-parity/approved-replacements.json`
- Verified commercial claims: `docs/migration/verified-claims.json`
- Protected route ledger: `reports/public-parity/protected-route-manifest.json`

A page-parity diff is only "explained" once it appears in one of the ledgers
above. Otherwise the certification gate treats it as unresolved.
