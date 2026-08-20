import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Audience } from "@/lib/events";

/**
 * Single domain-level refresh coordinator.
 *
 * Mount ONCE per dashboard layout (admin / client / candidate). It opens exactly
 * one Realtime channel and, whenever a notification arrives for this user, it
 * invalidates the whole dashboard query surface at once so counts, lists and
 * KPIs move together.
 *
 * Fallbacks — every one is bounded so we never silently show stale data:
 *   • tab returns to view (visibility / focus after being hidden) → refresh
 *   • approved interval → refresh every 60 s while the tab is visible
 *
 * Individual cards MUST NOT call supabase.channel() themselves. Add domain
 * tables to `supabase_realtime` publication so the shared channel picks them up
 * (see the Phase 10 migration for `messages` and `notification_events`).
 */
const FALLBACK_INTERVAL_MS = 60_000;

export function useDashboardRealtime(opts: {
  userId: string | null | undefined;
  audience: Audience;
  invalidateKeys: readonly (readonly unknown[])[];
}) {
  const qc = useQueryClient();
  const { userId, audience, invalidateKeys } = opts;
  const lastInvalidate = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const invalidateAll = () => {
      lastInvalidate.current = Date.now();
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
    };

    // Coalesce a burst of realtime events into one invalidation per 500 ms.
    let burst: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (burst) return;
      burst = setTimeout(() => {
        burst = null;
        invalidateAll();
      }, 500);
    };

    const channel = supabase
      .channel(`dashboard:${audience}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => scheduleInvalidate(),
      )
      .subscribe();

    // The first click inside the app also focuses the window, and `focus` fires
    // on mousedown — invalidating the whole dashboard there swapped subtrees
    // between mousedown and mouseup, so the first click on any control was
    // dropped. Only refresh when the tab genuinely comes back into view, and
    // never in the middle of a click.
    let wasHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
    const refreshAfterReturn = () => {
      if (!wasHidden) return;
      wasHidden = false;
      // Let the in-flight pointer interaction finish before any subtree swap.
      window.setTimeout(invalidateAll, 0);
    };
    const onFocus = () => refreshAfterReturn();
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        wasHidden = true;
        return;
      }
      refreshAfterReturn();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);


    // Approved interval fallback — only fires while the tab is visible AND
    // no other refresh happened in the last minute, so it stays cheap.
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInvalidate.current < FALLBACK_INTERVAL_MS) return;
      invalidateAll();
    }, FALLBACK_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (burst) clearTimeout(burst);
      window.clearInterval(interval);
    };
    // invalidateKeys is expected to be stable per dashboard (defined at module scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, audience]);
}
