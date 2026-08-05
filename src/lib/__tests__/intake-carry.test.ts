import { describe, expect, it } from "vitest";
import { buildCarryForward, CARRYABLE_FIELDS, ROLE_SPECIFIC_FIELDS } from "../intake-carry";

const source = {
  organization: { name: "Northwind Health", website: "northwindhealth.com", phone: "+1 555 0100" },
  position: {
    location: "Boston, MA",
    work_model: "hybrid",
    work_authorization: { rule: "us_authorized", note: "No sponsorship this year" },
    compensation: { currency: "USD", period: "year", bonus: "10% target", equity: "none", flexible: true, min: 120000, max: 150000 },
    intake_context: {
      onsite_days: 3,
      sponsorship_available: "no",
      interview_stages: [{ name: "Intro call", ownerName: "Dana Fox", owner_email: "Dana@Northwind.com", format: "video_call" }],
      interview_process: "Two rounds then panel",
      target_days_to_offer: 21,
      decision_maker: "Dana Fox",
      decision_maker_email: "dana@northwind.com",
    },
  },
  contact: { fullName: "Sam Ortiz Ruiz", email: "Sam@Northwind.com", phone: "+1 555 0101" },
};

describe("buildCarryForward", () => {
  it("carries the company, contact, location defaults, philosophy and process", () => {
    const carry = buildCarryForward(source);
    expect(carry.companyName).toBe("Northwind Health");
    expect(carry.values.companyWebsite).toBe("northwindhealth.com");
    expect(carry.values.firstName).toBe("Sam");
    expect(carry.values.lastName).toBe("Ortiz Ruiz");
    expect(carry.values.workEmail).toBe("sam@northwind.com");
    expect(carry.values.location).toBe("Boston, MA");
    expect(carry.values.workModel).toBe("hybrid");
    expect(carry.values.onsiteDays).toBe("3");
    expect(carry.values.sponsorshipAvailable).toBe("no");
    expect(carry.values.currency).toBe("USD");
    expect(carry.values.compensationFlexible).toBe(true);
    expect(carry.values.targetDaysToOffer).toBe("21");
    expect(carry.values.interviewStages).toEqual([
      { name: "Intro call", ownerName: "Dana Fox", ownerEmail: "dana@northwind.com", format: "video_call" },
    ]);
    expect(carry.carried).toContain("location");
  });

  it("never carries the previous role's own answers", () => {
    const carry = buildCarryForward(source);
    for (const field of ROLE_SPECIFIC_FIELDS) {
      expect(Object.keys(carry.values)).not.toContain(field);
    }
    // Salary numbers in particular must not follow a role to the next one.
    expect(JSON.stringify(carry.values)).not.toContain("150000");
  });

  it("omits contact details when no authenticated contact is supplied", () => {
    const carry = buildCarryForward({ ...source, contact: null });
    expect(carry.values.workEmail).toBeUndefined();
    expect(carry.values.firstName).toBeUndefined();
    expect(carry.values.companyName).toBe("Northwind Health");
  });

  it("reports only fields it actually filled and skips empty values", () => {
    const carry = buildCarryForward({
      organization: { name: "Solo Co", website: "", phone: null },
      position: null,
      contact: null,
    });
    expect(carry.carried).toEqual(["companyName"]);
    expect(carry.values.companyWebsite).toBeUndefined();
  });

  it("returns nothing carried for a missing source", () => {
    expect(buildCarryForward(null)).toEqual({ companyName: null, values: {}, carried: [] });
  });

  it("keeps carryable and role-specific field sets disjoint", () => {
    for (const f of ROLE_SPECIFIC_FIELDS) {
      expect(CARRYABLE_FIELDS as readonly string[]).not.toContain(f);
    }
  });
});
