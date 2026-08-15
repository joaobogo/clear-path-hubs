# Public Board Data Correction

## Requirement 1: Seed data and template fix
Fixes the "Senior Full-Stack Engineer" JD in Northwind Talent (Demo) which was incorrectly referencing "Flow Group Ventures".

1.  **Migration**: Create a new migration to update the JD for the demo role `ee6d2a82-6122-4026-95e4-45a7821b7b7d`.
2.  **Template Audit**: Check `src/lib/intake-draft-client.ts` or similar for hardcoded FGV strings in default JD templates.

## Requirement 2: Consistent Employer Naming
Synchronize employer naming between the board card and detail page.

- **Action**: Update `src/lib/jobs.functions.ts` to ensure both `listPublicPositions` and `getPublicPosition` use the same fallback strategy. We will use the real client name and a generic fallback "Hiring Organization" (instead of "TaaSFlow client") if it's truly missing, but the user wants a consistent treatment. I will ensure both use the definer-returned name.

## Requirement 3: Posted Date Binding
Bind "Posted" date to `published_at` in both locations.

- **Action**: 
    - Verify `src/routes/jobs.index.tsx` uses `published_at` (it already seems to use `formatPosted(p.published_at)`).
    - Update `src/routes/jobs.$id.index.tsx` to ensure `facts.posted` is correctly displayed and not "Not specified" for published roles.
    - Check `src/lib/jobs/public-facts.ts`'s `resolvePostedDate` to ensure it handles `published_at` correctly.

## Technical Details
- SQL migration for demo data fix.
- Source edits to `src/lib/jobs.functions.ts` and `src/routes/jobs.$id.index.tsx`.
- Review `src/lib/position-lifecycle.server.ts` to ensure `published_at` is always set on activation.
