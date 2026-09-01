/**
 * A candidate who walks back their own claim is heard, whichever field they
 * typed it into.
 *
 * v1.5.3 added the negation test to the screening path — but only inside the
 * `hits.length === 0` branch, the fallback for "the CV had nothing". So the
 * guard reached the candidate whose CV was silent about Supabase and missed
 * the one whose CV lists it and whose screening answer then says "I'm less
 * experienced with React/Supabase". That is the more common of the two shapes,
 * and it produced the same clean Met: the qualifying sentence was never read.
 *
 * Audit 1 Sep rev 16 traced what that one false Met props up on candidate
 * 5afc1b56 — the Score tab's headline "Preferred coverage 100%" and a named
 * STRENGTH, "Demonstrated: Experience with Supabase", on the role's only
 * preferred requirement. Both rested entirely on a sentence in which the
 * candidate says they are less experienced with it.
 *
 * This is the fourth time one fix has been applied to one branch while a
 * sibling branch kept the old behaviour, so the test is written against the
 * property rather than the branch: a qualifying statement anywhere in the
 * record caps the row and asks for a human.
 */
import { describe, expect, it } from "vitest";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";

const REQUIREMENT = [
  { id: "r1", text: "Experience with Supabase", required: false, keywords: ["supabase"] },
];

/** Long enough that the engine does not treat the CV as too thin to judge. */
const CV_WITH_SUPABASE = `
Senior engineer with eight years building production web applications for
teams in Brazil and Portugal. Built and shipped a multi-tenant billing
platform used by 40 companies. Led the migration of a legacy PHP monolith to
a TypeScript service. Worked with Postgres, Supabase and Redis across several
projects. Comfortable owning a feature from design through to release, and
happy mentoring less experienced teammates on code review.
`.trim();

const answer = (text: string): ScreeningAnswer => ({
  question_id: "q1",
  question: "Tell us about your stack.",
  required: false,
  answer_type: "text",
  value: text,
});

const QUALIFYING_ANSWER = [
  answer("I'm less experienced with React/Supabase, but I pick things up quickly."),
];

function assess(cv: string, screening: ScreeningAnswer[]) {
  return scoreCandidate({ cv_text: cv, requirements: REQUIREMENT, screening })
    .requirement_assessment[0]!;
}

describe("a qualifying screening answer reaches a requirement the CV also matched", () => {
  it("does not report Met when the candidate qualified the claim in a screening answer", () => {
    const row = assess(CV_WITH_SUPABASE, QUALIFYING_ANSWER);
    expect(row.status).not.toBe("met");
    expect(row.needs_validation).toBe(true);
  });

  it("still reports Met when nothing in the record qualifies it", () => {
    // The guard must not fire on every candidate — that would be its own defect.
    const row = assess(CV_WITH_SUPABASE, [
      answer("I used Supabase for auth and row-level security on two products."),
    ]);
    expect(row.status).toBe("met");
  });

  it("still reports Met with no screening answers at all", () => {
    expect(assess(CV_WITH_SUPABASE, []).status).toBe("met");
  });

  it("keeps the qualifying passage so a reviewer can see what was read", () => {
    const row = assess(CV_WITH_SUPABASE, QUALIFYING_ANSWER);
    const quotes = row.evidence ?? [];
    expect(quotes.some((e) => /less experienced/i.test(e.snippet))).toBe(true);
  });

  it("holds for the branch the earlier fix covered, so neither regresses", () => {
    // CV silent about Supabase, screening answer qualifies it: v1.5.3's case.
    const silentCv = CV_WITH_SUPABASE.replace("Supabase and ", "");
    expect(assess(silentCv, QUALIFYING_ANSWER).status).not.toBe("met");
  });
});
