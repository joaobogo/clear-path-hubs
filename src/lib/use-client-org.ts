import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";

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
 * Workspace org for screens that are reachable without `?org=` in the URL.
 *
 * The search param stays authoritative (deep links, admin "view as client"),
 * but when it is absent we fall back to the active membership from the client
 * context instead of rendering a "no workspace selected" prompt at a URL the
 * sidebar itself links to.
 */
export function useResolvedClientOrgId(): string | undefined {
  const fromSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const ctx = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
    enabled: !fromSearch,
    staleTime: 60_000,
  });
  return fromSearch ?? ctx.data?.active?.organization_id ?? undefined;
}
