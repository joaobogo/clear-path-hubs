import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_position",
  title: "Get role detail",
  description:
    "Get the detail of one hiring role the signed-in user can access: status, requirements, compensation and location.",
  inputSchema: { positionId: z.string().uuid().describe("The role (position) id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ positionId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("positions")
      .select(
        `id, title, status, location, work_model, employment_type, seniority, department, openings,
         description, requirements, preferred_requirements, dealbreakers, compensation,
         work_authorization, created_at, updated_at, published_at`,
      )
      .eq("id", positionId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "No role found with that id in your workspaces." }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { position: data },
    };
  },
});
