import { describe, it, expect, vi } from "vitest";
import { redactCv } from "../cv-redactor.server";

describe("CV Redaction Enforcement", () => {
  it("redacts PII from CV text", async () => {
    const rawText = "Miguel Torres\nEmail: miguel.torres@demo.com\nPhone: +351 912 000 102\nExperience: Senior Engineer at Flow Group.";
    
    // Test the redactor directly
    const bytes = new TextEncoder().encode(rawText);
    
    // Mock extractCvText since we just want to test the redaction logic itself
    vi.mock("../cv-extractor.server", () => ({
      extractCvText: vi.fn().mockResolvedValue({ text: rawText })
    }));

    const result = await redactCv(bytes, "application/pdf", "cv.pdf");
    
    expect(result).not.toContain("miguel.torres@demo.com");
    expect(result).not.toContain("+351 912 000 102");
    expect(result).toContain("Senior Engineer");
    expect(result).toContain("Miguel Torres");
  });
});
