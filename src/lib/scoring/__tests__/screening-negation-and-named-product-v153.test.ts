/**
 * v1.5.3 — two guards that were declared and never reached the case they name.
 *
 * Both fixtures below are the literal sentences from the 1 Sep audit, which
 * found them on one candidate record (5afc1b56) scored under v1.5.2.
 *
 * F3. engine-version.ts states under v1.5.1 that self-deprecating qualifiers —
 * naming "less experienced with" explicitly — join the negation cues. The cue
 * list contained the phrase and the window logic was correct. Neither was ever
 * asked about SCREENING ANSWERS: isNegatedMention ran on the CV path only, and
 * a term found in an answer was pushed straight into `matched`. Screening
 * answers are where a candidate is most likely to qualify a claim, so this was
 * the corpus that needed it most. The audit notes the same candidate and quote
 * were flagged in audit #5, two engine releases ago.
 *
 * F4. The named-product gate demoted MET to partial when no named product
 * appeared, and left an existing PARTIAL alone — so a requirement that never
 * reached met sailed through. "Experience with Lovable" came back Partial on
 * the framing words "application" and "development", quoting MongoDB, Express
 * and Jenkins.
 */
import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";

const SUPABASE_ANSWER =
  "I've worked with SQL/NoSQL, REST APIs, OAuth 2.0, authentication and " +
  "integrations. I'm less experienced with React/Supabase but comfortable " +
  "learning new stacks.";

/** Long enough that cvIsThin does not fire and statuses are decisive. */
const SUBSTANTIAL_CV = [
  "Full-Stack Engineer with eight years building production web applications.",
  "Gateway. Full-Stack E-commerce JavaScript Node.js Express MongoDB.",
  "Application featuring a dynamic product catalog, search and sorting, and a",
  "REST API for order management. Continuous integration with Jenkins.",
  "Led development of internal tooling and mentored two junior engineers.",
  "Worked across authentication, integrations and relational data modelling.",
].join(" ");

function assess(requirementText: string, opts: { cv?: string; answer?: string } = {}) {
  const result = scoreCandidate({
    cv_text: opts.cv ?? SUBSTANTIAL_CV,
    // Keywords left empty so the engine extracts them from the text, which is
    // what production does and what makes the framing-word case reproducible.
    requirements: [{ id: "r1", text: requirementText, required: true, keywords: [] }],
    screening: opts.answer
      ? [
          {
            question_id: "q1",
            question: "Tell us about your stack",
            required: false,
            answer_type: "text",
            value: opts.answer,
          },
        ]
      : [],
  });
  return result.requirement_assessment[0]!;
}

describe("F3 — a qualifier in a screening answer is not evidence", () => {
  it("does not credit Supabase from 'I'm less experienced with React/Supabase'", () => {
    const row = assess("Experience with Supabase", { answer: SUPABASE_ANSWER });
    expect(row.status).not.toBe("met");
  });

  it("still credits a plain affirmative answer", () => {
    const row = assess("Experience with Supabase", {
      answer: "I have used Supabase in production for auth and row-level security.",
    });
    expect(row.status).toBe("met");
  });

  it("does not credit an outright denial in an answer", () => {
    const row = assess("Experience with Kubernetes", {
      answer: "I have no experience with Kubernetes.",
    });
    expect(row.status).not.toBe("met");
  });

  it("respects the contrastive pivot, as the CV path does", () => {
    // "no experience with Kubernetes, but deep Docker work" — the negation
    // must not reach Docker.
    const row = assess("Experience with Docker", {
      answer: "No experience with Kubernetes, but deep Docker work in production.",
    });
    expect(row.status).toBe("met");
  });
});

describe("F4 — a named product must actually appear", () => {
  const LOVABLE = "Experience with Lovable for rapid website and application development";

  it("does not reach partial on framing words alone", () => {
    const row = assess(LOVABLE);
    expect(row.status).not.toBe("met");
    expect(row.status).not.toBe("partial");
  });

  it("credits the requirement when the product is actually named", () => {
    const row = assess(LOVABLE, {
      cv: `${SUBSTANTIAL_CV} Built three internal tools with Lovable.`,
    });
    expect(row.status).toBe("met");
  });

  it("accepts any one of an alternatives list", () => {
    const row = assess("Experience with Cloudflare, Netlify, or Vercel", {
      cv: `${SUBSTANTIAL_CV} Deployed the marketing site on Netlify.`,
    });
    expect(row.status).toBe("met");
  });

  it("leaves requirements that name no product alone", () => {
    // The gate must not fire where there is no product to look for.
    const row = assess("Comfortable writing automated tests", {
      cv: `${SUBSTANTIAL_CV} Wrote automated tests for every service.`,
    });
    expect(["met", "partial"]).toContain(row.status);
  });
});
