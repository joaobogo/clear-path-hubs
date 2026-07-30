import { describe, expect, it } from "vitest";
import {
  ALLOWED_JD_EXT,
  UNREADABLE_JD_EXT,
  blueprintProgress,
  expressIntakeSchema,
  jdFileExt,
  MIN_JD_TEXT,
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
