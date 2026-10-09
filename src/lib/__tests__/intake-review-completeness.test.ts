import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REVIEW_COVERAGE,
  buildIntakeReview,
  formatCompensationRange,
  formatReviewDate,
  humanizeEnum,
  type IntakeReviewSnapshot,
} from "../intake-review";

/** The keys of `type FormState = { … }` in the intake route, read from source. */
function formStateKeys(): string[] {
  const src = readFileSync(join(process.cwd(), "src/routes/intake.tsx"), "utf8");
  const start = src.indexOf("type FormState = {");
  expect(start, "FormState type must exist in intake.tsx").toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf("\n};", start));
  const keys = new Set<string>();
  for (const line of body.split("\n")) {
    const m = /^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/.exec(line);
    if (m) keys.add(m[1]!);
  }
  return [...keys];
}

describe("the final intake summary covers every answer", () => {
  it("every form field is either reviewed or excluded with a stated reason", () => {
    const covered = new Set<string>([
      ...REVIEW_COVERAGE.reviewed,
      ...Object.keys(REVIEW_COVERAGE.notReviewed),
    ]);
    const keys = formStateKeys();
    expect(keys.length).toBeGreaterThan(30);
    const uncovered = keys.filter((k) => !covered.has(k));
    expect(uncovered, "add these to the review or to REVIEW_COVERAGE.notReviewed with a reason").toEqual([]);
    // And nothing listed that the form no longer has (stale coverage).
    const stale = [...covered].filter((k) => !keys.includes(k));
    expect(stale).toEqual([]);
  });

  const FULL: IntakeReviewSnapshot = {
    roleTitle: "Senior Accountant",
    team: "Finance Operations",
    jobDescriptionText: "Own the month-end close.",
    jdFilename: null,
    requirements: [
      { text: "CPA", tag: "must_have" },
      { text: "NetSuite", tag: "nice_to_have" },
      { text: "Consolidation", tag: "trainable" },
    ],
    location: "Lisbon, Portugal",
    workModelLabel: "Hybrid",
    onsiteDays: "2",
    remoteAnywhereInCountry: false,
    remoteTimezoneLabels: [],
    sponsorshipLabel: "No",
    compensationLine: "EUR 60,000–75,000 per year",
    workAuthorizationLabel: "",
    workAuthorizationNote: "EU passport holders only",
    targetStartDate: "2026-11-02",
    interviewStageLines: ["Screen", "Panel"],
    interviewStageDetails: ["Screen — Video call — run by Ana <ana@acme.com>", "Panel — Panel"],
    interviewProcess: "Two rounds over one week.",
    targetDaysToOffer: "21",
    decisionMaker: "CFO",
    decisionMakerEmail: "cfo@acme.com",
    dealBreakers: ["No audit experience"],
    companyName: "Acme",
    companyWebsite: "acme.com",
    companyLinkedin: "https://linkedin.com/company/acme",
    firstName: "Ana",
    lastName: "Silva",
    contactTitle: "Head of People",
    workEmail: "ana@acme.com",
    phone: "+351 912 345 678",
    contactLinkedin: "https://linkedin.com/in/ana",
    seniority: "Senior",
    employmentType: "Full time",
    collaboratorsLine: "Invite 1 person from the interview stages to the workspace",
    termsAccepted: true,
    pilotAcknowledged: true,
    researchConsent: true,
    passwordSet: true,
  };

  it("a fully answered brief produces a row for every answer, in full", () => {
    const r = buildIntakeReview({ snapshot: FULL, required: {} });
    const rows = new Map(r.groups.flatMap((g) => g.rows).map((x) => [x.field, x.value]));
    for (const field of [
      "roleTitle", "team", "seniority", "employmentType", "jobDescriptionText", "mustHaves",
      "niceToHaves", "trainable", "location", "workModel", "onsiteDays", "sponsorshipAvailable",
      "salaryMin", "workAuthorizationNote", "targetStartDate", "interviewStages", "interviewProcess",
      "targetDaysToOffer", "decisionMaker", "decisionMakerEmail", "dealBreakerList", "companyName",
      "companyWebsite", "companyLinkedin", "firstName", "contactTitle", "workEmail", "phone",
      "contactLinkedin", "passwordSummary", "collaborators", "termsSummary", "pilotSummary",
      "researchSummary",
    ]) {
      expect(rows.has(field), `missing review row: ${field}`).toBe(true);
    }
    expect(rows.get("targetStartDate")).toBe("2 November 2026");
    expect(rows.get("interviewStages")).toContain("run by Ana <ana@acme.com>");
    expect(rows.get("firstName")).toBe("Ana Silva");
    expect(rows.get("passwordSummary")).not.toContain("secret");
  });

  it("never shows a password or a skipped acknowledgement", () => {
    const r = buildIntakeReview({
      snapshot: { ...FULL, passwordSet: false, researchConsent: false },
      required: {},
    });
    const fields = r.groups.flatMap((g) => g.rows).map((x) => x.field);
    expect(fields).not.toContain("passwordSummary");
    expect(fields).not.toContain("researchSummary");
  });
});

describe("summary formatting helpers", () => {
  it("shows any salary bound, not only a full range", () => {
    expect(formatCompensationRange({ currency: "USD", min: "90000", max: "110000", periodLabel: "per year" }))
      .toBe("USD 90,000–110,000 per year");
    expect(formatCompensationRange({ currency: "USD", min: "90000", max: "", periodLabel: "per year" }))
      .toBe("From USD 90,000 per year");
    expect(formatCompensationRange({ currency: "GBP", min: "", max: "45", periodLabel: "per hour" }))
      .toBe("Up to GBP 45 per hour");
    expect(formatCompensationRange({ currency: "USD", min: "", max: "", periodLabel: "per year" })).toBe("");
    expect(formatCompensationRange({ currency: "USD", min: "abc", max: "-5", periodLabel: "" })).toBe("");
  });

  it("formats ISO dates for reading and leaves anything else as typed", () => {
    expect(formatReviewDate("2026-09-01")).toBe("1 September 2026");
    expect(formatReviewDate("2026-02-30")).toBe("2026-02-30");
    expect(formatReviewDate("ASAP")).toBe("ASAP");
    expect(formatReviewDate("")).toBe("");
  });

  it("humanises enum values", () => {
    expect(humanizeEnum("full_time")).toBe("Full time");
    expect(humanizeEnum("senior")).toBe("Senior");
    expect(humanizeEnum("")).toBe("");
  });
});
