/**
 * The one place any admin screen asks "am I including test records right now?".
 *
 * The answer lives on the admin layout's route context (resolved once per
 * navigation from the staff user's saved preference), not in a URL param and
 * not in per-screen component state. Every desk therefore renders the same
 * scope the server applied, which is what makes the overview counts and the
 * desk they link to agree.
 */
import { getRouteApi } from "@tanstack/react-router";

const adminRoute = getRouteApi("/_authenticated/admin");

export type AdminTestScope = {
  /** True when test and internal organisations are part of every read. */
  includeTest: boolean;
  excludedOrgs: number;
  excludedPositions: number;
};

export function useAdminTestScope(): AdminTestScope {
  return adminRoute.useRouteContext().testScope;
}

/** Convenience for the common `includeTest={...}` prop threading. */
export function useIncludeTestRecords(): boolean {
  return useAdminTestScope().includeTest;
}
