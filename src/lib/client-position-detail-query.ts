import { queryOptions } from "@tanstack/react-query";
import { getClientPositionDetail } from "@/lib/client-positions.functions";

/**
 * One payload for the whole role. The server returns the role, its pipeline,
 * timeline, lifecycle, closure, recap and open information requests together,
 * so the page has a single loading state and a single retry.
 *
 * Lives outside the route file because the route's loader and component land in
 * different chunks after route splitting; a module-scope const declared in the
 * route file is not shared between them.
 */
export const positionDetailQuery = (orgId: string, positionId: string) =>
  queryOptions({
    queryKey: ["client-position", orgId, positionId],
    queryFn: () => getClientPositionDetail({ data: { orgId, positionId } }),
  });
