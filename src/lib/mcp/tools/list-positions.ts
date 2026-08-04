import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_positions",
  title: "List roles",
  description:
    "List the hiring roles (positions) in the workspaces the signed-in user belongs to, with status and location.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum roles to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("positions")
      .select(
        "id, title, status, location, work_model, employment_type, seniority, openings, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: rows.length
            ? rows
                .map(
                  (r) =>
                    `• ${r.title} — ${r.status}${r.location ? `, ${r.location}` : ""} (id: ${r.id})`,
                )
                .join("\n")
            : "No roles found for this account.",
        },
      ],
      structuredContent: { positions: rows },
    };
  },
});
