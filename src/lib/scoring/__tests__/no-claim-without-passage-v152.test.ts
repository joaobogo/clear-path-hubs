import { describe, expect, it } from "vitest";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { filler, reqFromText } from "@/lib/scoring/golden-corpus";

/**
 * Pins for engine v1.5.2 (audit #4, M6). Both cases are real:
 *
 *   - "Supabase · Met" was produced from the screening answer "I'm less
 *     experienced with React/Supabase", because the negation was discarded the
 *     moment the same term matched somewhere positive.
 *   - "English · Met" was shown to a client with no passage behind it at all.
 */

const assess = (cv: string, requirement: string, screening: ScreeningAnswer[] = []) =>
  scoreCandidate({
    cv_text: `${cv} ${filler}`,
    requirements: [reqFromText(requirement)],
    screening,
  }).requirement_assessment[0]!;

describe("a qualifying statement caps the row (M6)", () => {
  it("does not mark Met when the candidate disclaims the very term that matched", () => {
    const row = assess(
      "Built dashboards in React. Honestly I'm less experienced with Supabase than with Postgres, " +
        "though I have used Supabase for auth on one project.",
      "Experience with Supabase",
    );
    expect(row.status).not.toBe("met");
    expect(row.needs_validation).toBe(true);
  });

  it("leaves an unqualified positive alone", () => {
    const row = assess(
      "Used Supabase for auth, row-level security and realtime across two production products.",
      "Experience with Supabase",
    );
    expect(row.status).toBe("met");
  });
});

describe("no claim without a passage (M6)", () => {
  it("never returns met or partial with an empty evidence list", () => {
    // Whatever the CV, a verdict a client can read must come with the words it
    // came from. This is the invariant the audit found broken.
    const cvs = [
      "Fluent in English and Portuguese, with daily written communication in both.",
      "Led a team of five engineers on a multi-tenant SaaS platform.",
      "Especialização em Segurança Cibernética com foco em proteção de dados.",
      "Comfortable using AI tools to improve development workflows.",
    ];
    const requirements = [
      "Fluent English",
      "Experience leading a team",
      "Understanding of practical web security fundamentals",
      "Comfortable using AI tools",
    ];
    for (const cv of cvs) {
      for (const requirement of requirements) {
        const row = assess(cv, requirement);
        if (row.status === "met" || row.status === "partial") {
          expect(
            row.evidence.length,
            `"${requirement}" came back ${row.status} with no passage`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("a row that matched a term but captured nothing is unverified, not missing", () => {
    // "unknown" says the term is there and the passage is not — which is the
    // truth, and is what asks for a human. "missing" would be a false negative.
    const row = assess(
      "Fluent in English and Portuguese, with daily written communication in both.",
      "Fluent English",
    );
    expect(["met", "partial", "unknown"]).toContain(row.status);
    if (row.status === "unknown") expect(row.needs_validation).toBe(true);
  });
});
