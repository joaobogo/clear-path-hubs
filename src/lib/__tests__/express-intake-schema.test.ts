import { describe, expect, it } from "vitest";
import {
  ALLOWED_JD_EXT,
  UNREADABLE_JD_EXT,
  blueprintProgress,
  expressIntakeSchema,
  jdFileExt,
  MIN_JD_TEXT,
  countMustHaves,
  linesToRequirements,
  requirementsToLines,
  validateRequirements,
} from "@/lib/express-intake-schema";

const valid = {
  idempotencyKey: "abcdefgh12345678",
  companyName: "Northwind Hotels",
  companyWebsite: "northwindhotels.com",
  firstName: "Ana",
  lastName: "Reis",
  workEmail: "ana@northwindhotels.com",
  phone: "+351912345678",
  password: "correct-horse",
  confirmPassword: "correct-horse",
  roleTitle: "Front Office Manager",
  jobDescriptionText: "x".repeat(MIN_JD_TEXT),
  whyOpen: "Our front office lead left in March and no one owns the guest experience.",
  mustHaves: "5+ years front office\nOpera PMS",
  trainable: "Our loyalty programme",
  dealBreakers: "No one who cannot work weekend shifts.",
  location: "Lisbon, Portugal",
  workModel: "onsite" as const,
  onsiteDays: 5,
  currency: "EUR" as const,
  compensationPeriod: "year" as const,
  salaryMin: 40000,
  salaryMax: 50000,
  workAuthorization: "already_authorized" as const,
  interviewProcess: "Call with me, then a panel on site, offer the same week.",
  decisionMaker: "Ana Reis, General Manager",
  consent: true as const,
  pilotAcknowledgement: true as const,
};


