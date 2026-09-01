/**
 * The observed case, and the false alarms that would make this guard useless.
 *
 * Position bf2a3410 advertised R$3,500–R$5,000 on three surfaces while its
 * screening question asked candidates to confirm alignment with
 * R$3,500–R$4,500 — a ceiling R$500 below the one they were recruited on. The
 * answer is stored and fed into scoring, so the record shows a candidate
 * agreeing to terms that were never the terms (audit 1 Sep, F14).
 */
import { describe, expect, it } from "vitest";
import { payFiguresIn, screeningPayDrift } from "@/lib/jobs/screening-pay-drift";

const QUESTION =
  "This role is offered as a PJ (Pessoa Jurídica - independent contractor) in " +
  "Brazil, with a monthly compensation range of R$3,500–R$4,500. Does this " +
  "compensation structure and location align with your expectations?";

describe("payFiguresIn", () => {
  it("reads both thousands separators this product stores", () => {
    expect(payFiguresIn("R$3,500 to R$5,000")).toEqual([3500, 5000]);
    expect(payFiguresIn("R$4.500 por mês")).toEqual([4500]);
  });

  it("reads a bare four-digit figure", () => {
    expect(payFiguresIn("between 3500 and 5000 monthly")).toEqual([3500, 5000]);
  });

  it("ignores percentages and small numbers", () => {
    expect(payFiguresIn("at least 5 years, 20% bonus, 3 days on site")).toEqual([]);
  });
});

describe("the drift the audit found", () => {
  it("flags a question ceiling below the advertised one", () => {
    const drift = screeningPayDrift(QUESTION, { min: 3500, max: 5000 });
    expect(drift).not.toBeNull();
    expect(drift!.unexpected).toContain(4500);
    expect(drift!.message).toMatch(/3500–5000|3500-5000/);
  });

  it("says nothing once the question matches the record", () => {
    const fixed = QUESTION.replace("R$4,500", "R$5,000");
    expect(screeningPayDrift(fixed, { min: 3500, max: 5000 })).toBeNull();
  });

  it("flags a figure above the range too", () => {
    const drift = screeningPayDrift("Range of R$3,500–R$6,000", { min: 3500, max: 5000 });
    expect(drift!.unexpected).toContain(6000);
  });
});

describe("does not cry wolf", () => {
  it("stays silent when the question quotes no money", () => {
    expect(
      screeningPayDrift("Are you fluent in professional English?", { min: 3500, max: 5000 }),
    ).toBeNull();
  });

  it("stays silent when the role has no recorded range", () => {
    // Nothing to compare against — a guess about pay is worse than silence.
    expect(screeningPayDrift(QUESTION, null)).toBeNull();
    expect(screeningPayDrift(QUESTION, { min: null, max: null })).toBeNull();
  });

  it("accepts a figure quoted inside the range", () => {
    // "starting at R$4,000" against a 3,500–5,000 range is not drift, as long
    // as it is not presented as the ceiling.
    expect(
      screeningPayDrift("Starting at R$4,000, rising to R$5,000", { min: 3500, max: 5000 }),
    ).toBeNull();
  });

  it("does not flag years of experience or team sizes", () => {
    expect(
      screeningPayDrift("Do you have 5 years of experience leading a team of 12?", {
        min: 3500,
        max: 5000,
      }),
    ).toBeNull();
  });
});
