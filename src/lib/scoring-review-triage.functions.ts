// Thin server-function wrappers for scoring review triage (blocking flag + claims).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { REVIEW_QUEUES, REVIEW_SORTS, type ReviewQueueId } from "./scoring-review.functions";
import type { TriageQueue } from "./scoring-review-triage.server";

const SORT_MAP: Record<(typeof REVIEW_SORTS)[number], { col: string; asc: boolean }> = {
  oldest_first: { col: "updated_at", asc: true },
  newest_first: { col: "updated_at", asc: false },
  score_desc: { col: "final_score", asc: false },
  score_asc: { col: "final_score", asc: true },
  confidence_asc: { col: "evidence_confidence", asc: true },
};

export const listReviewTriage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        queue: z.string().optional(),
        q: z.string().max(200).optional(),
        sort: z.enum(REVIEW_SORTS).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<TriageQueue> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadReviewTriage } = await import("./scoring-review-triage.server");
    const queue = data.queue as ReviewQueueId | undefined;
    const column = queue && REVIEW_QUEUES[queue] ? REVIEW_QUEUES[queue].column : undefined;
    return loadReviewTriage(supabaseAdmin as never, {
      queueColumn: column,
      q: data.q,
      sort: SORT_MAP[data.sort ?? "oldest_first"],
      limit: data.limit ?? 25,
      offset: data.offset ?? 0,
      viewerUserId: context.userId,
    });
  });

export const claimScoringReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { claimReview } = await import("./scoring-review-triage.server");
    return claimReview(supabaseAdmin as never, {
      matchId: data.match_id,
      reviewerUserId: context.userId,
    });
  });

export const releaseScoringReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { releaseReview } = await import("./scoring-review-triage.server");
    return releaseReview(supabaseAdmin as never, { matchId: data.match_id });
  });

export const releaseStaleScoringClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { releaseStaleClaims } = await import("./scoring-review-triage.server");
    return releaseStaleClaims(supabaseAdmin as never);
  });

export const bulkRecomputeQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ queue: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { executeScoring } = await import("./scoring-service.server");

    // Get all matches in this specific queue
    const column =
      data.queue && REVIEW_QUEUES[data.queue as ReviewQueueId]
        ? REVIEW_QUEUES[data.queue as ReviewQueueId].column
        : null;
    if (!column) throw new Error("Invalid queue");

    const { data: rows } = await supabaseAdmin
      .from("v_scoring_review_queue")
      .select("match_id")
      .eq(column, true);

    if (!rows || rows.length === 0) return { recomputed: 0 };

    // Limit to 50 items per bulk action for safety
    const items = rows.slice(0, 50);
    const results = await Promise.allSettled(
      items.map((r) =>
        executeScoring(r.match_id, {
          force: true,
          reason: `Bulk recompute from ${data.queue} queue`,
          actor_user_id: context.userId,
        }),
      ),
    );

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    return { recomputed: successful, total: items.length };
  });
