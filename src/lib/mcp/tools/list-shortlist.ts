import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

/**
 * Shortlist for a role. Only rows released to the client
 * (client_visibility = 'visible') are ever returned.
 */
export default defineTool({
  name: "list_shortlist",
  title: "List shortlisted candidates",
  description:
    "List the candidates released to the client for one role, with stage and fit label. Only candidates already shared with the client are returned.",
  inputSchema: {
    positionId: z.string().uuid().describe("The role (position) id."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum candidates to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ positionId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at,
         candidate_profiles(id, full_name, headline, location, availability, years_experience),
         score_runs:approved_score_run_id (fit_label)`,
      )
      .eq("position_id", positionId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const shortlist = rows.map((r) => {
      const profile = (r.candidate_profiles ?? {}) as Record<string, unknown>;
      const run = (r.score_runs ?? {}) as Record<string, unknown>;
      return {
        matchId: r.id,
        name: profile.full_name ?? "Candidate",
        headline: profile.headline ?? null,
        location: profile.location ?? null,
        availability: profile.availability ?? null,
        yearsExperience: profile.years_experience ?? null,
        stage: r.stage ?? null,
        fitLabel: run.fit_label ?? null,
        deliveredAt: r.delivered_at ?? null,
      };
    });
    return {
      content: [
        {
          type: "text",
          text: shortlist.length
            ? shortlist
                .map(
                  (c) =>
                    `• ${c.name}${c.headline ? ` — ${c.headline}` : ""} · stage: ${c.stage ?? "n/a"}${c.fitLabel ? ` · fit: ${c.fitLabel}` : ""} (match id: ${c.matchId})`,
                )
                .join("\n")
            : "No candidates have been shared with you for this role yet.",
        },
      ],
      structuredContent: { shortlist },
    };
  },
});
