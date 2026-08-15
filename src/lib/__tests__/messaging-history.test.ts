import { describe, it, expect } from "vitest";
import { getConversation } from "../conversations.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

describe("Messaging History Integrity", () => {
  it("should render all persisted client messages in their threads including old ones", async () => {
    // Setup: Seed an old client message and a staff reply
    const orgId = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed"; // Northwind Demo
    const clientId = "1fa5f7ca-da0c-4b88-ae73-a87ef20d35be"; // Demo Client Admin
    const staffId = "e60fd0fc-3f4d-4911-b469-c672ca0ca369"; // A staff user
    
    // Create a new unique conversation for this test
    const { data: convo } = await supabaseAdmin
      .from("conversations")
      .insert({
        organization_id: orgId,
        scope: "organization",
        subject: "History Integrity Test " + Date.now(),
        created_by: staffId,
      })
      .select("id")
      .single();

    expect(convo).toBeDefined();
    const convoId = convo!.id;

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 5);
    const oldDateStr = oldDate.toISOString();

    const recentDate = new Date();
    recentDate.setMinutes(recentDate.getMinutes() - 10);
    const recentDateStr = recentDate.toISOString();

    // 1. Old client message
    await supabaseAdmin.from("messages").insert({
      conversation_id: convoId,
      thread_id: orgId,
      sender_user_id: clientId,
      body: "OLD CLIENT MESSAGE",
      created_at: oldDateStr
    });

    // 2. Staff reply
    await supabaseAdmin.from("messages").insert({
      conversation_id: convoId,
      thread_id: orgId,
      sender_user_id: staffId,
      body: "STAFF REPLY",
      created_at: new Date(oldDate.getTime() + 1000).toISOString()
    });

    // 3. Recent client message
    await supabaseAdmin.from("messages").insert({
      conversation_id: convoId,
      thread_id: orgId,
      sender_user_id: clientId,
      body: "RECENT CLIENT MESSAGE",
      created_at: recentDateStr
    });

    // Test: Retrieve conversation as the client
    // Note: createServerFn handlers are usually called via a request context, 
    // but we can test the logic by mocking the context if needed.
    // However, the function itself is exported and we can call it.
    
    // We'll mock the server function context
    const result = await getConversation({
      data: { conversationId: convoId },
      context: { 
        supabase: supabaseAdmin, // Use admin to bypass RLS in test if needed, or proper client
        userId: clientId 
      }
    });

    expect(result.messages.length).toBe(3);
    expect(result.messages[0].body).toBe("OLD CLIENT MESSAGE");
    expect(result.messages[0].sender_side).toBe("client");
    expect(result.messages[1].body).toBe("STAFF REPLY");
    expect(result.messages[1].sender_side).toBe("taasflow");
    expect(result.messages[2].body).toBe("RECENT CLIENT MESSAGE");
    expect(result.messages[2].sender_side).toBe("client");

    // Cleanup
    await supabaseAdmin.from("messages").delete().eq("conversation_id", convoId);
    await supabaseAdmin.from("conversations").delete().eq("id", convoId);
  });
});
