import { describe, expect, it } from "vitest";
import {
  ALLOWED_JD_EXT,
  COMPENSATION_HONEST_LINE,
  briefCompleteness,
  isWideCompensationRange,
  UNREADABLE_JD_EXT,
  blueprintProgress,
  expressIntakeSchema,
  intakeRequiredness,
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
  sponsorshipAvailable: "no" as const,
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

  describe("compensation trade-off", () => {
    it("flags ranges wider than the stated threshold and not below it", () => {
      // 60% of 40000 is 24000: 64000 is exactly at the line, 65000 is over it.
      expect(isWideCompensationRange(40000, 64000)).toBe(false);
      expect(isWideCompensationRange(40000, 65000)).toBe(true);
      expect(isWideCompensationRange(undefined, 90000)).toBe(false);
    });

    it("requires confirmation for a wide range, and accepts it once confirmed", () => {
      const wide = { ...valid, salaryMin: 40000, salaryMax: 120000 };
      const rejected = expressIntakeSchema.safeParse(wide);
      expect(rejected.success).toBe(false);
      if (!rejected.success) {
        expect(rejected.error.issues.some((i) => i.path[0] === "wideRangeConfirmed")).toBe(true);
      }
      expect(
        expressIntakeSchema.safeParse({ ...wide, wideRangeConfirmed: true }).success,
      ).toBe(true);
    });

    it("records an undecided range as undecided rather than zero", () => {
      const res = expressIntakeSchema.safeParse({
        ...valid,
        salaryMin: undefined,
        salaryMax: undefined,
        compensationUndecided: true,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.compensationUndecided).toBe(true);
        expect(res.data.salaryMin).toBeUndefined();
        expect(res.data.salaryMax).toBeUndefined();
      }
      // An undecided range leaves the brief incomplete for that field.
      expect(briefCompleteness({ ...valid, salaryMin: undefined }).missing).toContain(
        "Compensation range",
      );
    });

    it("refuses undecided alongside a stated range", () => {
      expect(
        expressIntakeSchema.safeParse({ ...valid, compensationUndecided: true }).success,
      ).toBe(false);
    });

    it("accepts bonus, equity and the flexibility flag", () => {
      const res = expressIntakeSchema.safeParse({
        ...valid,
        bonusStructure: "10% annual",
        equity: "negotiable",
        compensationFlexible: true,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.equity).toBe("negotiable");
        expect(res.data.compensationFlexible).toBe(true);
      }
    });

    it("never states a market benchmark as fact", () => {
      expect(COMPENSATION_HONEST_LINE).not.toMatch(/market (rate|average|benchmark) (is|of)/i);
      expect(COMPENSATION_HONEST_LINE).toMatch(/shortlist/i);
    });
  });

  it("requires on-site days unless the role is fully remote", () => {
    expect(
      expressIntakeSchema.safeParse({ ...valid, workModel: "hybrid", onsiteDays: undefined }).success,
    ).toBe(false);
    expect(
      expressIntakeSchema.safeParse({
        ...valid,
        workModel: "remote",
        onsiteDays: undefined,
        remoteAnywhereInCountry: true,
      }).success,
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

describe("intakeRequiredness", () => {
  const blankFor = (field: string): unknown => {
    if (field === "consent" || field === "pilotAcknowledgement") return false;
    if (field === "requirements") return [];
    // An unticked optional checkbox falls back to its default, not "".
    if (
      field === "researchConsent" ||
      field === "compensationUndecided" ||
      field === "compensationFlexible" ||
      field === "wideRangeConfirmed"
    ) {
      return undefined;
    }
    if (field === "onsiteDays" || field === "salaryMin" || field === "salaryMax") return undefined;
    return "";
  };

  it("marks a field required in the UI whenever the server rejects it blank", () => {
    const req = intakeRequiredness({ workModel: valid.workModel });
    for (const [field, required] of Object.entries(req)) {
      // requirements is validated as a list by validateRequirements, and the
      // legacy mustHaves string covers it in the schema — checked separately.
      if (field === "requirements" || field === "confirmPassword") continue;
      // The salary pair is optional together: half a range is rejected as a
      // pair rule, not because either field is required on its own.
      if (field === "salaryMin" || field === "salaryMax") continue;
      // Remote boundary is a pair rule too: a timezone band OR anywhere in the
      // country satisfies it, so neither field is required on its own.
      if (field === "remoteTimezones" || field === "remoteAnywhereInCountry") continue;
      const payload: Record<string, unknown> = { ...valid, [field]: blankFor(field) };
      const serverRejects = !expressIntakeSchema.safeParse(payload).success;
      expect(
        { field, required, serverRejects },
        `${field}: UI requiredness must match the server`,
      ).toEqual({ field, required: serverRejects, serverRejects });
    }
  });

  it("treats the salary range as optional, but only as a pair", () => {
    const req = intakeRequiredness();
    expect(req["salaryMin"]).toBe(false);
    expect(req["salaryMax"]).toBe(false);
    const bothBlank = expressIntakeSchema.safeParse({
      ...valid,
      salaryMin: undefined,
      salaryMax: undefined,
    });
    expect(bothBlank.success).toBe(true);
  });

  it("requires at least one must-have, so requirements is required", () => {
    expect(intakeRequiredness()["requirements"]).toBe(true);
    expect(validateRequirements([]).ok).toBe(false);
  });

  it("drops the pasted-JD requirement once a file is attached", () => {
    expect(intakeRequiredness()["jobDescriptionText"]).toBe(true);
    expect(intakeRequiredness({ hasJdFile: true })["jobDescriptionText"]).toBe(false);
  });

  it("only asks a signed-out client for a password", () => {
    expect(intakeRequiredness()["password"]).toBe(true);
    expect(intakeRequiredness()["confirmPassword"]).toBe(true);
    expect(intakeRequiredness({ authed: true })["password"]).toBe(false);
    expect(intakeRequiredness({ signInMode: true })["confirmPassword"]).toBe(false);
  });

  it("requires on-site days only when the role is not fully remote", () => {
    expect(intakeRequiredness({ workModel: "" })["onsiteDays"]).toBe(false);
    expect(intakeRequiredness({ workModel: "remote" })["onsiteDays"]).toBe(false);
    expect(intakeRequiredness({ workModel: "hybrid" })["onsiteDays"]).toBe(true);
  });
});


describe("location, on-site expectation and work authorisation", () => {
  it("requires an explicit sponsorship answer", () => {
    const { sponsorshipAvailable: _drop, ...rest } = valid;
    expect(expressIntakeSchema.safeParse(rest).success).toBe(false);
  });

  it("requires a location and 1-5 on-site days for hybrid", () => {
    const base = { ...valid, workModel: "hybrid" as const };
    expect(expressIntakeSchema.safeParse({ ...base, onsiteDays: 3 }).success).toBe(true);
    expect(expressIntakeSchema.safeParse({ ...base, onsiteDays: 0 }).success).toBe(false);
    expect(expressIntakeSchema.safeParse({ ...base, onsiteDays: 6 }).success).toBe(false);
    expect(
      expressIntakeSchema.safeParse({ ...base, onsiteDays: 3, location: "" }).success,
    ).toBe(false);
  });

  it("requires a timezone band or anywhere-in-country for remote", () => {
    const base = { ...valid, workModel: "remote" as const, onsiteDays: undefined };
    expect(expressIntakeSchema.safeParse(base).success).toBe(false);
    expect(
      expressIntakeSchema.safeParse({ ...base, remoteTimezones: ["uk_ireland"] }).success,
    ).toBe(true);
    expect(
      expressIntakeSchema.safeParse({ ...base, remoteAnywhereInCountry: true }).success,
    ).toBe(true);
  });

  it("drops answers that no longer apply to the chosen work model", () => {
    const r = expressIntakeSchema.safeParse({
      ...valid,
      workModel: "remote" as const,
      onsiteDays: 3,
      remoteAnywhereInCountry: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.onsiteDays ?? null).toBeNull();
    }
  });

  it("counts a remote role with timezones as located in the brief", () => {
    const brief = briefCompleteness({
      location: "",
      workModel: "remote",
      remoteTimezones: ["uk_ireland"],
      remoteAnywhereInCountry: false,
      salaryMin: 40000,
      workAuthorization: "already_authorized",
      interviewProcess: "Call, panel, offer.",
      decisionMaker: "Ana Reis",
      dealBreakers: "Weekend shifts required.",
    });
    expect(brief.missing).not.toContain("Where the role is based");
  });
});
