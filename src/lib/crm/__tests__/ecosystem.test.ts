import { describe, expect, it } from "vitest";
import {
  FORM_SERVICE_INTEREST,
  SERVICE_ROUTING,
  deriveCrossSellStatus,
  deriveLeadType,
} from "../attio-config";
import { sanitizeParams } from "@/lib/tracking/fgv-events";

describe("FGV service routing", () => {
  it("keeps subscription demand on TaaSFlow", () => {
    expect(SERVICE_ROUTING.recruiting_subscription).toEqual({
      destination_brand: "taasflow",
      referral: false,
    });
  });

  it("refers single critical roles and brand demand to siblings", () => {
    expect(SERVICE_ROUTING.one_critical_role.destination_brand).toBe("flowplaced");
    expect(SERVICE_ROUTING.employer_brand_or_demand.destination_brand).toBe("omniflow");
    expect(SERVICE_ROUTING.international_expansion.destination_brand).toBe("fgv");
  });

  it("marks referrals as cross-sell and native demand as none", () => {
    expect(deriveCrossSellStatus("recruiting_subscription")).toBe("None");
    expect(deriveCrossSellStatus("one_critical_role")).not.toBe("None");
  });

  it("maps every known form to a service interest", () => {
    for (const interest of Object.values(FORM_SERVICE_INTEREST)) {
      expect(SERVICE_ROUTING[interest]).toBeDefined();
    }
  });

  it("derives a lead type for each form", () => {
    for (const [formId, interest] of Object.entries(FORM_SERVICE_INTEREST)) {
      expect(
        deriveLeadType(formId as keyof typeof FORM_SERVICE_INTEREST, interest),
      ).toBeTruthy();
    }
  });
});

describe("event parameter sanitization", () => {
  it("drops personal values and unknown keys", () => {
    const out = sanitizeParams({
      form_type: "sales_contact",
      email: "someone@example.com",
      page_path: "/contact",
      service_interest: "person@example.com",
      full_name: "Jane Doe",
    });
    expect(out).toEqual({ form_type: "sales_contact", page_path: "/contact" });
  });

  it("keeps numbers and booleans on allowed keys", () => {
    expect(sanitizeParams({ submission_id: "abc123", error_code: "network_error" })).toEqual({
      submission_id: "abc123",
      error_code: "network_error",
    });
  });
});
