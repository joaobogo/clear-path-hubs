/**
 * FIX-09 — the scorer must not be keyword-gameable.
 *
 * A CV that only repeats the rubric's must-have terms cannot present above the
 * "Consider" band, and must never out-rank a detailed, realistic CV.
 */
import { describe, it, expect } from "vitest";
import { scoreCandidate, type RequirementInput } from "@/lib/scoring-engine.server";
import { classifyBand } from "../bands";

const REQUIREMENTS: RequirementInput[] = [
  { id: "r1", text: "Kubernetes in production", required: true, keywords: ["kubernetes"] },
  { id: "r2", text: "Terraform infrastructure as code", required: true, keywords: ["terraform"] },
  { id: "r3", text: "CI/CD pipelines", required: true, keywords: ["ci-cd"] },
];

// Long enough to parse cleanly (so the unparsed-CV cap is not what saves us),
// but with no content beyond the three rubric terms.
const KEYWORD_ECHO_CV = [
  "Kubernetes Kubernetes Kubernetes",
  "Terraform Terraform Terraform",
  "CI-CD CI-CD CI-CD",
].join("\n");

const REALISTIC_CV = `
Senior platform engineer with nine years building and running production systems
for regulated payments companies in Lisbon and Berlin.

Ran a Kubernetes estate of forty services across three regions, moving the
cluster upgrade process from a weekend of manual work to a rolling automated
process that completed inside an hour with no customer impact.

Introduced Terraform for all cloud infrastructure, replacing hand-made consoles
resources with reviewed modules, and taught fourteen engineers to ship changes
through the module library rather than filing tickets to my team.

Rebuilt the CI-CD pipelines so a service reached production in eleven minutes
instead of ninety, added progressive delivery with automatic rollback, and cut
change failure rate from eighteen percent to four percent over two quarters.

Also owned on-call practice, incident review write-ups, capacity planning and the
cost model presented quarterly to the finance team.
`;

describe("keyword-echo resistance", () => {
  const echo = scoreCandidate({
    cv_text: KEYWORD_ECHO_CV,
    requirements: REQUIREMENTS,
    screening: [],
  });
  const real = scoreCandidate({
    cv_text: REALISTIC_CV,
    requirements: REQUIREMENTS,
    screening: [],
  });

  it("caps a keyword-only CV inside or below the Consider band", () => {
    const band = classifyBand(echo.score);
    expect(["consider", "not_recommended"]).toContain(band);
    expect(echo.score).toBeLessThan(70);
  });

  it("records why the keyword-only CV was capped", () => {
    expect(echo.evidence_substance.verdict).toBe("keyword_echo");
    expect(echo.applied_caps.length).toBeGreaterThan(0);
    // The reason reaches the reader in plain language, whichever cap binds hardest.
    expect(
      echo.concerns.some((c) => c.toLowerCase().includes("keyword list")),
    ).toBe(true);
  });

  it("never presents keyword echo as fully evidenced must-haves", () => {
    expect(echo.requirement_assessment.every((a) => a.status !== "met")).toBe(true);
    expect(echo.requirement_assessment.every((a) => a.needs_validation)).toBe(true);
  });

  it("does not report high completeness for a keyword list", () => {
    expect(echo.overall_confidence).toBeLessThan(0.5);
  });

  it("ranks the detailed CV above the keyword list", () => {
    expect(real.score).toBeGreaterThan(echo.score);
    expect(real.evidence_substance.verdict).toBe("substantive");
    expect(real.requirement_assessment.every((a) => a.status === "met")).toBe(true);
  });
});
