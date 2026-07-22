import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Audience } from "@/lib/events";

/**
 * Single domain-level refresh coordinator.
 *
 * Mount ONCE per dashboard layout (admin / client / candidate). It opens exactly
 * one Realtime channel and, whenever a notification arrives for this user, it
 * invalidates the whole dashboard query surface at once so counts, lists and
 * KPIs move together. It also refreshes on window focus as a fallback in case
 * the socket was asleep.
 *
 * Individual cards MUST NOT call supabase.channel() themselves.
 */
export function useDashboardRealtime(opts: {
  userId: string | null | undefined;
  audience: Audience;
  invalidateKeys: readonly (readonly unknown[])[];
}) {
  const qc = useQueryClient();
  const { userId, audience, invalidateKeys } = opts;

  useEffect(() => {
    if (!userId) return;

    const invalidateAll = () => {
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
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
        () => invalidateAll(),
      )
      .subscribe();

    const onFocus = () => invalidateAll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") invalidateAll();
    });

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
    // invalidateKeys is expected to be stable per dashboard (defined at module scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, audience]);
}
