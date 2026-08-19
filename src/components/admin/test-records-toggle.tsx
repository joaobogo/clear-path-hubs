/**
 * The one global "Show test records" control.
 *
 * There are no per-screen toggles: this writes a per-user preference that the
 * shared server-side scope helper applies to every admin list and rollup.
 * Flipping it invalidates the whole admin query cache so every count moves at
 * once. A failed read renders as "Test records hidden" — fail closed.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getTestScopeState, setTestScopeState } from "@/lib/test-scope.functions";
import { useAdminTestScope } from "@/lib/admin-scope";

export const TEST_SCOPE_QUERY_KEY = ["admin", "test-scope"] as const;

export function useTestScopeState() {
  const load = useServerFn(getTestScopeState);
  return useQuery({
    queryKey: TEST_SCOPE_QUERY_KEY,
    queryFn: () => load(),
    staleTime: 60_000,
  });
}

export function TestRecordsToggle() {
  const q = useTestScopeState();
  const contextScope = useAdminTestScope();
  const save = useServerFn(setTestScopeState);
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (show: boolean) => save({ data: { show } }),
    onSuccess: async (state) => {
      queryClient.setQueryData(TEST_SCOPE_QUERY_KEY, state);
      // P-020: Every admin count derives from the same server-side scope.
      // We must reset the cache and re-run all route loaders to ensure the numbers
      // next to the toggle update instantly without a manual F5.
      await queryClient.resetQueries({ predicate: (query) => query.queryKey[0] === "admin" || query.queryKey[0] === "admin-overview" });
      await router.invalidate();
    },
    onError: () => toast.error("Could not change the test-record setting."),
  });

  // Single source of truth: the preference read. Until it resolves, mirror the
// scope the admin layout already applied server-side so the label on one
  // screen can never disagree with the label on another in the same session.
  const show =
    q.data !== undefined ? q.data.show_test_records === true : contextScope.includeTest;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5">
      <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <Label htmlFor="admin-show-test" className="cursor-pointer text-xs text-muted-foreground">
        {show ? "Test records shown" : "Test records hidden"}
      </Label>
      <Switch
        id="admin-show-test"
        checked={show}
        disabled={q.isLoading || mutation.isPending}
        onCheckedChange={(v) => mutation.mutate(v)}
        aria-label="Show test records across all admin screens"
      />
    </div>
  );
}

/**
 * Empty-state footnote: says whether test records are hidden and how many were
 * excluded. Render inside any admin empty state so a filtered-to-nothing list
 * never looks like a genuinely empty pipeline.
 */
export function TestScopeEmptyNote({ className }: { className?: string }) {
  const q = useTestScopeState();
  const s = q.data;
  if (!s || s.show_test_records) return null;
  const total = s.excluded_orgs + s.excluded_positions;
  if (total === 0) return null;
  return (
    <p className={className ?? "mt-1 text-xs text-muted-foreground"}>
      Test records are hidden: {s.excluded_orgs} organisation
      {s.excluded_orgs === 1 ? "" : "s"} and {s.excluded_positions} position
      {s.excluded_positions === 1 ? "" : "s"} excluded.
    </p>
  );
}
