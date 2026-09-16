/**
 * The review must name every reason submit is held, and no reason it isn't.
 *
 * Two failures are possible here and they are not symmetric. Listing too
 * little is what shipped: the summary read as cleared while a compensation
 * conflict held the button, so the client saw an enabled-looking flow that did
 * nothing (audit 16 Sep, INT-001). Listing too MUCH would be worse — the
 * buttons are disabled on this list, so a false blocker would stop every
 * intake in the funnel. The first test below is the one that guards the
 * business.
 */
import { describe, expect, it } from "vitest";
import { intakeSubmitBlockers } from "@/lib/intake-submit-blockers";
import { expressIntakeSchema } from "@/lib/express-intake-schema";

/** A brief with every required answer given and nothing contradictory. */
const completeBrief = () => ({
  idempotencyKey: "intakereview01",
  companyName: "Northwind Health",
  companyWebsite: "northwindhealth.com",
  companyLinkedin: "",
  firstName: "Rita",
  lastName: "Sequeira",
  contactTitle: "Head of Talent",
  workEmail: "rita@northwindhealth.com",
  phone: "",
  contactLinkedin: "",
  password: "",
  confirmPassword: "",
  roleTitle: "Senior Accountant",
  team: "Finance",
  jobDescriptionText:
    "We are hiring a Senior Accountant to own month-end close, statutory reporting and the audit relationship. ".repeat(
      6,
    ),
  jobDescriptionFile: null,
  requirements: [
    { text: "Qualified accountant (ACA, ACCA or CIMA)", tag: "must_have" },
    { text: "Month-end close ownership", tag: "must_have" },
    { text: "Experience with NetSuite", tag: "nice_to_have" },
  ],
  mustHaves: "Qualified accountant (ACA, ACCA or CIMA)\nMonth-end close ownership",
  niceToHaves: "Experience with NetSuite",
  manyMustHavesConfirmed: false,
  dealBreakers: "",
  dealBreakerList: [],
  location: "Austin, United States",
  workModel: "onsite",
  seniority: "senior",
  employmentType: "full_time",
  onsiteDays: undefined,
  remoteTimezones: [],
  remoteAnywhereInCountry: false,
  sponsorshipAvailable: "no",
  currency: "USD",
  compensationPeriod: "year",
  salaryMin: 95_000,
  salaryMax: 115_000,
  compensationNote: "",
  compensationUndecided: false,
  bonusStructure: "",
  equity: "none",
  compensationFlexible: false,
  wideRangeConfirmed: false,
  workAuthorization: "",
  workAuthorizationNote: "",
  interviewProcess: "",
  interviewStages: [],
  targetDaysToOffer: undefined,
  decisionMaker: "",
  decisionMakerEmail: "",
  inviteCollaborators: false,
  targetStartDate: "",
  consent: true,
  pilotAcknowledgement: true,
  researchConsent: false,
  source: "express_onboarding",
  companyFax: "",
});

describe("a brief the schema accepts is never blocked", () => {
  it("the fixture really is a valid submission", () => {
    // If this ever fails the fixture drifted from the schema, and the test
    // below would be proving nothing.
    const parsed = expressIntakeSchema.safeParse(completeBrief());
    expect(
      parsed.success,
      parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2),
    ).toBe(true);
  });

  it("reports no blockers at all", () => {
    // The submit buttons are disabled on this list. A single false positive
    // here would stop every intake in the funnel.
    expect(intakeSubmitBlockers(completeBrief())).toEqual([]);
  });

  it("accepts the placeholder key the review validates with", () => {
    // The review cannot mint the real idempotency key, so it passes a
    // placeholder. If the key rule tightened, the review would report a
    // blocker the client could never clear.
    const out = intakeSubmitBlockers({ ...completeBrief(), idempotencyKey: "intakereview01" });
    expect(out.map((b) => b.field)).not.toContain("idempotencyKey");
  });
});

describe("a conflict between two answered fields is named", () => {
  it("names the compensation conflict the review used to hide", () => {
    // The exact INT-001 state: both fields answered, nothing "missing", and
    // submit refuses.
    const out = intakeSubmitBlockers({
      ...completeBrief(),
      compensationUndecided: true,
      salaryMin: 95_000,
      salaryMax: 115_000,
    });
    expect(out.map((b) => b.field)).toContain("compensationUndecided");
    expect(out.find((b) => b.field === "compensationUndecided")?.message).toMatch(
      /Clear the range, or untick/i,
    );
  });

  it("names a backwards salary range", () => {
    const out = intakeSubmitBlockers({
      ...completeBrief(),
      salaryMin: 115_000,
      salaryMax: 95_000,
    });
    expect(out.map((b) => b.field)).toContain("salaryMax");
  });

  it("carries the message from the rule, not a generic one", () => {
    const out = intakeSubmitBlockers({ ...completeBrief(), workEmail: "not-an-address" });
    expect(out).toHaveLength(1);
    expect(out[0]!.message.length).toBeGreaterThan(0);
    expect(out[0]!.message).not.toMatch(/^invalid$/i);
  });
});

describe("the client is never told the same thing twice", () => {
  it("skips fields the review already lists as missing", () => {
    const withoutTitle = { ...completeBrief(), roleTitle: "" };
    expect(intakeSubmitBlockers(withoutTitle).map((b) => b.field)).toContain("roleTitle");
    expect(intakeSubmitBlockers(withoutTitle, ["roleTitle"]).map((b) => b.field)).not.toContain(
      "roleTitle",
    );
  });

  it("reports one entry per field even when a field fails twice", () => {
    const out = intakeSubmitBlockers({ ...completeBrief(), salaryMin: 115_000, salaryMax: 95_000 });
    const fields = out.map((b) => b.field);
    expect(new Set(fields).size).toBe(fields.length);
  });
});

describe("form-level rules the schema does not own are included", () => {
  it("adds the placement and process errors the form applies", () => {
    const out = intakeSubmitBlockers(completeBrief(), [], {
      remoteTimezones: "Pick at least one acceptable timezone, or say anywhere in the country",
      decisionMakerEmail: "Enter a valid email address",
    });
    expect(out.map((b) => b.field).sort()).toEqual(["decisionMakerEmail", "remoteTimezones"]);
  });

  it("ignores undefined entries, so a caller can pass its raw result", () => {
    expect(
      intakeSubmitBlockers(completeBrief(), [], {
        interviewStages: undefined,
        targetDaysToOffer: undefined,
      }),
    ).toEqual([]);
  });
});
