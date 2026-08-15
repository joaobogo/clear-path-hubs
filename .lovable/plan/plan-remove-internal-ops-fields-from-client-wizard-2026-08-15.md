# Plan: Remove internal ops fields from client wizard

Remove internal ownership and ops fields from the client-facing position wizard while retaining them for staff.

## User Review Required
> [!IMPORTANT]
> The "Responsible admin" field will be hidden for clients. If clients need to assign roles to their own team members, this will require a follow-up feature to list client-org members.

## Proposed Changes

### Logic & Schema
#### [src/lib/requisition.functions.ts](src/lib/requisition.functions.ts)
- Modify `getRequisitionMeta` to return an empty `owners` list if the caller is not staff.
- Update `saveRequisitionMeta` to ignore `owner_user_id` updates if the caller is not staff (preserving existing ownership).

#### [src/lib/requisition-schema.ts](src/lib/requisition-schema.ts)
- Remove the "Responsible admin" gap from `assessJobQuality` or make it staff-only.

### UI Components
#### [src/components/positions/RequisitionEditor.tsx](src/components/positions/RequisitionEditor.tsx)
- Add an `audience?: "admin" | "client"` prop.
- Hide the "Responsible admin" select field when `audience === "client"`.

#### [src/components/positions/PositionEditWizard.tsx](src/components/positions/PositionEditWizard.tsx)
- Pass the `audience` prop down to `RequisitionEditor`.

### Security
#### [src/lib/__tests__/requisition-ownership-authz.test.ts](src/lib/__tests__/requisition-ownership-authz.test.ts) (New)
- Add integration test to verify a client cannot set an internal admin as owner.

## Technical Details
- Using the existing `isStaff` boolean in server functions to gate ownership logic.
- UI gating via `audience` prop to maintain component reusability.
