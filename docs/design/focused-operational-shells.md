# Focused Operational Shells

`FocusedShell` (`src/components/marketing/form-shell.tsx`, canonically imported
as `@/components/public#FocusedShell`) is the brand chrome used for
high-intent flows where full navigation would harm conversion.

## Routes that use FocusedShell

| Route | Reason |
|---|---|
| `/intake` | 5-step employer intake. |
| `/intake/confirmation` | Success receipt. |
| `/jobs/$id/apply` | Candidate application. |
| `/apply/received/$id` | Application receipt. |
| `/login` | Sign-in form. |
| `/reset-password` | Password reset. |
| `/candidate-join` | Invitation acceptance. |

## Shape

- Sticky header (56px): brand logo (linked to `/`), optional `Step X of Y` progress bar, exit link (default `Exit` → `/`).
- `<main id="form-main">` with skip link `Skip to form`.
- Slim footer: copyright + Privacy / Terms / email.
- No announcement bar, no navigation groups, no primary CTA in the chrome.

## Guarantees preserved

- All existing forms, Zod validators, server functions, and loaders in these routes remain unchanged. Focused shell is chrome only.
- Progress bar is optional; missing progress prop hides the bar entirely.
- Exit link is a genuine escape route — always visible, always accessible with keyboard.
- Help / contact is always one link away (`hello@taasflow.com` in the footer of every focused shell).
