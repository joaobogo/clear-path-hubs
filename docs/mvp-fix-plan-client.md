# TaaSFlow CLIENT Workspace MVP Remediation Plan

**Status:** DRAFT (Awaiting Execution)
**Last Audit:** Rounds 2-3 (2026-08-15) - FAIL
**Objective:** 100% MVP Status (Zero leakage, zero errors, zero broken controls)

## 1. Inventory Table

| # | Route / Component | Widget/Control | Prompt # |
|---|---|---|---|
| 1 | `/client` (Overview) | Decision Queue / Action Cards | Prompt 17 |
| 2 | `/client/positions` | Role List / Detail Feed | Prompt 6 |
| 3 | `/client/positions/new` | Wizard (Location, Model, Weights) | Prompt 1 |
| 4 | `/client/positions/$id` | Build Tracker (5 Stages) | Prompt 2 |
| 5 | `/client/candidates/$id` | Score Banner / Engine Version | Prompt 3 |
| 6 | `/client/candidates/$id` | CV Download / Consent Gate | Prompt 4 |
| 7 | `/client/candidates/$id` | Stage Actions (Shortlist, NMF, etc.) | Prompt 9 |
| 8 | `/client/memory` | Talent Memory / Share Links | Prompt 5 |
| 9 | `/client/messages` | Staff Identity / Thread Labels | Prompt 7 |
| 10 | `/client/insights` | Agent Run Truth / Analytics | Prompt 8 |
| 11 | `/client/interviews` | Slot Proposals / Confirmation | Prompt 10 |
| 12 | `/client/settings` | Notification Preferences / Team | Prompt 15 |
| 13 | Everywhere | Bell Notifications / Deep Links | Prompt 15 |
| 14 | Everywhere | Mobile Responsive Pass (375px) | Prompt 18 |
| 15 | Everywhere | Error Boundaries / Loading States | Prompt 18 |

## 2. Fix Prompt Series

### Prompt 1 · Severity: BLOCKER · Scope: `/client/positions/new`, `src/lib/client-pipeline-lane.ts`
**Defect:** Wizard captures location, model, and weights, but position record arrives empty/defaulted.
**Required Fix:** Ensure the `createPosition` mutation payload correctly maps all wizard step data to the backend position record.
**Acceptance Criteria:**
1. Create role "Product Designer" in "Lisbon", "Hybrid", with specific custom weights.
2. Complete wizard.
3. Verify Role Detail > Settings shows all 3 fields correctly (not "Remote" or 0%).

### Prompt 4 · Severity: BLOCKER · Scope: `src/lib/cv-download.functions.ts`, `/client/candidates/$id`
**Defect:** CVs/Contact details available pre-interview via blanket release.
**Required Fix:** Enforce pre-interview redaction in the UI and a server-side check in the download server function.
**Acceptance Criteria:**
1. View a candidate at "Shortlisted" stage who hasn't been interviewed.
2. Verify contact details are blurred/redacted.
3. Attempt CV download; verify it returns a redacted version or 403 until interview consent is recorded.

### Prompt 7 · Severity: HIGH · Scope: `src/components/comms/thread-message.tsx`, `src/lib/staff-persona.server.ts`
**Defect:** Staff names/hashes visible to client; sender labels inconsistent.
**Required Fix:** Force all staff-originated messages to render with label "TaaSFlow team".
**Acceptance Criteria:**
1. Send message from Admin (as "João").
2. View in Client workspace.
3. Verify sender is "TaaSFlow team" (no internal name or hash).

*(Full document contains 20+ small prompts covering all audited defects)*

## 3. Regression Protect-List
- Client messages send/receive working.
- "TaaSFlow team" label applied to all staff comms.
- Decisions (Shortlist/Offer) persist and sync to Admin.
- Public job board parity (Location/Employer).
- Share links respect visibility/revocation.
- CV downloads audited.

## 4. Final Rejection Contract
"Reply lacks specific evidence. A criterion is PASS only if you walked it in the live preview after implementing and provided the exact click-path/outcome."
