import { describe, it, expect } from "vitest";
import { getConversation } from "../conversations.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

describe("Messaging History Integrity", () => {
  it("should render all persisted client messages in their threads including old ones", async () => {
    // Setup: Seed an old client message and a staff reply
    const orgId = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed"; // Northwind Demo
    const clientId = "1fa5f7ca-da0c-4b88-ae73-a87ef20d35be"; // Demo Client Admin
    const staffId = "e60fd0fc-3f4d-4911-b469-c672ca0ca369"; // A staff user
    
    // Reuse or create conversation. Organization scope is 1:1 with org.
    let convoId: string;
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("scope", "organization")
      .maybeSingle();

    if (existing) {
      convoId = existing.id;
    } else {
      const { data: convo, error: cErr } = await supabaseAdmin
        .from("conversations")
        .insert({
          organization_id: orgId,
          scope: "organization",
          subject: "History Integrity Test",
          created_by: staffId,
        })
        .select("id")
        .single();
      if (cErr) throw new Error(`Failed to create conversation: ${cErr.message}`);
      convoId = convo.id;
    }

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
    
    // We'll call the internal handler directly to bypass TanStack Start's runtime wrapper in tests
    const { _getConversationHandler } = await import("../conversations.functions");
    const result = await _getConversationHandler({
      data: { conversationId: convoId },
      context: { 
        supabase: supabaseAdmin,
        userId: clientId 
      }
    });

    // Filter for the exact bodies we just inserted to avoid picking up unrelated messages
    const inserted = result.messages.filter(m => ["OLD CLIENT MESSAGE", "STAFF REPLY", "RECENT CLIENT MESSAGE"].includes(m.body));
    
    expect(inserted.length).toBeGreaterThanOrEqual(3);
    
    // Sort by created_at to ensure order for assertion
    inserted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const oldMsg = inserted.find(m => m.body === "OLD CLIENT MESSAGE");
    const staffReply = inserted.find(m => m.body === "STAFF REPLY");
    const recentMsg = inserted.find(m => m.body === "RECENT CLIENT MESSAGE");

    expect(oldMsg).toBeDefined();
    expect(oldMsg?.sender_side).toBe("client");
    
    expect(staffReply).toBeDefined();
    expect(staffReply?.sender_side).toBe("taasflow");
    
    expect(recentMsg).toBeDefined();
    expect(recentMsg?.sender_side).toBe("client");

    // Cleanup messages but keep conversation for demo org stability
    await supabaseAdmin.from("messages").delete().eq("conversation_id", convoId).in("body", ["OLD CLIENT MESSAGE", "STAFF REPLY", "RECENT CLIENT MESSAGE"]);
  });
});
