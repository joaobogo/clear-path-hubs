# Support Permission Model

Two roles can access support surfaces. Every rule below is enforced by RLS (`is_platform_staff`), by canonical server functions in `src/lib/support.functions.ts` (to author), and by trigger `tg_support_session_guard` on `support_sessions`.

| Capability                                | platform_admin | operations | client_admin | anyone else |
| ----------------------------------------- | :------------: | :--------: | :----------: | :---------: |
| Read `support_sessions` / `support_actions` / `trace_index` | ✅ | ✅ | ❌ | ❌ |
| Start view-as on **non-staff** user       |       ✅       |     ✅     |      ❌      |     ❌      |
| Start view-as on **platform_admin**       |       ❌       |     ❌     |      ❌      |     ❌      |
| Start view-as on **operations** user      |       ✅       |     ❌     |      ❌      |     ❌      |
| Elevate scope to `elevated` (mutations)   |       ✅       |     ❌     |      ❌      |     ❌      |
| Resend invitation / unlock account        |       ✅       |     ✅     |      ❌      |     ❌      |
| Invalidate sessions                       |       ✅       |     ✅     |      ❌      |     ❌      |
| Correct membership / restore member       |       ✅       |     ✅     | ✅ *(own org only)* | ❌ |
| Deactivate user (platform-wide)           |       ✅       |     ❌     |      ❌      |     ❌      |
| Repair missing org membership             |       ✅       |     ✅     |      ❌      |     ❌      |
| Read `trace_index` for own tenant events  |       ✅       |     ✅     |      ❌      |     ❌      |
| Read own error reference on receipt page  |       —        |     —      |      —       |     ✅ *(own only)* |

**Hard rule.** Operations cannot target platform_admin — enforced twice: application check (`ensureCanImpersonate`) and DB trigger.

**Elevation.** Any mutation performed *inside* an active support session requires `scope = 'elevated'`, a reason string, and explicit re-auth (Supabase step-up MFA if configured, otherwise password confirm). Elevation is a separate `support_actions.action = 'elevate_scope'` audit row.

**No password access.** No support flow reads or resets user passwords. Account recovery uses Supabase Auth Admin `generateLink('recovery')` or `inviteUserByEmail`; the reset link goes to the user's email, never to support.
