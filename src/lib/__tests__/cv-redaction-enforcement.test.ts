import { describe, it, expect, vi } from "vitest";
import { redactCv } from "../cv-redactor.server";

vi.mock("../cv-extractor.server", () => ({
  extractCvText: vi.fn(),
}));

describe("CV Redaction Enforcement", () => {
  it("redacts PII from CV text", async () => {
    const rawText = "Miguel Torres\nEmail: miguel.torres@demo.com\nPhone: +351 912 000 102\nExperience: Senior Engineer at Flow Group.";
    const { extractCvText } = await import("../cv-extractor.server");
    vi.mocked(extractCvText).mockResolvedValue({ text: rawText });

    const bytes = new TextEncoder().encode(rawText);
    const result = await redactCv(bytes, "application/pdf", "cv.pdf");
    
    expect(result).not.toContain("miguel.torres@demo.com");
    expect(result).not.toContain("+351 912 000 102");
    expect(result).toContain("Senior Engineer");
    expect(result).toContain("Miguel Torres");
  });
});
