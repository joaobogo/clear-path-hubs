import { describe, it, expect } from "vitest";
import { listMessageHistory } from "../conversations.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

describe("Message History Log", () => {
  it("should list individual messages across threads in chronological order", async () => {
    const orgId = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed"; // Northwind Demo
    const clientId = "1fa5f7ca-da0c-4b88-ae73-a87ef20d35be"; // Demo Client Admin
    const staffId = "e60fd0fc-3f4d-4911-b469-c672ca0ca369"; // A staff user

    // Create a few test conversations/messages
    const { data: convoA, error: errA } = await supabaseAdmin
      .from("conversations")
      .insert({
        organization_id: orgId,
        scope: "organization",
        subject: "Thread A",
        created_by: staffId,
      })
      .select("id")
      .single();
    if (errA) throw new Error(`Failed to create Thread A: ${errA.message}`);

    const { data: convoB, error: errB } = await supabaseAdmin
      .from("conversations")
      .insert({
        organization_id: orgId,
        scope: "organization",
        subject: "Thread B",
        created_by: staffId,
      })
      .select("id")
      .single();
    if (errB) throw new Error(`Failed to create Thread B: ${errB.message}`);

    const now = new Date();
    const t1 = new Date(now.getTime() - 10000).toISOString();
    const t2 = new Date(now.getTime() - 5000).toISOString();
    const t3 = new Date(now.getTime() - 1000).toISOString();

    await supabaseAdmin.from("messages").insert([
      {
        conversation_id: convoA!.id,
        thread_id: orgId,
        sender_user_id: clientId,
        body: "MESSAGE 1 (Thread A)",
        created_at: t1,
      },
      {
        conversation_id: convoB!.id,
        thread_id: orgId,
        sender_user_id: staffId,
        body: "MESSAGE 2 (Thread B)",
        created_at: t2,
      },
      {
        conversation_id: convoA!.id,
        thread_id: orgId,
        sender_user_id: clientId,
        body: "MESSAGE 3 (Thread A)",
        created_at: t3,
      },
    ]);

    // Test: Retrieve history as the client
    // We use the exported function, but we need to bypass the middleware/wrapper for tests.
    // In TanStack Start, the handler is attached to the function.
    const result = await (listMessageHistory as any).handler({
      data: { orgId, page: 1, pageSize: 50 },
      context: {
        supabase: supabaseAdmin,
        userId: clientId,
      },
    });

    const testMessages = result.items.filter((m: any) =>
      ["MESSAGE 1 (Thread A)", "MESSAGE 2 (Thread B)", "MESSAGE 3 (Thread A)"].includes(m.body),
    );

    expect(testMessages.length).toBe(3);

    // Assert chronological order (newest first)
    expect(testMessages[0].body).toBe("MESSAGE 3 (Thread A)");
    expect(testMessages[1].body).toBe("MESSAGE 2 (Thread B)");
    expect(testMessages[2].body).toBe("MESSAGE 1 (Thread A)");

    // Assert context info
    expect(testMessages[0].subject).toBe("Thread A");
    expect(testMessages[1].subject).toBe("Thread B");

    // Cleanup
    await supabaseAdmin.from("messages").delete().in("conversation_id", [convoA!.id, convoB!.id]);
    await supabaseAdmin.from("conversations").delete().in("id", [convoA!.id, convoB!.id]);
  });
});
