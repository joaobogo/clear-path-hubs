# Plan: Admin Workspace UX & Logic Refinement

Implement fixes for critical blockers (B1-B6), high-priority health issues (H1-H12), and UX refinements based on the MVP audit.

## User Review Required

> [!IMPORTANT]
> - Approvals page will be merged into the main Work Queue.
> - Candidate search filters will be collapsed by default to save space.
> - PII scrubbing will be enforced on all evidence quotes.

## Proposed Changes

### 1. Client Detail (`/admin/clients/$id`)
- Reconcile KPI tiles: Remove the duplicate row (POSITIONS / ACTIVE POSITIONS / CLIENT USERS) that contradicts the primary commercial/delivery cards.
- Merge **Activity** and **Audit** tabs into a unified view since they share the same data source.
- Fix tab navigation: Ensure clicking a tab correctly switches the view without requiring a URL refresh.

### 2. Candidate Search (`/admin/candidates`)
- Simplify filter UI: Keep only 4 primary filters (Client, Job, Stage, Screening) visible by default.
- Collapse remaining 9 filters behind a "More filters" button.
- Fix search logic: Update `searchCandidateIndex` to use `search_vector` and ensure it returns accurate results for names, emails, and organizations.

### 3. Candidate Detail & Evidence
- Fix Tab Navigation: Bind click handlers to the tab list to ensure the Evidence tab and others open on click.
- Evidence Counts: Reconcile counts in the `EvidenceCompletenessGate` and `ScoreProvenance` components to ensure they match the actual evidence displayed.
- PII & Source Hygiene: 
    - Enforce PII scrubbing (emails, phones, URLs) in `cleanQuote`.
    - Map internal source strings (e.g., "resume") to human labels ("Curriculum Vitae").

### 4. Work Queue & Approvals
- Merge Approvals: Fold the 7 rows from `/admin/approvals` into the main Work Queue at `/admin` as a new "Requisitions awaiting approval" section.
- Fix Approval Actions: Ensure "Approve" buttons in the inbox correctly trigger mutations and show loading states.
- Clean Nav: Remove "Approvals" from the global sidebar.

### 5. Publish Desk (`/admin/publish`)
- Fix Readiness Counts: Update the logic to ensure the "Ready" count accurately reflects candidates who pass all gates.
- Guard Publish: Ensure the Publish button is correctly disabled if blockers exist.

## Technical Details

- **Database**: Update `searchCandidateIndex` server function to use `search_vector` for full-text search.
- **Components**:
    - Update `AccountOperatingSummary` and `OverviewTab` in `admin.clients.$id.tsx`.
    - Update `CandidatesPage` in `admin.candidates.index.tsx` for the filter restructuring.
    - Update `Tabs` component in `candidate-detail/tabs.tsx` to fix the click handler issue.
    - Update `EvidenceCompletenessGate` and `ScoreProvenance` for count reconciliation.
- **Navigation**: Modify `src/routes/_authenticated/route.tsx` and `src/routes/_authenticated/admin.index.tsx`.
- **Logic**: Refine `src/lib/evidence/quote-hygiene.ts` for PII and human labels.
