/**
 * One refresh for every surface that reads talent memory.
 *
 * Keeping a candidate for the future writes one record and four surfaces show
 * it: the talent pool tab, the resurface panel on a role, the memory sheet, and
 * the indicator on the candidate's own profile. Each mutation site invalidated
 * whichever keys its author happened to remember — the tag dialog refreshed all
 * four, while the resurface panel and the memory sheet refreshed only
 * `["talent-memory"]`. So consent, reason and archive changes made from those
 * two surfaces never reached the talent pool, and the tabs disagreed until a
 * hard reload.
 *
 * The keys in one place means the next mutation site cannot forget one, which
 * is how this drifted in the first place.
 *
 * `["talent-memory"]` is a prefix: the resurface list
 * (`["talent-memory", "resurface", …]`) and the sheet
 * (`["talent-memory", "detail", …]`) both match it, as does
 * `["talent-pool", orgId, status]` for the pool key below. TanStack matches
 * query keys by prefix, so listing the roots covers every scoped variant.
 */
import type { QueryClient } from "@tanstack/react-query";

/**
 * Refresh every talent-memory reader.
 *
 * Active queries refetch immediately; anything not currently mounted is marked
 * stale and refetches the moment its tab is opened, which is the fastest
 * correct behaviour without fetching screens nobody is looking at.
 *
 * @param matchId when the write came from a candidate profile, so that
 *                candidate's own memory indicator refreshes too.
 */
export function invalidateTalentMemory(qc: QueryClient, matchId?: string | null): void {
  qc.invalidateQueries({ queryKey: ["talent-memory"] });
  qc.invalidateQueries({ queryKey: ["talent-memory-archived-count"] });
  qc.invalidateQueries({ queryKey: ["talent-pool"] });
  if (matchId) qc.invalidateQueries({ queryKey: ["memory-by-match", matchId] });
}
