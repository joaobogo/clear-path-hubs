import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
  checkAttachment,
  checkAttachments,
  checkMessageBody,
} from "../message-attachments";

describe("checkAttachment", () => {
  it("accepts a PDF within the size cap", () => {
    const res = checkAttachment({ name: "offer.pdf", size: 1024, type: "application/pdf" });
    expect(res.ok).toBe(true);
  });

  it("rejects an unsupported type by name", () => {
    const res = checkAttachment({ name: "team.png", size: 1024, type: "image/png" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("team.png");
  });

  it("rejects a file over the cap and states the actual size", () => {
    const res = checkAttachment({
      name: "big.pdf",
      size: MAX_ATTACHMENT_BYTES + 1,
      type: "application/pdf",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("10.0 MB");
  });

  it("rejects an empty file", () => {
    expect(checkAttachment({ name: "empty.pdf", size: 0 }).ok).toBe(false);
  });

  it("rejects a mismatch between extension and declared type", () => {
    const res = checkAttachment({ name: "notes.pdf", size: 100, type: "image/png" });
    expect(res.ok).toBe(false);
  });

  it("tolerates a generic octet-stream type", () => {
    expect(
      checkAttachment({ name: "notes.docx", size: 100, type: "application/octet-stream" }).ok,
    ).toBe(true);
  });
});

describe("checkAttachments", () => {
  it("caps the number of files per message", () => {
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) => ({
      name: `doc${i}.pdf`,
      size: 10,
      type: "application/pdf",
    }));
    const res = checkAttachments(files);
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toContain(`up to ${MAX_ATTACHMENTS_PER_MESSAGE}`);
  });
});

describe("checkMessageBody", () => {
  it("rejects an empty message", () => {
    expect(checkMessageBody("   ").ok).toBe(false);
  });

  it("asks for a line of context when only files are attached", () => {
    const res = checkMessageBody("", true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("what you are sending");
  });

  it("rejects a message over 4000 characters", () => {
    expect(checkMessageBody("x".repeat(4001)).ok).toBe(false);
  });

  it("returns the trimmed body", () => {
    const res = checkMessageBody("  hello  ");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.body).toBe("hello");
  });
});

describe("attachmentPath", () => {
  it("scopes the object path to the org and conversation", () => {
    const path = attachmentPath("org-1", "conv-1", "my file (v2).pdf");
    expect(path.startsWith("org-1/conv-1/")).toBe(true);
    expect(path).toMatch(/my_file__v2_\.pdf$/);
  });
});
