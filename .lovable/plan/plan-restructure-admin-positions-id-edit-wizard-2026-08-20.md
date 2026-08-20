# Plan: Restructure /admin/positions/<id>/edit wizard

## Goal
Reduce the position edit wizard from seven steps to three, move job-post copy to the publish flow, and surface the readiness checklist as a persistent side rail. The refactor must also eliminate the duplicate-location model that currently creates contradictory statements in one panel.

## What we keep untouched
- The server save shape (`savePositionEdit`) and the underlying `position`/`requisition_meta` schema — no migration needed.
- The `JobQualityPanel` component design, its severity groups, and the "Fix in step N" links.
- The score-invalidation notice in `RequisitionEditor`.
- The unsaved-changes guard (`useBlocker`, `beforeunload`, and draft restore).

## New wizard structure

| New step | Label | Contains today |
|---|---|---|
| 1 | Requisition | Step 1 (role definition) + step 3 (compensation as a fieldset) |
| 2 | Candidate profile and gates | Step 2 (candidate profile) + step 4 (search criteria / gates) |
| 3 | Locations | Step 5 (locations table, ownership, logistics, evaluation weights) |

## Step-by-step work

### 1. Remove the old step 1 location questions
In `PositionEditWizard.tsx`, drop the "Geographic Requirements" section from step 1 (the `open_worldwide`, `target_countries`, `states_regions`, `metro_areas`, `search_radius` fields). Keep the fields in state for backward compatibility, but stop collecting them at step 1. The single source of truth for location becomes step 3 (`RequisitionEditor`).

### 2. Merge step 3 (Compensation) into step 1 as a fieldset
Move the currency/period/min/max/notes markup from `step === 3` into `step === 1` inside a new "Compensation" section. Keep validation and state bindings identical. Delete the old `step === 3` branch.

### 3. Merge step 4 (Search Criteria) into step 2
Move target titles, title match timing, company types, include/exclude keywords, and deal-breakers from `step === 4` into `step === 2`. Keep the screening-questions UI in step 2 as well (it already lives there). Delete the old `step === 4` branch.

### 4. Rename step 5 to step 3
`RequisitionEditor` becomes the third and final step. It continues to own the locations table, evaluation weights, ownership, logistics, and the score-invalidation notice.

### 5. Move step 6 (Job Post) to the publish flow
- Remove the `JobPostStep` branch from the wizard.
- Add a new route `/admin/positions/$id/publish` that renders `JobPostStep` as a standalone publish page. Pass the same state fields from the server load (`company_intro`, `benefits`, `languages`, `travel`, `work_authorization_note`, `accessibility_note`, `eeo_statement`, `brand_tone`, `application_deadline`, `confidentiality`).
- The wizard "Save changes" button still saves the main role body. The publish page gets its own save action that writes only the job-post fields and transitions visibility to `public` or `confidential`.
- Update the `PositionWorkspace` "Publish" flow to link to `/admin/positions/$id/publish` instead of opening the wizard at step 6.

### 6. Promote the step 7 checklist into a persistent side rail
- Change the wizard layout from `max-w-3xl` to a two-column grid (step content + sticky side rail).
- Render `JobQualityPanel` with the current draft on every step, passing the new step numbers in `draft`.
- Remove the old `step === 7` review content branch.
- The "Save changes" button remains on the last step, but the checklist is visible on all steps.

### 7. Update step-number mapping in the quality assessment
In `src/lib/requisition-schema.ts`, remap the `step` field in `assessJobQuality` gaps:
- Title, seniority, employment type, headcount, department, target start date → step 1
- Must-haves, experience, responsibilities/description, nice-to-haves → step 2
- Locations, timezone, owner, travel → step 3
- Remove any step 4 / step 5 / step 6 / step 7 references.

### 8. Update routing and validation
- In `src/routes/_authenticated/admin.positions.$id_.edit.tsx`, allow `step` values 1–3 only.
- Validate that `step` from the URL is clamped to 1–3.
- Redirect `step=4`, `5`, `6`, `7` query params to the new valid step or to the publish route for step 6.

### 9. Tests and verification
- Run the unit suite for `requisition-schema` (assessJobQuality step mapping).
- Run a Playwright check on the wizard: back/forward navigation, draft restore, unsaved-changes guard, and the side-rail checklist jumping to each step.
- Verify the publish page renders the job-post preview and saves independently.

## Files touched
- `src/components/positions/PositionEditWizard.tsx` — restructure steps, add side rail, remove job-post/review steps.
- `src/lib/requisition-schema.ts` — update `step` numbers in `assessJobQuality`.
- `src/routes/_authenticated/admin.positions.$id_.edit.tsx` — restrict step to 1–3.
- `src/routes/_authenticated/admin.positions.$id.publish.tsx` — new publish route.
- `src/routes/_authenticated/admin.positions.$id.tsx` — link publish CTA to the new publish route.
- Possibly `src/lib/position-edit.functions.ts` if we need to split the save payload between wizard and publish.

## Open questions (non-blocking)
- Should the publish route also host the final "go live" action, or should that remain in `LifecycleBar`? Proposal: keep the publish action in `LifecycleBar`, but make the publish route the place to edit the public-facing copy before pressing it.
- Should the wizard save job-post fields too while the user is still editing the role? Proposal: no — job-post fields are only meaningful when publishing, so they live on the publish route. If the user saves the wizard mid-flow, job-post fields remain untouched.
