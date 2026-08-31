import { describe, it, expect } from "vitest";
import { phraseInterviewQuestion } from "@/lib/client/interview-question-phrasing";

/**
 * Every question a client reads has to be a sentence. These cases are the
 * requirement-label shapes that actually appear on real roles.
 */
describe("phraseInterviewQuestion", () => {
  it("keeps an experience-prefixed label in the possessive frame", () => {
    expect(phraseInterviewQuestion("Experience owning features end to end")).toBe(
      "Tell me about your experience owning features end to end.",
    );
  });

  it("uses the ability frame for 'Able to ...'", () => {
    expect(phraseInterviewQuestion("Able to work across the stack")).toBe(
      "Tell me about how you have shown the ability to work across the stack.",
    );
  });

  it("uses the past frame for an adjective start", () => {
    expect(phraseInterviewQuestion("Comfortable with ambiguity")).toBe(
      "Tell me about a time you were comfortable with ambiguity.",
    );
  });

  // audit #4, L8 — "Worked on ..." matched no frame and came out as
  // "Tell me about worked on multi-tenant SaaS ...".
  describe("past-tense verb starts (audit #4, L8)", () => {
    it("puts a subject in front of the verb", () => {
      expect(
        phraseInterviewQuestion("Worked on multi-tenant SaaS with per-tenant data isolation"),
      ).toBe(
        "Tell me about when you worked on multi-tenant SaaS with per-tenant data isolation.",
      );
    });

    it("handles irregular past forms", () => {
      expect(phraseInterviewQuestion("Led a team of five engineers")).toBe(
        "Tell me about when you led a team of five engineers.",
      );
      expect(phraseInterviewQuestion("Built and shipped a payments platform")).toBe(
        "Tell me about when you built and shipped a payments platform.",
      );
    });

    it("does not mistake an -ed adjective for a past-tense verb", () => {
      // These must stay in the noun frame — "Tell me about when you advanced
      // SQL and query optimisation" is not English.
      expect(phraseInterviewQuestion("Advanced SQL and query optimisation")).toBe(
        "Can you walk me through your experience with advanced SQL and query optimisation?",
      );
      expect(phraseInterviewQuestion("Distributed systems at scale")).toBe(
        "Can you walk me through your experience with distributed systems at scale?",
      );
    });
  });

  it("uses the noun frame for a long verbless phrase", () => {
    // Previously capped at six words, which pushed longer noun phrases into
    // the "Tell me about ..." frame and broke the grammar.
    //
    // The framing noun ("Strong knowledge of") is now stripped as well, so the
    // subject leads: "…experience with strong knowledge of relational
    // databases" was grammatical but wordy, and the reader is being asked
    // about the databases, not about their knowledge of them.
    expect(
      phraseInterviewQuestion("Strong knowledge of relational databases and data modelling"),
    ).toBe(
      "Can you walk me through your experience with relational databases and data modelling?",
    );
  });

  it("never returns a bare fragment for an empty label", () => {
    expect(phraseInterviewQuestion("")).toBe("Tell me about your relevant experience.");
  });

  /**
   * audit #6, 2.9j — real questions from a published client guide:
   * "Tell me about a time you were Fluent professional English speaking and
   * communication skills." and "Tell me about understanding of practical web
   * security fundamentals."
   */
  describe("noun phrases never take a verb or adjective frame", () => {
    it("an attributive adjective does not become 'a time you were'", () => {
      expect(
        phraseInterviewQuestion("Fluent professional English speaking and communication skills"),
      ).toBe(
        "Can you walk me through your experience with fluent professional English speaking and communication skills?",
      );
    });

    it("strips a framing noun so the subject leads", () => {
      expect(phraseInterviewQuestion("Understanding of practical web security fundamentals")).toBe(
        "Can you walk me through your experience with practical web security fundamentals?",
      );
      expect(phraseInterviewQuestion("Understanding of good UX/UI principles")).toBe(
        "Can you walk me through your experience with good UX/UI principles?",
      );
      expect(phraseInterviewQuestion("Solid knowledge of relational databases")).toBe(
        "Can you walk me through your experience with relational databases?",
      );
    });

    // audit #7, TF7-08 — "Tell me about a time you were comfortable using AI
    // tools as part of the development workflow." The adjective is fine; the
    // activity that follows it is what breaks the frame.
    it("drops the state frame when the phrase continues into an activity", () => {
      expect(
        phraseInterviewQuestion("Comfortable using AI tools as part of the development workflow"),
      ).toBe(
        "Can you walk me through your experience using AI tools as part of the development workflow?",
      );
    });

    it("still lets a predicative adjective take the past frame", () => {
      // "Comfortable with ambiguity" IS a state, not a noun phrase.
      expect(phraseInterviewQuestion("Comfortable with ambiguity")).toBe(
        "Tell me about a time you were comfortable with ambiguity.",
      );
    });

    it("leaves the ability frame alone", () => {
      expect(phraseInterviewQuestion("Ability to work across the stack")).toBe(
        "Tell me about how you have shown the ability to work across the stack.",
      );
    });
  });

  it("drops job-ad framing that belongs to the advert", () => {
    expect(phraseInterviewQuestion("Must have 5+ years of Python")).toBe(
      "Can you walk me through your experience with 5+ years of Python?",
    );
    expect(phraseInterviewQuestion("Nice to have Kubernetes exposure")).toBe(
      "Can you walk me through your experience with Kubernetes exposure?",
    );
  });

  it("preserves acronyms and proper nouns", () => {
    expect(phraseInterviewQuestion("SQL performance tuning")).toBe(
      "Can you walk me through your experience with SQL performance tuning?",
    );
  });
});
