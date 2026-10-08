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
  it("renders every answered field, grouped by topic with per-field step destinations", () => {
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
    expect(r.groups.map((g) => g.step)).toEqual([0, 1, 1, 2]);
    expect(r.answeredCount).toBe(4);
  });

  it("omits skipped optional fields rather than showing empty rows", () => {
    const r = buildIntakeReview({
      snapshot: { ...EMPTY, roleTitle: "Head of Ops" },
      required: {},
    });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]?.rows).toHaveLength(1);
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
      focusLabel: "When would you like them to start?",
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
    expect(r.groups.map((g) => g.title)).toEqual(["Company and hiring contact", "Role overview"]);
  });
});

const rowsFor = (snapshot: Partial<IntakeReviewSnapshot>, required: Record<string, boolean> = {}) =>
  buildIntakeReview({ snapshot: { ...EMPTY, ...snapshot }, required });
const COMP = { salaryMin: "", salaryMax: "", currency: "EUR", period: "year", undecided: false, bonus: "", equity: "", flexible: false, note: "" };

describe("complete hiring brief", () => {
  it("keeps the entire description, original newlines, and attachment name", () => {
    const text = "First paragraph\n\n" + "Long description. ".repeat(100) + "\nFinal line";
    const r = rowsFor({ jobDescriptionText: text, jdFilename: "role.pdf" });
    const rows = r.groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.field === "jobDescriptionText")?.value).toBe(text);
    expect(rows.find((r) => r.field === "jdFilename")?.value).toBe("role.pdf");
  });
  it.each([
    ["70000", "", "EUR From 70,000 per year", "salaryMin", "From"],
    ["", "85000", "EUR Up to 85,000 per year", "salaryMax", "To"],
    ["70000", "85000", "EUR 70,000–85,000 per year", "salaryMin", "From"],
  ])("shows explicit compensation bounds %s / %s", (min, max, value, field, focusLabel) => {
    const r = rowsFor({ compensation: { ...COMP, salaryMin: min, salaryMax: max } });
    expect(r.groups.flatMap((g) => g.rows).find((r) => r.field === field)).toMatchObject({ value, step: 2, focusLabel });
  });
  it("does not hide extras when compensation is undecided", () => {
    const r = rowsFor({ compensation: { ...COMP, undecided: true, bonus: "10% annual", equity: "none", flexible: true, note: "Relocation available" } });
    expect(r.groups.flatMap((g) => g.rows).map((r) => r.value)).toEqual(["Not decided yet", "10% annual", "No equity", "Flexible for the right person", "Relocation available"]);
  });
  it("never shows default currency or period when no compensation is provided", () => {
    expect(rowsFor({ compensation: COMP }).groups).toEqual([]);
  });
  it.each([["month", "per month"], ["hour", "per hour"]])("uses the entered %s pay period", (period, label) => {
    expect(JSON.stringify(rowsFor({ compensation: { ...COMP, salaryMin: "4000", period } }))).toContain(label);
  });
  it("preserves exact requirement text, order, and category", () => {
    const r = rowsFor({ requirements: [{ text: "First · exact text", tag: "must_have" }, { text: "Second\nline", tag: "must_have" }, { text: "Optional", tag: "nice_to_have" }, { text: "Learnable", tag: "trainable" }], dealBreakers: ["Cannot work the stated shift"] });
    const rows = r.groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.field === "mustHaves")?.items).toEqual(["First · exact text", "Second\nline"]);
    expect(rows.find((r) => r.field === "dealBreakerList")?.items).toEqual(["Cannot work the stated shift"]);
  });
  it("does not let nice-to-have or trainable rows satisfy required must-haves", () => {
    const r = rowsFor({ requirements: [{ text: "Optional", tag: "nice_to_have" }] }, { requirements: true });
    expect(r.missing).toEqual([expect.objectContaining({ field: "requirements", step: 1, focusLabel: "Requirements" })]);
  });
  it("does not let a surname hide a missing first name", () => {
    expect(rowsFor({ lastName: "Smith" }, { firstName: true, lastName: true }).missing.map((m) => m.field)).toEqual(["firstName"]);
  });
  it("shows stage sequence, format and both owner fields", () => {
    const r = rowsFor({ interviewStages: [{ name: "Intro", format: "phone_screen", ownerName: "Rita", ownerEmail: "rita@example.com" }, { name: "Panel", format: "panel" }] });
    expect(r.groups.flatMap((g) => g.rows).find((r) => r.field === "interviewStages")).toMatchObject({ step: 2, focusLabel: "interviewStages", stages: [{ name: "Intro", format: "Phone screen", owner: "Rita — rita@example.com" }, { name: "Panel", format: "Panel", owner: "" }] });
  });
  it("shows collaborators only when people with meaningful emails are supplied", () => {
    expect(rowsFor({ inviteCollaborators: true }).groups).toEqual([]);
    expect(JSON.stringify(rowsFor({ collaborators: [{ name: "Rita", email: "rita@example.com" }], inviteCollaborators: false }))).toContain("No invitations requested");
  });
  it("humanises provided seniority and employment without inventing defaults", () => {
    expect(rowsFor({ seniority: "senior", employmentType: "part_time" }).groups.flatMap((g) => g.rows).map((r) => r.value)).toEqual(["Senior", "Part time"]);
  });
  it("never serialises secrets from additional state fields", () => {
    const snapshot = { ...EMPTY, roleTitle: "Engineer", password: "secret-value", confirmPassword: "secret-value", companyFax: "spam", access_token: "private-token" };
    const result = JSON.stringify(buildIntakeReview({ snapshot, required: {} }));
    for (const secret of ["secret-value", "private-token", "companyFax", "access_token"]) expect(result).not.toContain(secret);
  });
  it("edits a derived company website through the email that supplies it", () => {
    const r = rowsFor({ companyWebsite: "example.com", companyWebsiteDerived: true });
    expect(r.groups[0]?.rows[0]).toMatchObject({ step: 0, focusLabel: "Work email" });
  });
  it("keeps authorisation from older drafts without repeating the sponsorship answer", () => {
    expect(JSON.stringify(rowsFor({ workAuthorizationLabel: "Contractor or agency of record" }))).toContain("Contractor or agency of record");
    const rows = rowsFor({ sponsorshipLabel: "Sponsorship available", workAuthorizationLabel: "We can sponsor or transfer a visa" }).groups.flatMap((g) => g.rows);
    expect(rows.map((r) => r.field)).toEqual(["sponsorshipAvailable"]);
  });
  it("preserves complete process and authorisation notes with editable destinations", () => {
    const text = "Process notes\n\n" + "Full details. ".repeat(100);
    const rows = rowsFor({ interviewProcess: text, workAuthorizationNote: text }).groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.field === "interviewProcess")).toMatchObject({ value: text, step: 2, focusLabel: "Additional interview details" });
    expect(rows.find((r) => r.field === "workAuthorizationNote")).toMatchObject({ value: text, step: 2, focusLabel: "Authorisation note" });
  });
  it("keeps geography and timezones without inventing a boundary", () => {
    const rows = rowsFor({ remoteAnywhereInCountry: true, remoteTimezoneLabels: ["Europe Central (UTC+1 to UTC+3)"] }).groups.flatMap((g) => g.rows);
    expect(rows[0]).toMatchObject({ field: "remoteTimezones", value: "Anywhere in the country · Europe Central (UTC+1 to UTC+3)", step: 2 });
    expect(rowsFor({ remoteTimezoneLabels: [] }).groups).toEqual([]);
  });
  it("ignores empty collaborator rows and uses the actual invitation timing", () => {
    expect(rowsFor({ collaborators: [{ name: "", email: "" }] }).groups).toEqual([]);
    expect(JSON.stringify(rowsFor({ collaborators: [{ name: "Rita", email: "rita@example.com" }], inviteCollaborators: true }))).toContain("after the role is accepted");
  });
  it("allows source-description edits for extracted seniority and employment", () => {
    const rows = rowsFor({ seniority: "senior", employmentType: "part_time" }).groups.flatMap((g) => g.rows);
    for (const row of rows) expect(row).toMatchObject({ step: 0, focusLabel: "Job description" });
    expect(rows.every((r) => r.editable !== false)).toBe(true);
  });
});
