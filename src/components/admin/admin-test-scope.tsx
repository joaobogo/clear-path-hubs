import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTestScopeState } from "@/lib/test-scope.functions";

export type AdminTestScope = {
  /** True when test and internal organisations are part of every read. */
  includeTest: boolean;
  excludedOrgs: number;
  excludedPositions: number;
};

const HIDDEN: AdminTestScope = {
  includeTest: false,
  excludedOrgs: 0,
  excludedPositions: 0,
};

const TestScopeContext = createContext<AdminTestScope>(HIDDEN);

/**
 * Fetches the admin test-record scope asynchronously and provides it to the
 * admin subtree. The initial value is the safe default (test records hidden),
 * so the layout can render instantly while the preference resolves.
 */
export function AdminTestScopeProvider({ children }: { children: ReactNode }) {
  const fetchScope = useServerFn(getTestScopeState);
  const { data } = useQuery({
    queryKey: ["admin-test-scope"],
    queryFn: () => fetchScope(),
    staleTime: 60_000,
    retry: 1,
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Avoid switching from false to true on the very first render when the
    // query already has cached data from SSR; wait until after hydration.
    setHydrated(true);
  }, []);

  const value = useMemo<AdminTestScope>(() => {
    if (!data) return HIDDEN;
    return {
      includeTest: data.show_test_records === true,
      excludedOrgs: data.excluded_orgs ?? 0,
      excludedPositions: data.excluded_positions ?? 0,
    };
  }, [data]);

  // During the first client render, if the query has no data yet, keep the
  // default hidden so the screen never briefly shows test records.
  const resolved = hydrated && data ? value : HIDDEN;

  return (
    <TestScopeContext.Provider value={resolved}>{children}</TestScopeContext.Provider>
  );
}

export function useAdminTestScope(): AdminTestScope {
  return useContext(TestScopeContext);
}

export function useIncludeTestRecords(): boolean {
  return useAdminTestScope().includeTest;
}

export function useScopedIncludeTest(explicit?: boolean): boolean {
  return explicit ?? useAdminTestScope().includeTest;
}