describe("expressIntakeSchema", () => {
  it("accepts a complete submission", () => {
    expect(expressIntakeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const r = expressIntakeSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(r.success).toBe(false);
  });

  it("requires a job description file or enough pasted text", () => {
    const short = expressIntakeSchema.safeParse({ ...valid, jobDescriptionText: "too short" });
    expect(short.success).toBe(false);

    const withFile = expressIntakeSchema.safeParse({
      ...valid,
      jobDescriptionText: "",
      jobDescriptionFile: { filename: "jd.pdf", mime: "application/pdf", base64: "JVBERi0=" },
    });
    expect(withFile.success).toBe(true);
  });

  it("allows a password-less submission (signed-in client) to reach the server", () => {
    const r = expressIntakeSchema.safeParse({ ...valid, password: "", confirmPassword: "" });
    expect(r.success).toBe(true);
  });

  it("requires consent and the pilot acknowledgement", () => {
    expect(expressIntakeSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(
      expressIntakeSchema.safeParse({ ...valid, pilotAcknowledgement: false }).success,
    ).toBe(false);
  });

  it("rejects a non-LinkedIn URL in a LinkedIn field", () => {
    expect(
      expressIntakeSchema.safeParse({ ...valid, companyLinkedin: "https://example.com/x" }).success,
    ).toBe(false);
    expect(
      expressIntakeSchema.safeParse({
        ...valid,
        companyLinkedin: "https://linkedin.com/company/northwind",
      }).success,
    ).toBe(true);
});

describe("role brief", () => {
  it("accepts a single must-have but not an empty list", () => {
    expect(
      expressIntakeSchema.safeParse({ ...valid, mustHaves: "5+ years front office" }).success,
    ).toBe(true);
    expect(expressIntakeSchema.safeParse({ ...valid, mustHaves: "" }).success).toBe(false);
  });

  it("requires why the role is open, and lets deal-breakers be finished later", () => {
    expect(expressIntakeSchema.safeParse({ ...valid, whyOpen: "growth" }).success).toBe(false);
    expect(expressIntakeSchema.safeParse({ ...valid, dealBreakers: "" }).success).toBe(true);
  });

  it("rejects a tagged requirements list that breaks the rules", () => {
    const withReqs = (requirements: Array<{ text: string; tag: string }>) =>
      expressIntakeSchema.safeParse({ ...valid, requirements }).success;
    expect(withReqs([{ text: "Nice bonus skill", tag: "nice_to_have" }])).toBe(false);
    expect(
      withReqs([
        { text: "Runs a P&L", tag: "must_have" },
        { text: "runs a p&l", tag: "must_have" },
      ]),
    ).toBe(false);
    expect(withReqs([{ text: "AB", tag: "must_have" }])).toBe(false);
    expect(
      withReqs([
        { text: "Runs a P&L above $2M", tag: "must_have" },
        { text: "Multi-site experience", tag: "nice_to_have" },
        { text: "Our scheduling tool", tag: "trainable" },
      ]),
    ).toBe(true);
  });

  it("rejects an inverted compensation range", () => {
    expect(
      expressIntakeSchema.safeParse({ ...valid, salaryMin: 60000, salaryMax: 40000 }).success,
    ).toBe(false);
  });

  it("requires on-site days unless the role is fully remote", () => {
    expect(
      expressIntakeSchema.safeParse({ ...valid, workModel: "hybrid", onsiteDays: undefined }).success,
    ).toBe(false);
    expect(
      expressIntakeSchema.safeParse({ ...valid, workModel: "remote", onsiteDays: undefined }).success,
    ).toBe(true);
  });
});


});

describe("job description file types", () => {
  it("reads the extension case-insensitively", () => {
    expect(jdFileExt("Role Brief.PDF")).toBe("pdf");
    expect(jdFileExt("noextension")).toBe("");
  });

  it("accepts the four readable formats and names legacy .doc separately", () => {
    for (const ext of ["pdf", "docx", "txt", "rtf"]) expect(ALLOWED_JD_EXT.has(ext)).toBe(true);
    expect(ALLOWED_JD_EXT.has("doc")).toBe(false);
    expect(UNREADABLE_JD_EXT.has("doc")).toBe(true);
  });
});

describe("blueprintProgress", () => {
  it("advances monotonically through the stages", () => {
    expect(blueprintProgress("queued")).toBeLessThan(blueprintProgress("analyzing_jd"));
    expect(blueprintProgress("analyzing_jd")).toBeLessThan(blueprintProgress("drafting_blueprint"));
    expect(blueprintProgress("ready")).toBe(100);
  });

  it("treats unknown states as no progress and failures as terminal", () => {
    expect(blueprintProgress("not_started")).toBe(0);
    expect(blueprintProgress("failed")).toBe(100);
  });
});

describe("validateRequirements", () => {
  const must = (text: string) => ({ text, tag: "must_have" as const });

  it("guards above six must-haves and clears once confirmed", () => {
    const seven = [
      "one thing",
      "two thing",
      "three thing",
      "four thing",
      "five thing",
      "six thing",
      "seven thing",
    ].map(must);
    const first = validateRequirements(seven);
    expect(first.ok).toBe(false);
    expect(first.needsConfirm).toBe(true);
    expect(first.listError).toContain("6 or fewer must-haves");
    const confirmed = validateRequirements(seven, { manyConfirmed: true });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.needsConfirm).toBe(false);
  });

  it("keeps trainable items out of the must-have count", () => {
    const res = validateRequirements([
      must("Runs a P&L above $2M"),
      { text: "Our scheduling tool", tag: "trainable" },
      { text: "Multi-site experience", tag: "nice_to_have" },
    ]);
    expect(res.ok).toBe(true);
    expect(countMustHaves([must("a thing"), { text: "b thing", tag: "trainable" }])).toBe(1);
  });

  it("reports duplicates on the later row only", () => {
    const res = validateRequirements([must("Runs a P&L"), must("runs a  p&l")]);
    expect(res.rowErrors[0]).toBeUndefined();
    expect(res.rowErrors[1]).toBe("You already listed this one");
  });

  it("round-trips between the tagged list and the legacy strings", () => {
    const items = [
      must("Runs a P&L above $2M"),
      { text: "Multi-site experience", tag: "nice_to_have" as const },
      { text: "Our scheduling tool", tag: "trainable" as const },
    ];
    const lines = requirementsToLines(items);
    expect(lines.mustHaves).toBe("Runs a P&L above $2M");
    expect(linesToRequirements(lines)).toEqual(items);
  });
});
