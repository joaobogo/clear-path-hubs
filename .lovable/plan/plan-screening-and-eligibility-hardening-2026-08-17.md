# Plan: Screening and Eligibility Hardening

Fix the defect where screening questions do not record eligibility for dealbreakers, store raw JSON in admin records, and lack clear consent display.

## User Review Required

> [!IMPORTANT]
> - Disqualified applicants (via dealbreakers) will be redirected to an "Eligibility Outcome" page instead of the standard "Application Received" page to ensure an honest applicant-facing outcome.
> - Admin users will see human-readable labels instead of raw JSON in the candidate dossier and review screens.

## Proposed Changes

### Database & Logic
#### [Humanization Utility]
- Create `src/lib/humanizers/screening.ts` to map raw screening values (boolean, numbers, arrays) to human-readable strings.

#### [Eligibility Integration]
- Update `src/lib/apply.functions.ts` to:
    - Detect dealbreaker answers during submission.
    - If a dealbreaker is hit, create an `eligibility_checks` record with status `not_eligible` and the question text as the reason.
    - Set `candidate_matches.eligibility_status` to `not_eligible` immediately.
    - Return a specific outcome status so the frontend can redirect to an eligibility-specific success page.

### Public Application (`src/routes/jobs.$id.apply.tsx`)
- Ensure all `pos.questions` are rendered and enforced as required in `stepIssues(3)`.
- Update `onSubmit` to handle the new eligibility outcome status and redirect to a new `/apply/eligibility-outcome` route if disqualified.

### Admin Surfaces
#### [Candidate Detail & Review]
- Update `src/lib/admin-candidates.functions.ts` to humanize `application_answers` before returning them in the dossier.
- Update `src/routes/_authenticated/admin.review.$matchId.tsx` to use the humanizer for screening answers in the review sidebar.
- Update `src/components/admin/candidate-detail/profile-tab.tsx` and `src/components/candidate/admin-dossier.tsx` to display consent status clearly.

### New Routes
- Create `src/routes/apply.eligibility-outcome.tsx` for the honest applicant-facing message when disqualified by a dealbreaker.

## Verification Plan

### Automated Tests
- Create `tests/screening-eligibility.spec.ts` (Playwright) to:
    1. Submit an application with a passing dealbreaker -> verify "Received" page.
    2. Submit an application with a failing dealbreaker -> verify "Eligibility Outcome" page.
    3. Check admin record -> verify human-readable answers (no raw JSON).
    4. Verify `eligibility_checks` table entry for the failed dealbreaker.

### Manual Verification
- Apply to a role with a boolean dealbreaker ("Do you have a visa?").
- Answer "No" (dealbreaker).
- Verify the applicant sees the honest outcome page.
- Verify the admin dossier shows "Work Authorization: No (Dealbreaker)" and "Consent: Given".
