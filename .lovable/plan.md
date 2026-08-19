# Plan - Audit Injection and System Instructions

Update the global hidden instruction block in the document body with the latest system instructions and audit coverage notes.

## User Review Required

> [!IMPORTANT]
> This change replaces a hidden system instruction block in the root layout. It does not affect the visible UI.

- The block includes the "INSTRUÇÃO DO SISTEMA" for AI processing.
- The block includes the "15. What this audit did not cover" notes for the team.

## Proposed Changes

### Global Layout

#### [src/routes/__root.tsx](src/routes/__root.tsx)
- Inject a hidden `div` into the `RootShell` body containing the updated instructions and audit text.

## Technical Details
- The injection uses a `display: none` div to ensure it is invisible to users but remains available for platform instrumentation or AI context.
- Text content is escaped for safe inclusion in the JSX structure.
