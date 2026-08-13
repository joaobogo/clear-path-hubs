import { describe, it, expect } from "vitest";
import { deriveCardAssessment, dropRequirementEcho } from "./card-assessment-state";

const stale = { state: "stale" as const, reasons: [{ label: "The role brief changed after this was assessed." }] };

describe("deriveCardAssessment", () => {
  it("is settled when a band has evidence, even if inputs moved", () => {
    const a = deriveCardAssessment({
      fitLabel: "strong",
      evidenceBullets: 3,
      support: { supported: 4, total: 6 },
      freshness: stale,
    });
    expect(a.state).toBe("settled");
    expect(a.note).toBe("4 of 6 of your requirements evidenced");
  });

  it("marks a thin write-up without hiding it", () => {
    const a = deriveCardAssessment({ fitLabel: "possible", evidenceBullets: 1 });
    expect(a).toMatchObject({ state: "settled", thin: true });
  });

  it("only re-checks when there is a recorded reason and no write-up", () => {
    expect(deriveCardAssessment({ fitLabel: "strong", evidenceBullets: 0, freshness: stale }).state).toBe(
      "rechecking",
    );
    expect(
      deriveCardAssessment({
        fitLabel: "strong",
        evidenceBullets: 0,
        freshness: { state: "stale", reasons: [] },
      }).state,
    ).toBe("pending");
  });

  it("is pending with no band", () => {
    expect(deriveCardAssessment({ evidenceBullets: 0 }).state).toBe("pending");
  });

  it("shows 0 of N evidenced instead of a mapping message when the band is present but no bullets are written", () => {
    const a = deriveCardAssessment({
      fitLabel: "strong",
      score: 88,
      evidenceBullets: 0,
      support: { supported: 0, total: 6 },
    });
    expect(a.state).toBe("settled");
    expect(a.state === "settled" && a.thin).toBe(true);
    expect(a.state === "settled" && a.note).toBe("0 of 6 of your requirements evidenced");
  });

  it("still re-checks stale candidates without evidence even when support is provided", () => {
    const a = deriveCardAssessment({
      fitLabel: "strong",
      evidenceBullets: 0,
      support: { supported: 0, total: 6 },
      freshness: stale,
    });
    expect(a.state).toBe("rechecking");
  });
});

describe("dropRequirementEcho", () => {
  it("removes a leading restatement of the requirement", () => {
    expect(dropRequirementEcho("Strong SQL", "Strong SQL — five years on Postgres at scale")).toBe(
      "Five years on Postgres at scale",
    );
    expect(dropRequirementEcho("Team leadership", "Team leadership: led a team of nine")).toBe(
      "Led a team of nine",
    );
  });

  it("leaves distinct proof untouched", () => {
    expect(dropRequirementEcho("Strong SQL", "Wrote the reporting warehouse in Postgres")).toBe(
      "Wrote the reporting warehouse in Postgres",
    );
  });
});

describe("dropRequirementEcho — full echo", () => {
  it("returns empty when the text is only the requirement", () => {
    expect(dropRequirementEcho("Strong SQL", "Strong SQL")).toBe("");
    expect(dropRequirementEcho("Strong SQL", "Strong SQL…")).toBe("");
  });
});
