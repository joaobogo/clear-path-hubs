import { describe, expect, it } from "vitest";
import { leadCrmForm } from "../lead-capture.server";
import type { LeadEventInput } from "@/lib/leads/lead-event";
import { readFileSync } from "node:fs";

const lead = (leadType: LeadEventInput["leadType"], source = "website"): LeadEventInput => ({ leadType, source, sourceId: "f79bf3c8-b9a8-4c7f-b109-e9a60d97dff5" });

describe("server-side Attio form coverage", () => {
  it("routes every sales surface to its approved CRM form", () => {
    expect(leadCrmForm(lead("marketing_inquiry"))).toBe("website-message");
    expect(leadCrmForm(lead("marketing_inquiry", "inquiry_call"))).toBe("book-a-call");
    expect(leadCrmForm(lead("discovery_call"))).toBe("book-a-call");
    expect(leadCrmForm(lead("express_intake"))).toBe("employer-intake");
    expect(leadCrmForm(lead("employer_intake"))).toBe("employer-intake");
    expect(leadCrmForm({ ...lead("contact_message"), facts: [{ label: "Topic", value: "hire_talent" }] })).toBe("contact-page");
  });

  it("keeps candidates and support out of the sales CRM", () => {
    expect(leadCrmForm(lead("candidate_application"))).toBeNull();
    for (const topic of ["candidate", "support"]) {
      expect(leadCrmForm({ ...lead("contact_message"), facts: [{ label: "Topic", value: topic }] })).toBeNull();
    }
  });

  it("does not send duplicate CRM submissions after navigation", () => {
    for (const path of ["src/routes/contact.tsx", "src/routes/intake.tsx"]) {
      expect(readFileSync(path, "utf8")).not.toContain("submitToCrm");
    }
  });

  it("preserves LinkedIn from the role popup and primary contact IDs", () => {
    expect(readFileSync("src/lib/inquiry.functions.ts", "utf8")).toContain("data.details.linkedin");
    expect(readFileSync("src/routes/api/public/contact.ts", "utf8")).toContain("sourceId: contact.id");
    expect(readFileSync("src/routes/api/public/express-intake.ts", "utf8")).toContain("linkedin: data.contactLinkedin");
  });
});