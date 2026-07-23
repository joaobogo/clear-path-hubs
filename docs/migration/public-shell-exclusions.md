# Public Shell — Migration Exclusions

The following source components / behaviours are intentionally NOT imported
into the destination. Any future request to "port the source header/footer
verbatim" must respect these exclusions.

## Excluded modules

| Source concern | Why excluded |
|---|---|
| Supabase client instantiation in header/footer | Destination uses `@/integrations/supabase/client` — a single canonical client. |
| Auth session hooks referenced in shell | Public shell must not read auth state. Sign-in link is static; workspace shells own the authenticated experience. |
| Dashboard sidebar imports | Public shell does not include dashboard UI. `workspace-shell.tsx` owns the operational sidebar. |
| Old route guards (`RequireAuth`, `RequireRole`) | Destination uses `_authenticated` layout route + server-side `requireSupabaseAuth`. |
| Realtime subscriptions in shell components | Public shell must not open realtime channels. |
| Notification popovers in shell | Notifications live inside the workspace shell only. |
| Legacy environment vars, service-role references, or copied secrets | Never imported. |

## Excluded destinations

- Header does NOT expose an Admin login link. Admin sign-in reuses `/login`.
- Header does NOT expose every public page. Long-tail routes (talent-marketplace, global-talent, employer-onboarding) live in the footer only.
- Footer does NOT include social links that have no verified account (Twitter/X, GitHub removed).

## Excluded until owner sign-off

The 16 unverified commercial claims from the Phase 3 audit remain excluded from
CTA microcopy. `Book a consultation` currently routes to `/contact` until a
dedicated booking flow is approved.
