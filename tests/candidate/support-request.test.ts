import { describe, expect, it } from "vitest";
import { buildSupportMessage } from "@/lib/candidate/support";

const uid = "11111111-1111-1111-1111-111111111111";

describe("buildSupportMessage", () => {
  const base = { userId: uid, category: "application_status", body: "  Where is my application?  " };

  it("files the message in the candidate's own ops thread, not a client conversation", () => {
    const m = buildSupportMessage(base);
    expect(m.thread_id).toBe(uid);
    expect(m.sender_user_id).toBe(uid);
    expect(m.conversation_id).toBeNull();
  });

  it("addresses ops and tags the request so it lands in the ops queue", () => {
    const m = buildSupportMessage(base);
    expect(m.recipient_context.audience).toBe("taasflow_ops");
    expect(m.recipient_context.from).toBe("candidate");
    expect(m.recipient_context.kind).toBe("support_request");
    expect(m.recipient_context.category).toBe("application_status");
  });

  it("keeps the category in the body and trims the candidate text", () => {
    const m = buildSupportMessage(base);
    expect(m.body.startsWith("Support request — ")).toBe(true);
    expect(m.body.endsWith("Where is my application?")).toBe(true);
    expect(m.body).not.toContain("  Where");
  });

  it("carries a reference when given and normalises a blank one to null", () => {
    expect(buildSupportMessage({ ...base, reference: " ABC123 " }).body).toContain("(ref ABC123)");
    expect(buildSupportMessage({ ...base, reference: " ABC123 " }).recipient_context.reference).toBe("ABC123");
    const blank = buildSupportMessage({ ...base, reference: "   " });
    expect(blank.recipient_context.reference).toBeNull();
    expect(blank.body).not.toContain("ref");
  });
});
