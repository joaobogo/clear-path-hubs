# Route Summary — TaaSFlow V2 Master Ledger

**Total routes recorded:** 362

## By route type
- APPLICATION: 1
- AUTH: 3
- BLOG_ARTICLE: 304
- BLOG_INDEX: 1
- CANDIDATE: 1
- CASE_STUDY: 1
- COMPANY: 3
- DASHBOARD: 4
- EMPLOYER: 2
- ENTERPRISE: 1
- HOMEPAGE: 1
- INDUSTRY_DETAIL: 24
- INDUSTRY_HUB: 2
- INTAKE: 1
- JOB_BOARD: 1
- JOB_DETAIL: 1
- KNOWLEDGE_BASE: 1
- LEGACY: 3
- LEGAL: 2
- PILOT: 1
- PRICING: 1
- RESOURCE_HUB: 1
- SOLUTION: 1
- UNKNOWN: 1

## By migration classification
- KEEP_DESTINATION_IMPLEMENTATION: 11
- MIGRATE_AS_IS: 346
- REDIRECT_TO_DESTINATION: 5

## By priority
- P0: 14
- P1: 12
- P2: 3
- P3: 330
- P4: 3

## Notes
- 23 top-level public source routes verified live (HTTP 200) at https://sourcing-suite-ai.lovable.app.
- 24 industry detail routes and 304 blog article routes derived from destination content mirror (source repo not publicly accessible).
- 11 destination-operational routes classified KEEP_DESTINATION_IMPLEMENTATION (must not be replaced by source code).
- 3 legacy routes classified REDIRECT_TO_DESTINATION (`/taasflow-journey`→`/journey`, `/candidate/join`→`/jobs`, `/talent`→`/talent-network`).
- No implementation changes performed in this phase.
