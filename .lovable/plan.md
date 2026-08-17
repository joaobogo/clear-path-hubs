# MVP Fix Plan: P-002, P-010, P-037

Hardening the admin interface against data-driven crashes and ensuring cross-tenant data hygiene in AI briefings.

## User Review Required

> [!IMPORTANT]
> I cannot directly update the production database records for the Northwind Talent organization or existing candidate insights because the `lovable supabase query` tool is currently restricted to read-only mode in this environment. I will implement the code-level safeguards to prevent future issues, and provide the SQL for you to run.

## Proposed Changes

### 1. Data Hygiene & AI Briefing Security (P-010, P-037)
- **Problem**: AI briefings hallucinate "Flow Group Ventures" (the platform name) instead of using the actual hiring client's name. Existing Northwind records have incorrect website/contact data.
- **Fix**:
    - Update `InsightsInput` to include a mandatory `hiring_organization_name` field.
    - Harden the AI system prompt to explicitly use the hiring organization's name and strictly forbid mentioning other clients.
    - Update the pipeline runner to fetch and pass the actual organization name to the insight generator.

### 2. Admin Dashboard Stability (P-002)
- **Problem**: Inconsistent data states (e.g., deleted staff members holding work queue items) can cause the admin dashboard to crash or show broken UI.
- **Fix**:
    - Harden `ageTone` in `src/lib/admin-ops.server.ts` to handle invalid date strings gracefully.
    - Improve owner resolution to ensure unresolvable owner IDs (stale pointers) read as "unassigned" rather than crashing or showing "Unknown staff".

### 3. Position Persistence (P-001)
- **Problem**: Certain position fields were losing data during the intake-to-role conversion.
- **Fix**: (Already partially addressed, but will verify and finalize)
    - Ensure `requirements`, `preferred_requirements`, and `dealbreakers` are explicitly preserved or defaulted to empty arrays to prevent `null` overwrites.

## Technical Details

### Code Changes
- `src/lib/candidate-insights.server.ts`:
    - Update `InsightsInput` interface.
    - Add `hiring_organization_name` to the system prompt logic.
    - Inject the name into the LLM context.
- `src/lib/pipeline-runner.server.ts`:
    - Update `buildInsights` to accept and pass the organization name.
    - Modify `loadCtx` or the calling logic to fetch the organization name from the database.
- `src/lib/admin-ops.server.ts`:
    - Add `isNaN` checks to `ageTone`.
    - Harden `owner` resolution logic.

### Database Corrective SQL (To be run manually)
```sql
-- Correct the Northwind organization record
UPDATE public.organizations 
SET 
  website = 'northwindtalent.com', 
  primary_contact_email = 'client.james@northwind.com' 
WHERE id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed';

-- Scrub "Flow Group Ventures" from existing Northwind briefings
UPDATE public.candidate_evidence 
SET extracted = jsonb_set(
  jsonb_set(
    extracted, 
    '{insights,narrative}', 
    to_jsonb(replace(extracted->'insights'->>'narrative', 'Flow Group Ventures', 'Northwind Talent'))
  ),
  '{insights,pitch_summary}',
  to_jsonb(replace(extracted->'insights'->>'pitch_summary', 'Flow Group Ventures', 'Northwind Talent'))
)
WHERE candidate_match_id IN (
  SELECT id FROM public.candidate_matches WHERE organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
) AND extracted->'insights' IS NOT NULL;
```
