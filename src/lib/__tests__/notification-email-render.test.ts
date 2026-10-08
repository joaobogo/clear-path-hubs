import { describe, expect, it } from "vitest";
import { renderEmail, emailActionLabel } from "@/lib/notification-email.server";

const base = {
  title: "New message from Flow Group Ventures",
  body: "You have a new message in your workspace.",
  actionLabel: "Read the message",
  actionUrl: "https://taasflow.com/client/conversations/abc",
};

describe("renderEmail", () => {
  it("carries the brand navy header and ocean button", () => {
    const html = renderEmail(base);
    // Mirrors palette in src/lib/email-templates/brand.tsx.
    expect(html).toContain("#1e2a4a");
    expect(html).toContain("#2563eb");
    expect(html).toContain("TaaSFlow");
  });

  it("links the action to the given url", () => {
    const html = renderEmail(base);
    expect(html).toContain(`href="${base.actionUrl}"`);
    expect(html).toContain("Read the message");
  });

  it("escapes text so a subject cannot inject markup", () => {
    const html = renderEmail({
      ...base,
      title: '<script>alert("x")</script>',
      body: "a & b < c",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &lt; c");
  });

  it("omits the context paragraph when there is none", () => {
    expect(renderEmail(base)).not.toContain("undefined");
    expect(renderEmail({ ...base, context: null })).not.toContain("null");
  });

  it("uses the default footer unless one is given", () => {
    expect(renderEmail(base)).toContain("Reply to this email");
    expect(renderEmail({ ...base, footerNote: "Turn these off in settings." })).toContain(
      "Turn these off in settings.",
    );
  });
});

describe("emailActionLabel", () => {
  it("names what is waiting rather than the product", () => {
    expect(emailActionLabel("message_sent")).toBe("Read the message");
    expect(emailActionLabel("approval_needed")).toBe("Review and decide");
    expect(emailActionLabel("shortlist_ready")).toBe("See the shortlist");
  });

  it("falls back for events with no specific wording", () => {
    expect(emailActionLabel("member_invited")).toBe("Open in TaaSFlow");
  });
});
