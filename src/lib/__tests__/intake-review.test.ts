import { describe, expect, it } from "vitest";
import { buildIntakeReview, type IntakeReviewSnapshot } from "../intake-review";

const EMPTY: IntakeReviewSnapshot = {
  roleTitle: "",
  team: "",
  whyOpen: "",
  jobDescriptionText: "",
  jdFilename: null,
  requirements: [],
  location: "",
  workModelLabel: "",
  onsiteDays: "",
  remoteAnywhereInCountry: false,
  remoteTimezoneLabels: [],
  sponsorshipLabel: "",
  compensationLine: "",
  workAuthorizationLabel: "",
  workAuthorizationNote: "",
  targetStartDate: "",
  interviewStageLines: [],
  interviewProcess: "",
  targetDaysToOffer: "",
  decisionMaker: "",
  decisionMakerEmail: "",
  dealBreakers: [],
  companyName: "",
  companyWebsite: "",
  companyLinkedin: "",
  firstName: "",
  lastName: "",
  contactTitle: "",
  workEmail: "",
  phone: "",
  contactLinkedin: "",
};

describe("intake review", () => {
  it("renders every answered field, grouped by its step", () => {
    const r = buildIntakeReview({
      snapshot: {
        ...EMPTY,
        roleTitle: "Head of Ops",
        whyOpen: "Growth",
        requirements: [{ text: "Warehouse ops", tag: "must_have" }],
        location: "Lisbon",
        companyName: "Acme",
      },
      required: {},
    });
    const fields = r.groups.flatMap((g) => g.rows.map((row) => row.field));
    expect(fields).toEqual(["companyName", "roleTitle", "whyOpen", "mustHaves", "location"]);
    expect(r.groups.map((g) => g.step)).toEqual([0, 1, 2]);
    expect(r.answeredCount).toBe(5);
  });

  it("omits skipped optional fields rather than showing empty rows", () => {
    const r = buildIntakeReview({
      snapshot: { ...EMPTY, roleTitle: "Head of Ops" },
      required: {},
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.rows).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain("Not provided");
  });

  it("names missing required fields with the step to jump to", () => {
    const r = buildIntakeReview({
      snapshot: { ...EMPTY, roleTitle: "Head of Ops" },
      required: { roleTitle: true, whyOpen: true, companyName: true, team: false },
    });
    expect(r.missing.map((m) => m.field)).toEqual(["companyName", "whyOpen"]);
    expect(r.missing[1]).toMatchObject({ step: 1, focusLabel: "Why is this role open?" });
  });

  it("counts ticks, files and secrets as answered without showing them", () => {
    const r = buildIntakeReview({
      snapshot: { ...EMPTY, jdFilename: "jd.pdf" },
      required: { consent: true, password: true, jobDescriptionText: true },
      satisfied: { consent: true, password: true, jobDescriptionText: true },
    });
    expect(r.missing).toEqual([]);
    expect(JSON.stringify(r.groups)).not.toContain("password");
  });

  it("sends the client back to the step each row came from", () => {
    const r = buildIntakeReview({
      snapshot: { ...EMPTY, targetStartDate: "2026-09-01", decisionMaker: "COO" },
      required: {},
    });
    const rows = r.groups.flatMap((g) => g.rows);
    expect(rows.find((x) => x.field === "targetStartDate")).toMatchObject({
      step: 2,
      focusLabel: "Ideal start date",
    });
    expect(rows.find((x) => x.field === "decisionMaker")).toMatchObject({ step: 2 });
  });
});
