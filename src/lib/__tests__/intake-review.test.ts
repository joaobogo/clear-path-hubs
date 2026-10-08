import { describe, expect, it } from "vitest";
import { buildIntakeReview, type IntakeReviewSnapshot } from "../intake-review";

const EMPTY: IntakeReviewSnapshot = {
  roleTitle: "",
  team: "",
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
        requirements: [{ text: "Warehouse ops", tag: "must_have" }],
        location: "Lisbon",
        companyName: "Acme",
      },
      required: {},
    });
    const fields = r.groups.flatMap((g) => g.rows.map((row) => row.field));
    expect(fields).toEqual(["companyName", "roleTitle", "mustHaves", "location"]);
    expect(r.groups.map((g) => g.step)).toEqual([0, 1, 2]);
    expect(r.answeredCount).toBe(4);
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
      required: { roleTitle: true, companyName: true, team: false },
    });
    expect(r.missing.map((m) => m.field)).toEqual(["companyName"]);
    expect(r.missing[0]).toMatchObject({ step: 0, focusLabel: "Company name" });
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

  it("sends reshuffled fields back to their current steps", () => {
    const r = buildIntakeReview({
      snapshot: {
        ...EMPTY,
        jobDescriptionText: "Lead the operations team.",
        companyWebsite: "northwindhealth.com",
      },
      required: {},
    });
    const rows = r.groups.flatMap((g) => g.rows);

    expect(rows.find((x) => x.field === "jobDescriptionText")).toMatchObject({ step: 0 });
    expect(rows.find((x) => x.field === "companyWebsite")).toMatchObject({ step: 1 });
    expect(r.groups.map((g) => g.title)).toEqual(["You and the job description", "What we read"]);
  });

  it("keeps the complete JD body and uploaded file separate with correct edit navigation", () => {
    const fullJd = Array.from({ length: 60 }, (_, i) =>
      `Responsibility ${i + 1}: build reliable recruiting and reporting processes.`
    ).join("\\n");
    expect(fullJd.length).toBeGreaterThan(400);
    const review = buildIntakeReview({
      snapshot: {
        ...EMPTY,
        jobDescriptionText: fullJd,
        jdFilename: "complete-role.pdf",
        roleTitle: "Senior Finance Manager",
        team: "Accounting",
      },
      required: {},
    });
    const rows = review.groups.flatMap((group) => group.rows);
    expect(rows.find((row) => row.field === "jobDescriptionText")).toMatchObject({
      value: fullJd,
      step: 0,
    });
    expect(rows.find((row) => row.field === "jdFilename")?.value).toBe("complete-role.pdf");
    expect(rows.find((row) => row.field === "roleTitle")?.step).toBe(1);
    expect(rows.find((row) => row.field === "team")?.step).toBe(1);
  });

  it("includes parsed seniority, employment and the chosen collaborators", () => {
    const review = buildIntakeReview({
      snapshot: {
        ...EMPTY,
        seniorityLabel: "senior",
        employmentTypeLabel: "full time",
        collaboratorLine: "Hiring Manager (hiring@example.com)",
        interviewStageLines: ["Screening · video · Owner: Jane · jane@example.com"],
      },
      required: {},
    });
    const rows = review.groups.flatMap((group) => group.rows);
    expect(rows.find((row) => row.field === "seniority")?.value).toBe("senior");
    expect(rows.find((row) => row.field === "employmentType")?.value).toBe("full time");
    expect(rows.find((row) => row.field === "collaborators")?.step).toBe(2);
    expect(rows.find((row) => row.field === "interviewStages")?.value).toContain("Jane");
  });

  it("does not show unprovided optional values or account secrets", () => {
    const review = buildIntakeReview({ snapshot: { ...EMPTY, roleTitle: "Product Designer" }, required: {} });
    const fields = review.groups.flatMap((g) => g.rows.map((r) => r.field));
    expect(fields).toEqual(["roleTitle"]);
    expect(fields).not.toContain("password");
    expect(fields).not.toContain("confirmPassword");
  });

});
