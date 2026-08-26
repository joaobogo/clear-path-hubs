import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps a signed-in workspace session alive while someone is working.
 *
 * The access token is short-lived (about an hour, and the demo client hit the
 * wall in roughly half that after a tab sat idle). Automatic refresh only runs
 * while the tab is awake, so a session could lapse quietly and the next plain
 * navigation landed on an empty sign-in form. We refresh ahead of expiry, and
 * again whenever the tab comes back to the foreground or the network returns.
 */

const CHECK_INTERVAL_MS = 3 * 60 * 1000;
// Refresh once the token is inside its last ten minutes.
const REFRESH_MARGIN_S = 10 * 60;

export async function ensureFreshSession(): Promise<"fresh" | "refreshed" | "expired" | "offline"> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return "offline";
  const session = data.session;
  if (!session) return "expired";

  const expiresAt = session.expires_at ?? 0;
  const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
  if (secondsLeft > REFRESH_MARGIN_S) return "fresh";

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) {
    // A network failure must not be mistaken for a signed-out user.
    return typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "expired";
  }
  return "refreshed";
}

export function useSessionKeepAlive() {
  useEffect(() => {
    let warned = false;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const result = await ensureFreshSession();
      if (cancelled) return;
      if (result === "expired" && !warned) {
        warned = true;
        toast.warning("Your session is about to end. Save your work — you may be asked to sign in again.");
      }
      if (result === "refreshed" || result === "fresh") warned = false;
    };

    void tick();
    const timer = window.setInterval(tick, CHECK_INTERVAL_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, []);
}
