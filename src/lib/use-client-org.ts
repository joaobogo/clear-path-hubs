import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client.functions";

/**
 * Reads `?org=<uuid>` from the current URL (validated on the parent
 * `/_authenticated/client` route). Used by every sub-route so that:
 *   - refresh preserves the selected client
 *   - deep links to /client/positions/$id?org=... open the correct tenant
 *   - admin "View Client Dashboard" opens the exact org, not the caller's
 *     own first membership.
 */
export function useClientOrgSearch(): string | undefined {
  const s = useSearch({ strict: false }) as { org?: string };
  return s?.org;
}

/**
 * Same as `useClientOrgSearch`, but falls back to the active organization from
 * the client context when the URL carries no `?org=`. Pages should prefer this:
 * navigating to /client/analytics from the sidebar (no search params) must not
 * dead-end on "Select an organization."
 */
export function useResolvedClientOrgId(): string | undefined {
  const search = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const { data } = useQuery({
    queryKey: ["client-context", search ?? null],
    queryFn: () => ctxFn({ data: search ? { orgId: search } : {} }),
    staleTime: 60_000,
  });
  return search ?? data?.active?.organization_id;
}
