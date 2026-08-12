import { describe, expect, it } from "vitest";
import {
  buildDuplicateDraft,
  isCompensationStale,
  COMPENSATION_STALE_DAYS,
} from "../position-duplicate";

const source = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Account Executive",
  location: "London",
  work_model: "hybrid",
  description: "Sell to mid-market accounts.",
  requirements: [{ label: "Three years closing new business", kind: "must_have" }],
  preferred_requirements: [
    { label: "Sold into hospitality", kind: "nice_to_have" },
    { label: "Our CRM", kind: "trainable" },
  ],
  dealbreakers: ["No commission-only history"],
  compensation: { min: 50000, max: 65000, currency: "GBP", period: "year", flexible: true },
  work_authorization: { rule: "must_have_right_to_work", sponsorship_available: false },
  intake_context: {
    team: "Sales",
    onsite_days: 3,
    deal_breaker_list: ["No agency-only background"],
    interview_stages: [{ name: "Intro call", ownerName: "Ana", ownerEmail: "ANA@x.com" }],
    target_days_to_offer: 21,
  },
  updated_at: new Date().toISOString(),
};

describe("buildDuplicateDraft", () => {
  it("copies the brief: requirements with tags, compensation, location, process, deal-breakers", () => {
    const draft = buildDuplicateDraft(source)!;
    expect(draft.values["roleTitle"]).toBe("Account Executive");
    expect(draft.values["requirements"]).toEqual([
      { text: "Three years closing new business", tag: "must_have" },
      { text: "Sold into hospitality", tag: "nice_to_have" },
      { text: "Our CRM", tag: "trainable" },
    ]);
    expect(draft.values["salaryMin"]).toBe("50000");
    expect(draft.values["currency"]).toBe("GBP");
    expect(draft.values["location"]).toBe("London");
    expect(draft.values["workModel"]).toBe("hybrid");
    expect(draft.values["onsiteDays"]).toBe("3");
    expect(draft.values["sponsorshipAvailable"]).toBe("no");
    expect(draft.values["targetDaysToOffer"]).toBe("21");
    expect(draft.values["dealBreakerList"]).toEqual([
      "No agency-only background",
      "No commission-only history",
    ]);
    expect(draft.values["interviewStages"]).toEqual([
      { name: "Intro call", ownerName: "Ana", ownerEmail: "ana@x.com", format: "" },
    ]);
  });

  it("never carries pipeline data across", () => {
    const draft = buildDuplicateDraft(source)!;
    const keys = Object.keys(draft.values).join(" ");
    expect(keys).not.toMatch(/candidate|decision|note|commitment|interviewFeedback/i);
    expect(draft.notCopied.join(" ")).toMatch(/Candidates/);
  });

  it("flags compensation older than 180 days and not before", () => {
    const fresh = buildDuplicateDraft(source)!;
    expect(fresh.compensationStale).toBe(false);

    const old = new Date();
    old.setDate(old.getDate() - (COMPENSATION_STALE_DAYS + 1));
    const stale = buildDuplicateDraft({ ...source, updated_at: old.toISOString() })!;
    expect(stale.compensationStale).toBe(true);

    const edge = new Date();
    edge.setDate(edge.getDate() - (COMPENSATION_STALE_DAYS - 1));
    expect(isCompensationStale(edge.toISOString())).toBe(false);
  });

  it("returns nothing when there is no source role", () => {
    expect(buildDuplicateDraft(null)).toBeNull();
  });
});
