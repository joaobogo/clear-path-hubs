import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

/**
 * One candidate's dossier as released to the client. Never returns raw CV text —
 * only the structured profile and the approved screening evidence.
 */
export default defineTool({
  name: "get_candidate",
  title: "Get candidate dossier",
  description:
    "Get the screening summary for one shortlisted candidate: profile, stage, fit label and the evidence behind it. Only candidates already shared with the client are returned.",
  inputSchema: { matchId: z.string().uuid().describe("The candidate match id from list_shortlist.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ matchId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, client_visibility,
         candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, skills, languages, work_authorization, certifications),
         positions(id, title),
         score_runs:approved_score_run_id (fit_label, explanation, requirement_coverage, evidence)`,
      )
      .eq("id", matchId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || (data as Record<string, unknown>).client_visibility !== "visible") {
      return {
        content: [
          { type: "text", text: "That candidate isn't available in your workspace." },
        ],
        isError: true,
      };
    }
    const row = data as Record<string, unknown>;
    const profile = (row.candidate_profiles ?? {}) as Record<string, unknown>;
    const position = (row.positions ?? {}) as Record<string, unknown>;
    const run = (row.score_runs ?? {}) as Record<string, unknown>;
    const dossier = {
      matchId: row.id,
      role: position.title ?? null,
      stage: row.stage ?? null,
      deliveredAt: row.delivered_at ?? null,
      name: profile.full_name ?? "Candidate",
      headline: profile.headline ?? null,
      location: profile.location ?? null,
      timezone: profile.timezone ?? null,
      availability: profile.availability ?? null,
      yearsExperience: profile.years_experience ?? null,
      summary: profile.summary ?? null,
      skills: profile.skills ?? null,
      languages: profile.languages ?? null,
      workAuthorization: profile.work_authorization ?? null,
      certifications: profile.certifications ?? null,
      fitLabel: run.fit_label ?? null,
      screeningSummary: run.explanation ?? null,
      requirementCoverage: run.requirement_coverage ?? null,
      evidence: run.evidence ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(dossier, null, 2) }],
      structuredContent: { candidate: dossier },
    };
  },
});
