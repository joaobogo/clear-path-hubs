import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { ensureFreshSession, useSessionKeepAlive } from "@/lib/auth/session-keepalive";

/**
 * Protected-route gate.
 *
 * The session lives in the browser, so this check runs client-side inside
 * `beforeLoad` — it resolves before any child component or loader renders,
 * so protected UI never mounts for an unauthenticated visitor.
 *
 * This gate is navigation control, not the security boundary. Every read and
 * write behind it is enforced server-side by row-level security and by the
 * `requireSupabaseAuth` middleware on server functions, so a forged client
 * state yields no data. The subtree is also marked noindex so protected
 * screens never enter a search index.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async ({ location }) => {
    // getUser() verifies the token against the auth server rather than
    // trusting whatever is in local storage.
    let { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // An access token that simply aged out is recoverable: refresh it before
      // bouncing anyone, so a working session never drops on a plain navigation.
      const state = await ensureFreshSession();
      if (state === "refreshed" || state === "fresh") {
        ({ data, error } = await supabase.auth.getUser());
      }
    }
    if (error || !data.user) {
      // Carry both the destination and the reason, so sign-in explains what
      // happened and returns the user to where they were.
      throw redirect({ to: "/login", search: { redirect: location.href, reason: "expired" } });
    }
    return { user: data.user };
  },
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/route.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useSessionKeepAlive();
  return <Outlet />;
}
