# Plan - MVP Fixes (P-012, P-019, P-020, P-021, P-022, P-036, P-038)

Humanize UX, sanitize internal markers, and harden support/audit workflows.

## User Review Required

> [!IMPORTANT]
> This plan modifies internal sanitization logic. Verify that all internal trace IDs (`pl_...`) and demo markers are consistently stripped from client-facing views.

- **Humanization**: Toast and error copy will now use descriptive labels instead of raw snake_case codes.
- **Support Sessions**: Support context now persists through reloads with a server-side 30-minute TTL enforcement.
- **Sanitization**: All client-facing surfaces will strip `TAASFLOW_DEMO_SEED` and internal trace IDs.

## Proposed Changes

### 1. Humanization & UX Hardening (P-019, P-022)
#### [src/lib/publish-gate.ts]
- Update `PUBLISH_BLOCKER_LABEL` and `humanizePublishBlockedMessage` to use human labels.
- Map "approval_blocked: at least one requirement is required" to "Approval blocked: add at least one must-have requirement".

#### [src/lib/admin-approvals.server.ts]
- Modify `publish_position` handler to use "needs_clarification" instead of "draft" when declining an unpaid role.
- Update decline messages to be admin-appropriate.

#### [src/components/admin/panel-state.tsx]
- Ensure `showLoadingOverlay` actually blocks stale content during pagination/mutations.

### 2. Sanitization & Internal Leakage (P-012, P-036)
#### [src/lib/human-labels.ts]
- Centralize `sanitizeInternalMarkers` to strip `TAASFLOW_DEMO_SEED`, `pl_...` trace IDs, and internal actor hashes.
- Apply this helper to all `format*` functions.

#### [src/lib/admin.functions.ts] & [src/lib/client-shared.server.ts]
- Integrate `sanitizeInternalMarkers` into `writeAudit` so payloads are sanitized before storage/delivery.

#### [src/lib/staff-persona.server.ts]
- Harden actor masking to ensure "Master Admin" and staff names are masked to "TaaSFlow team" or "Staff" correctly based on audience.

### 3. Support & Audit Resilience (P-020, P-021, P-038)
#### [src/lib/support-audit.server.ts]
- Enforce a strict 30-minute TTL for support sessions in `sweepExpiredSupportSessions` and `findActiveSupportSession`.

#### [src/lib/notifications-resolver.server.ts]
- Fix admin notification deep-links to point to `/admin` routes instead of dead-ends.

#### [src/lib/bulk-actions.server.ts]
- Emit a parent audit event for bulk exports to track the operation as a single unit.

### 4. History & Activity (P-005, P-017, P-032)
#### [src/lib/candidate-history.ts]
- Update `actorLabel` to badge actors correctly per context (Client vs Staff).

#### [src/lib/candidate-history.server.ts]
- Implement internal trace ID stripping in `loadCandidateHistory`.

## Verification Plan

### Automated Tests
- Run `bunx vitest src/lib/publish-gate.test.ts` (to be created) to verify humanized error mapping.
- Run `bunx vitest src/lib/human-labels.test.ts` (to be created) to verify marker sanitization.

### Manual Verification
1. **Trigger Block**: Attempt to approve a position with no requirements; verify toast is humanized.
2. **Decline Unpaid**: Decline an unpaid role as admin; verify the state becomes "Needs Clarification" and not "Draft".
3. **Audit Pagination**: Click through audit pages; verify a loading state appears and no stale rows are visible.
4. **Actor Badges**: Check CV download trail; verify "Client" and "Staff" badges appear correctly.
5. **Sanitization**: Check activity feeds for any `pl_` or `TAASFLOW_DEMO_SEED` markers.
