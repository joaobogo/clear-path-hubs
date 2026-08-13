import { describe, expect, it } from "vitest";
import { CONVERSIONS, resolveConversion } from "../conversion-map";

describe("resolveConversion", () => {
  it("maps a form submit to each provider's vocabulary", () => {
    const r = resolveConversion(CONVERSIONS.formSubmit, {
      form_id: "express_intake",
      form_type: "employer_intake",
      value: 500,
      currency: "GBP",
    });
    expect(r.ga4Event).toBe("generate_lead");
    expect(r.meta?.event).toBe("Lead");
    expect(r.meta?.params).toMatchObject({
      content_name: "express_intake",
      content_category: "employer_intake",
      value: 500,
      currency: "GBP",
    });
    expect(r.label).toBe("form_submit");
  });

  it("maps a dashboard signup to sign_up / CompleteRegistration", () => {
    const r = resolveConversion(CONVERSIONS.dashboardSignup, {
      method: "email_password",
      plan: "express_onboarding",
    });
    expect(r.ga4Event).toBe("sign_up");
    expect(r.meta?.event).toBe("CompleteRegistration");
    expect(r.meta?.params).toMatchObject({
      content_name: "email_password",
      content_category: "express_onboarding",
    });
  });

  it("keeps CTA clicks out of Meta standard events", () => {
    const r = resolveConversion(CONVERSIONS.ctaClick, { cta: "book_a_call" });
    expect(r.ga4Event).toBe("cta_click");
    expect(r.meta).toBeNull();
  });

  it("never sends LinkedIn a non-numeric conversion id", () => {
    for (const name of Object.values(CONVERSIONS)) {
      const li = resolveConversion(name, {}).linkedin;
      if (li) expect(li.conversion_id).toMatch(/^\d+$/);
    }
  });

  it("passes unmapped events through untouched", () => {
    const r = resolveConversion("role_created", { flow: "express_onboarding" });
    expect(r.ga4Event).toBe("role_created");
    expect(r.meta).toBeNull();
    expect(r.linkedin).toBeNull();
  });

  it("preserves the legacy funnel mappings", () => {
    expect(resolveConversion("application_submitted").meta?.event).toBe("SubmitApplication");
    expect(resolveConversion("page_view").meta?.event).toBe("PageView");
  });
});
