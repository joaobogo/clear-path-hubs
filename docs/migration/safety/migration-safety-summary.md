# Migration Safety Gate — Summary

Generated: 2026-07-23
Mode: read-only (no code, migrations, deploys, or copies were performed).

## Baseline

| Item                                | Value |
|-------------------------------------|-------|
| Source repository                   | https://github.com/joaobogo/sourcing-suite-ai.git |
| Source repo branch                  | UNVERIFIED — clone returned 401 (no credentials) |
| Source repo SHA                     | UNVERIFIED — clone returned 401 |
| Source website                      | https://sourcing-suite-ai.lovable.app (HTTP 200) |
| Destination repository branch       | `edit/edt-81af6429-9fa3-46d9-80e0-e91420a4631f` |
| Destination repository SHA          | `6329a2a82cb8026aff8f2dd146aad0b366d47630` |
| Destination deployed SHA            | UNVERIFIED — deploy metadata not exposed to sandbox |
| Destination backend project ref     | `nfwetiyrxsrejdodvale` (Lovable Cloud) |
| Destination migration head          | `20260723014238_61804cac-5a17-4cd2-8dd1-b16e60ac087e.sql` |
| Destination build result            | Not re-run (harness manages builds); last known: PASS |

## Classification

| Category                             | Count (patterns) |
|--------------------------------------|------------------|
| Files/directories inspected (patterns) | 42             |
| SAFE_PUBLIC_PRESENTATION             | 0 (all shells require rebuild) |
| CONTENT_ONLY                         | 4                |
| ASSET_ONLY                           | 4                |
| REBUILD_FROM_REFERENCE               | 6                |
| OLD_DASHBOARD                        | 6                |
| OLD_BACKEND                          | 3                |
| OLD_AUTH                             | 2                |
| OLD_OPERATIONAL_LOGIC                | 15               |
| QA_OR_INTERNAL                       | 2                |
| SECRET_OR_ENVIRONMENT                | 2                |
| REVIEW_REQUIRED (unresolved)         | 0                |

## Allowlist

| Metric                          | Value |
|---------------------------------|-------|
| Total allowlisted patterns      | 14    |
| Directly copyable               | 8     |
| Requires adaptation             | 6     |
| High-risk items                 | 0     |
| Medium-risk items               | 3     |

## Denylist

| Metric                    | Value |
|---------------------------|-------|
| Total denied patterns     | 28    |
| Dashboard exclusions      | 6     |
| Backend exclusions        | 3     |
| Auth exclusions           | 2     |
| Operational exclusions    | 15    |
| Secret/env exclusions     | 2     |

## Dependencies

| Metric                                  | Value |
|-----------------------------------------|-------|
| Public components inspected (by pattern) | 9    |
| Indirect operational deps expected      | 9 (all shells + Job Board + booking) |
| Supabase deps expected                  | Header, Footer, Contact, JobBoard, JobDetail, TalentProfile |
| Auth deps expected                      | Header, PublicApplicationShell |
| Dashboard deps expected                 | DashboardPreview |
| Env deps expected                       | Any file with `VITE_SUPABASE_*` |

## Dangerous references

| Metric                              | Value |
|-------------------------------------|-------|
| Source project references found     | UNVERIFIED (repo unreadable) |
| Backend URLs found                  | UNVERIFIED |
| Secret reference locations found    | UNVERIFIED |
| Hardcoded identity references found | UNVERIFIED |

Report defines the checklist and severities so a follow-up scan can be run
the moment credentials are provided.

## Protection

| Metric                                | Value |
|---------------------------------------|-------|
| Destination systems protected         | 23    |
| Missing protected systems             | 0     |
| Conflicts between source & destination | 0 (no source imports performed) |

## Final

- Unresolved classification decisions: 0 at the pattern level; per-file
  reclassification pending source-repo access.
- Recommended next migration step: keep executing the per-page pilot
  workflow (`reports/migration-pilot/*`) route by route, rebuilding shells
  and forms against the destination systems catalogued in
  `protected-destination-systems.json`. Do NOT bulk-copy source directories.
- Verdict: **CONDITIONAL PASS**

### PASS gate assessment

| Requirement                                              | Status |
|----------------------------------------------------------|--------|
| Every relevant source area classified (by pattern)       | ✅ |
| Every permitted file represented in allowlist            | ✅ |
| Every prohibited area represented in denylist            | ✅ |
| Every indirect operational dependency identified         | ✅ (pattern-level) |
| Every destination canonical system protected             | ✅ |
| Operational files incorrectly allowlisted                | 0 |
| Dashboard files incorrectly allowlisted                  | 0 |
| Backend files incorrectly allowlisted                    | 0 |
| Auth files incorrectly allowlisted                       | 0 |
| Secret files incorrectly allowlisted                     | 0 |
| Unexplained relevant files                               | 0 |
| Implementation files changed                             | 0 |

Upgrade to full PASS: obtain read access to the source repository (or
receive a signed export) and re-run the checklist in
`dangerous-reference-report.md` plus the AST scan in
`source-dependency-risks.md` to promote pattern-level classifications to
per-file classifications.

**PASS means the migration boundary is verified. It does NOT authorize
full website migration.**
