/**
 * Route-scoped realtime freshness.
 *
 * The workspace layout already keeps counts and lists broadly in sync. The
 * deep decision surfaces need something narrower: when a role or a candidate
 * match changes somewhere else — a teammate advances someone, our team moves
 * a candidate on — this hook invalidates that route's own query keys and
 * exposes a "just updated" marker so rows never swap silently under the
 * cursor.
 *
 * One channel per mounted route. Events are coalesced into a single
 * invalidation per burst.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BURST_MS = 600;

export function useRouteRealtime(opts: {
	/** Stable name for the channel, e.g. "client-offers". */
	scope: string;
	orgId: string | null | undefined;
	/** Query keys to invalidate on a remote change. */
	invalidateKeys: readonly (readonly unknown[])[];
	/** Optional single position to narrow match events to. */
	positionId?: string | null;
	enabled?: boolean;
}) {
	const qc = useQueryClient();
	const { scope, orgId, invalidateKeys, positionId, enabled = true } = opts;
	const [updatedAt, setUpdatedAt] = useState<number | null>(null);
	const keysRef = useRef(invalidateKeys);
	keysRef.current = invalidateKeys;

	const acknowledge = useCallback(() => setUpdatedAt(null), []);

	useEffect(() => {
		if (!enabled || !orgId) return;

		let burst: ReturnType<typeof setTimeout> | null = null;
		const onRemoteChange = () => {
			if (burst) return;
			burst = setTimeout(() => {
				burst = null;
				for (const key of keysRef.current) {
					qc.invalidateQueries({ queryKey: key as unknown[] });
				}
				setUpdatedAt(Date.now());
			}, BURST_MS);
		};

		const matchFilter = positionId
			? `position_id=eq.${positionId}`
			: `organization_id=eq.${orgId}`;

		const channel = supabase
			.channel(`route:${scope}:${positionId ?? orgId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "candidate_matches",
					filter: matchFilter,
				},
				onRemoteChange,
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "positions",
					filter: positionId ? `id=eq.${positionId}` : `organization_id=eq.${orgId}`,
				},
				onRemoteChange,
			)
			.subscribe();

		return () => {
			if (burst) clearTimeout(burst);
			supabase.removeChannel(channel);
		};
	}, [enabled, orgId, positionId, scope, qc]);

	return { updatedAt, acknowledge };
}
