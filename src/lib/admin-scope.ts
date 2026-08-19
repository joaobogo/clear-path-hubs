/**
 * The one place any admin screen asks "am I including test records right now?".
 *
 * The answer lives on the admin layout's route context (resolved once per
 * navigation from the staff user's saved preference), not in a URL param and
 * not in per-screen component state. Every desk therefore renders the same
 * scope the server applied, which is what makes the overview counts and the
 * desk they link to agree.
 *
 * Reading it off the matched routes rather than a fixed route API means a shared
 * panel rendered outside the admin layout degrades to "test records hidden"
 * instead of throwing.
 */
import { useEffect, useState } from "react";
import { useMatches } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_ROUTE_ID = "/_authenticated/admin";

export type AdminTestScope = {
  /** True when test and internal organisations are part of every read. */
  includeTest: boolean;
  excludedOrgs: number;
  excludedPositions: number;
};

const HIDDEN: AdminTestScope = { includeTest: false, excludedOrgs: 0, excludedPositions: 0 };

export function useAdminTestScope(): AdminTestScope {
  const matches = useMatches();
  const match = matches.find((m) => m.routeId === ADMIN_ROUTE_ID);
  const scope = (match?.context as { testScope?: AdminTestScope } | undefined)?.testScope;
  return scope ?? HIDDEN;
}

/** Convenience for the common `includeTest` read. */
export function useIncludeTestRecords(): boolean {
  return useAdminTestScope().includeTest;
}

/**
 * For shared panels: an explicit prop still wins (account-scoped screens pin
 * their own answer), otherwise the admin-wide scope decides. Nothing defaults
 * to a hardcoded `false`, which is what used to make one panel disagree with
 * the count that linked to it.
 */
export function useScopedIncludeTest(explicit?: boolean): boolean {
  const scope = useAdminTestScope();
  return explicit ?? scope.includeTest;
}

/** The acting admin's user id, for the "Mine" scope. Presentation-only read. */
export function useActingUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return userId;
}
