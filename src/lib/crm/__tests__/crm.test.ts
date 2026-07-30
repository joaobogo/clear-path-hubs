import { describe, expect, it } from "vitest";
import { sanitizeAnswers, sanitizeText } from "@/lib/crm/attio-sync.server";
import { CRM_FORMS, DEAL_FORM_TYPES } from "@/lib/crm/attio-config";

describe("crm sanitization", () => {
  it("strips html and collapses whitespace", () => {
    expect(sanitizeText("<script>alert(1)</script> hello   world")).toBe("alert(1) hello world");
  });

  it("drops sensitive keys from answers", () => {
    const out = sanitizeAnswers({
      password: "hunter2",
      api_key: "abc",
      Message: "<b>hi</b>",
      empty: "",
    });
    expect(out).toEqual({ Message: "hi" });
  });

  it("clamps very long values", () => {
    expect(sanitizeText("a".repeat(5000), 100)).toHaveLength(100);
  });
});

describe("crm form registry", () => {
  it("uses stable, human-readable ids", () => {
    for (const [key, form] of Object.entries(CRM_FORMS)) {
      expect(form.id).toBe(key);
      expect(form.id).toMatch(/^[a-z][a-z0-9-]+$/);
    }
  });

  it("never opens deals for newsletter or partnership forms", () => {
    expect(DEAL_FORM_TYPES).not.toContain("newsletter");
    expect(DEAL_FORM_TYPES).not.toContain("partnership");
  });
});

import { normalizeDomain, resolveCompanyDomain } from "@/lib/crm/attio-sync.server";

describe("company domain resolution", () => {
  it("normalizes urls and strips www/protocol/path", () => {
    expect(normalizeDomain("https://www.Acme.com/careers?x=1")).toBe("acme.com");
  });

  it("rejects company names, not domains", () => {
    expect(normalizeDomain("Acme Incorporated")).toBeNull();
    expect(normalizeDomain("Acme")).toBeNull();
  });

  it("never treats a consumer mailbox as a company", () => {
    expect(normalizeDomain("gmail.com")).toBeNull();
    expect(resolveCompanyDomain(null, "someone@gmail.com")).toBeNull();
  });

  it("falls back to the work email domain", () => {
    expect(resolveCompanyDomain(null, "jane@acme.co.uk")).toBe("acme.co.uk");
    expect(resolveCompanyDomain("https://acme.io", "jane@gmail.com")).toBe("acme.io");
  });
});
