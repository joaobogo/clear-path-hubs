import { useSearch } from "@tanstack/react-router";

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
