# TaaSFlow CANDIDATE Application Flow MVP Remediation Plan

**Status:** DRAFT (Awaiting Execution)
**Objective:** 100% MVP Status (Zero silent failures, zero data loss, truthful feedback)

## 1. Inventory Table

| # | Component / Flow | Widget/Control | Prompt # |
|---|---|---|---|
| 1 | `/jobs` (Job Board) | List / Filters / Empty States | Prompt 4 |
| 2 | `/jobs/$id` (Job Detail) | Content Parity (Employer, Location, etc.) | Prompt 4 |
| 3 | Application Form | Field Validation / Screening Questions | Prompt 5 |
| 4 | Application Form | Dealbreaker Logic (Auto-disqualify) | Prompt 5 |
| 5 | Application Form | CV Upload (Parsing/Retry/Progress) | Prompt 1 |
| 6 | Application Form | Unreadable PDF Handling | Prompt 2 |
| 7 | Submission Pipeline | dedupe / application creation / sync | Prompt 3 |
| 8 | Submission Pipeline | Confirmation / Notification / Suppression | Prompt 7 |
| 9 | `/me` (Status Page) | Status Lookup / Auth | Prompt 8 |
| 10 | Everywhere | Mobile Responsive (375px) / A11y | Prompt 9 |

## 2. Fix Prompt Series

### Prompt 1 · Severity: BLOCKER · Scope: `src/lib/candidates/application-form.tsx`, `src/lib/cv-upload.functions.ts`
**Defect:** Silent upload failure (Candidate uploaded CV 4 times, no application created, no error shown).
**Required Fix:** Implement a robust state machine for the application submission. If the application record creation fails, show a specific, actionable error. Log a platform-side incident.
**Acceptance Criteria:**
1. Submit application.
2. Mock a database failure during record creation.
3. Verify candidate sees "Something went wrong — we've logged this and are looking into it. Please try again or contact support." (No silent silence).

### Prompt 2 · Severity: HIGH · Scope: `src/lib/intelligence/cv-parser.server.ts`
**Defect:** Unreadable/No-text-layer PDFs stuck at 3-attempt ceiling.
**Required Fix:** Detect unreadable PDFs (0 characters extracted) early. Show truthful feedback to candidate immediately: "We couldn't read your file — please upload a text-based PDF or DOCX."
**Acceptance Criteria:**
1. Upload a "scanned" image-only PDF.
2. Verify immediate UI feedback (don't wait for 3 backend retries).
3. Verify staff sees "Unreadable PDF" status in candidate list.

### Prompt 5 · Severity: HIGH · Scope: `src/components/jobs/screening-form.tsx`
**Defect:** Screening questions don't enforce dealbreakers or record eligibility correctly (F-008 parity).
**Required Fix:** map screening answers to `eligibility_checks` table. If a dealbreaker answer is provided, set `eligibility_status` to 'ineligible' and show an honest outcome.
**Acceptance Criteria:**
1. Answer "No" to a mandatory "Do you have 5+ years experience?" dealbreaker.
2. Submit.
3. Verify `eligibility_checks` record is created with `status='ineligible'`.

*(Full document contains all 10+ prompts for the application flow)*

## 3. Regression Protect-List
- Job board parity (Real employer names, locations).
- Existing published roles remain visible.
- Application audit trail intact.
- Score runs remain immutable.

## 4. Final Rejection Contract
"Reply lacks specific evidence. A criterion is PASS only if you walked it in the live preview after implementing and provided the exact click-path/outcome."
