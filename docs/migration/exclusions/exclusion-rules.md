# Exclusion Rules — TaaSFlow V2 Migration

Excluded from source → destination migration (never copy code, only reference for domain understanding).

## Never migrate

- `src/pages/dashboard/**` — operational dashboards
- `src/components/dashboard/**` — operational dashboard components
- Dashboard-specific hooks, services, state
- Old Client/Admin/Candidate dashboards
- Old Supabase clients, migrations, Edge Functions
- Old Auth, memberships, organizations logic
- Old position, candidate, job board, application data logic
- Old intake transaction logic
- Old parsing, OCR, enrichment, evidence, scoring, publication logic
- Old Client-action logic, KPI calculations
- Old realtime bridges, notifications, processing jobs
- QA scripts, QA reports, test data
- Environment files, secret configuration

## Reason
The destination already implements the operational stack against a fresh
Supabase project with hardened RLS, canonical service functions, and
role-based access. Migrating source operational code would introduce
duplicate schemas, insecure clients, and legacy assumptions.

## Enforcement
Any pull request that adds files matching the excluded paths must be
rejected in code review and blocked from the destination worker bundle.
