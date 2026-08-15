import { describe, it, expect } from "vitest";
import { listMessageHistory } from "../conversations.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

describe("Message History Log", () => {
  it("should list individual messages across threads in chronological order", async () => {
    const orgId = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed"; // Northwind Demo
    const clientId = "1fa5f7ca-da0c-4b88-ae73-a87ef20d35be"; // Demo Client Admin
    const staffId = "e60fd0fc-3f4d-4911-b469-c672ca0ca369"; // A staff user

    // Get an existing conversation to avoid unique constraint issues with org scope if any
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .single();
    
    const convoId = existing!.id;

    const now = new Date();
    const t1 = new Date(now.getTime() - 10000).toISOString();
    const t2 = new Date(now.getTime() - 5000).toISOString();
    const t3 = new Date(now.getTime() - 1000).toISOString();

    await supabaseAdmin.from("messages").insert([
      {
        conversation_id: convoId,
        thread_id: orgId,
        sender_user_id: clientId,
        body: "MESSAGE 1 (HISTORY TEST)",
        created_at: t1,
      },
      {
        conversation_id: convoId,
        thread_id: orgId,
        sender_user_id: staffId,
        body: "MESSAGE 2 (HISTORY TEST)",
        created_at: t2,
      },
      {
        conversation_id: convoId,
        thread_id: orgId,
        sender_user_id: clientId,
        body: "MESSAGE 3 (HISTORY TEST)",
        created_at: t3,
      },
    ]);

    // Test: Retrieve history as the client
    const result = await (listMessageHistory as any).handler({
      data: { orgId, page: 1, pageSize: 50 },
      context: {
        supabase: supabaseAdmin,
        userId: clientId,
      },
    });

    const testMessages = result.items.filter((m: any) =>
      m.body.includes("(HISTORY TEST)"),
    );

    expect(testMessages.length).toBe(3);

    // Assert chronological order (newest first)
    expect(testMessages[0].body).toBe("MESSAGE 3 (HISTORY TEST)");
    expect(testMessages[1].body).toBe("MESSAGE 2 (HISTORY TEST)");
    expect(testMessages[2].body).toBe("MESSAGE 1 (HISTORY TEST)");

    // Cleanup
    await supabaseAdmin.from("messages").delete().eq("conversation_id", convoId).ilike("body", "%(HISTORY TEST)%");
  });
});
