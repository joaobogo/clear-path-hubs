# Plan: Fix Public Job Board Data Consistency and Formatting

Fix contradictory role facts and formatting issues on the public job detail and apply pages.

## User Review Required

> [!IMPORTANT]
> The plan unifies data sources to ensure that "HIRING LOCATIONS" and "WORK ARRANGEMENT" always match the primary requisition record.

- **Data Consistency**: The "Apply" panel will now derive location and headcount directly from the primary `locations` array, ensuring it matches the "Job Facts" box.
- **Work Arrangement**: "Hybrid" displays will now include specific on-site days (e.g., "Hybrid — 3 days a week on-site") when specified in the requisition.
- **Typo & Casing**: Fixes "unites states" to "United States" (or proper country name) and ensures location strings like "marion, north carolina" are title-cased.

## Proposed Changes

### Logic & Data
#### [src/lib/jobs/public-facts.ts](src/lib/jobs/public-facts.ts)
- Update `resolveWorkAuthorisation` to use proper casing for country names.
- Update `resolveWorkArrangement` to handle `onsiteDays` more robustly.

#### [src/lib/jobs/arrangement-statement.ts](src/lib/jobs/arrangement-statement.ts)
- Ensure consistency with `public-facts.ts` logic for hybrid roles.

### Components & UI
#### [src/routes/jobs.$id.index.tsx](src/routes/jobs.$id.index.tsx)
- Update the sidebar "Apply to this role" section to use the same `pos.locations` data consistently.
- Implement title-casing for location strings.
- Add a consistency assertion check during data resolution.

#### [src/routes/jobs.$id.apply.tsx](src/routes/jobs.$id.apply.tsx)
- Ensure the "Before you start" and "Hiring locations" sections match the detail page.

## Verification Plan

### Automated Tests
- Run `bunx vitest src/lib/__tests__/jobs-integrity.test.ts` (or create it) to verify that published roles have consistent locations and headcount across all public fields.
- Verify work authorization string construction with various country inputs.

### Manual Verification
- View a hybrid role with "3 days onsite" in the JD and confirm the "Work arrangement" fact displays "Hybrid — 3 days a week on-site".
- Check that "United States" is correctly cased in the work authorization section.
- Confirm "Marion, North Carolina" is title-cased in the sidebar locations.
