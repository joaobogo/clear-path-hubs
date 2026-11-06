/**
 * A confidential role never names its client to a candidate.
 *
 * The job board already printed "Confidential employer" (SQL definer
 * functions), but every surface a candidate reached after applying printed
 * the real organisation name: the "application received" email, the
 * screening-invite email, the closure email, the receipt and status pages,
 * the returning-applicant card and the candidate portal. They now all read the
 * name through one helper, and select only posting.confidentiality, never the
 * rest of intake_context (which carries internal hiring notes).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIDENTIAL_EMPLOYER_NAME,
  candidateFacingEmployerName,
  isConfidentialPosting,
} from "@/lib/org/candidate-facing-employer";

describe("candidateFacingEmployerName", () => {
  it("hides the client of a confidential posting", () => {
    expect(candidateFacingEmployerName("Hughes Mushrooms", "confidential")).toBe(
      "Confidential employer",
    );
    expect(CONFIDENTIAL_EMPLOYER_NAME).toBe("Confidential employer");
  });

  it("errs towards hiding: case and stray whitespace still count as confidential", () => {
    expect(candidateFacingEmployerName("Hughes Mushrooms", " Confidential ")).toBe(
      "Confidential employer",
    );
    expect(isConfidentialPosting("CONFIDENTIAL")).toBe(true);
  });

  it("hides the client even when the organisation name is missing", () => {
    expect(candidateFacingEmployerName(null, "confidential")).toBe("Confidential employer");
  });

  it("names the client of a public posting, without internal markers", () => {
    expect(candidateFacingEmployerName("Hughes Mushrooms", "public")).toBe("Hughes Mushrooms");
    expect(candidateFacingEmployerName("Hughes Mushrooms", null)).toBe("Hughes Mushrooms");
    expect(candidateFacingEmployerName("Hughes Mushrooms", undefined)).toBe("Hughes Mushrooms");
    expect(candidateFacingEmployerName("Northwind Talent (Demo)", "public")).toBe(
      "Northwind Talent",
    );
  });

  it("returns null when there is no usable name, so callers keep their own fallback", () => {
    expect(candidateFacingEmployerName(null, "public")).toBeNull();
    expect(candidateFacingEmployerName("   ", null)).toBeNull();
  });

  it("ignores values that are not the confidential marker", () => {
    expect(isConfidentialPosting("")).toBe(false);
    expect(isConfidentialPosting("public")).toBe(false);
    expect(isConfidentialPosting(true)).toBe(false);
    expect(isConfidentialPosting({ confidentiality: "confidential" })).toBe(false);
  });
});

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
/** Source with comments removed, so prose cannot satisfy or trip a check. */
const code = (rel: string) =>
  src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const JSON_PATH = "posting_confidentiality:intake_context->posting->>confidentiality";

/** Every surface that shows a role's employer to a candidate. */
const CANDIDATE_SURFACES = [
  "src/lib/application-confirmation-email.server.ts",
  "src/lib/candidate/screening-invite.server.ts",
  "src/lib/candidate/closure-notices.server.ts",
  "src/lib/candidate/apply-status.server.ts",
  "src/lib/candidate/existing-application.server.ts",
  "src/lib/candidate/employer-view.functions.ts",
  "src/lib/apply.functions.ts",
  "src/lib/candidate.functions.ts",
];

describe("every candidate-facing surface masks a confidential employer", () => {
  it.each(CANDIDATE_SURFACES)("%s reads the name through the shared helper", (file) => {
    const body = code(file);
    expect(body).toContain("candidateFacingEmployerName(");
    expect(body).toContain(JSON_PATH);
  });

  it.each(CANDIDATE_SURFACES)("%s never selects the whole intake_context", (file) => {
    // Every mention of the column is the one JSON path above.
    const mentions = code(file).match(/intake_context[^\s,)"`]*/g) ?? [];
    for (const m of mentions) expect(m).toBe("intake_context->posting->>confidentiality");
  });

  it("the candidate portal masks every company it returns", () => {
    const portal = code("src/lib/candidate.functions.ts");
    const companies = portal.match(/company:\s*[^\n]+/g) ?? [];
    expect(companies.length).toBeGreaterThanOrEqual(3);
    for (const line of companies) expect(line).toContain("candidateFacingEmployerName(");
  });

  it("the job page uses the same constant and rule", () => {
    const jobs = code("src/lib/jobs.functions.ts");
    expect(jobs).toContain("isConfidentialPosting(posting.confidentiality)");
    expect(jobs).toContain("CONFIDENTIAL_EMPLOYER_NAME");
  });
});
