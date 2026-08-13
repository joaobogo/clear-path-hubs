import { describe, expect, it } from "vitest";
import { buildShortlistRationale, type RationaleLine } from "./client-rationale";
import type { RequirementRow } from "./client-fit-presentation";

function requirementRow(over: Partial<RequirementRow> = {}): RequirementRow {
  return {
    id: over.id ?? "r1",
    label: over.label ?? "Strong SQL",
    importance: over.importance ?? "must_have",
    status: over.status ?? "met",
    explanation: over.explanation ?? null,
    evidence: over.evidence ?? [],
    ...over,
  };
}

function evidenceSnippet(snippet: string, source = "cv") {
  return { snippet, source, confidence: 0.8 };
}

describe("buildShortlistRationale", () => {
  it("renders a normal claim as evidence", () => {
    const r = buildShortlistRationale({
      requirement_rows: [
        requirementRow({ evidence: [evidenceSnippet("Five years on Postgres at scale")] }),
      ],
      screening_answers: [],
      evidence: [],
    });
    expect(r.lines[0]!.claim).toBe("Five years on Postgres at scale");
    expect(r.lines[0]!.underReview).toBe(false);
  });

  it("marks a claim that only repeats the requirement as under review", () => {
    const r = buildShortlistRationale({
      requirement_rows: [
        requirementRow({ evidence: [evidenceSnippet("Strong SQL")] }),
        requirementRow({
          id: "r2",
          label: "Team leadership",
          evidence: [evidenceSnippet("team leadership")],
        }),
      ],
      screening_answers: [],
      evidence: [],
    });
    expect(r.lines[0]!.claim).toBeNull();
    expect(r.lines[0]!.underReview).toBe(true);
    expect(r.lines[1]!.claim).toBeNull();
    expect(r.lines[1]!.underReview).toBe(true);
  });

  it("treats an empty claim as a gap, not under review", () => {
    const r = buildShortlistRationale({
      requirement_rows: [requirementRow({ status: "not_evidenced", evidence: [] })],
      screening_answers: [],
      evidence: [],
    });
    expect(r.lines[0]!.claim).toBeNull();
    expect(r.lines[0]!.underReview).toBe(false);
    expect(r.lines[0]!.verdict).toBe("gap");
  });

  it("keeps a claim that is longer than the requirement, even if it starts with it", () => {
    const r = buildShortlistRationale({
      requirement_rows: [
        requirementRow({
          evidence: [evidenceSnippet("Strong SQL: built a reporting warehouse in Postgres")],
        }),
      ],
      screening_answers: [],
      evidence: [],
    });
    expect(r.lines[0]!.claim).toBe("Strong SQL: built a reporting warehouse in Postgres");
    expect(r.lines[0]!.underReview).toBe(false);
  });

  it("keeps run-level evidence when it is not an echo", () => {
    const r = buildShortlistRationale({
      requirement_rows: [requirementRow({ evidence: [], status: "met" })],
      screening_answers: [],
      evidence: [{ label: "Strong SQL", snippet: "Five years on Postgres at scale" }],
    });
    expect(r.lines[0]!.claim).toBe("Five years on Postgres at scale");
    expect(r.lines[0]!.underReview).toBe(false);
  });

  it("marks run-level evidence as under review when it repeats the requirement", () => {
    const r = buildShortlistRationale({
      requirement_rows: [requirementRow({ evidence: [], status: "met" })],
      screening_answers: [],
      evidence: [{ label: "Strong SQL", snippet: "Strong SQL" }],
    });
    expect(r.lines[0]!.claim).toBeNull();
    expect(r.lines[0]!.underReview).toBe(true);
  });
});

describe("buildShortlistRationale summary", () => {
  it("counts under-review lines as not evidenced", () => {
    const r = buildShortlistRationale({
      requirement_rows: [
        requirementRow({ evidence: [evidenceSnippet("Strong SQL")] }),
        requirementRow({
          id: "r2",
          label: "Team leadership",
          evidence: [evidenceSnippet("Led a team of nine")],
        }),
      ],
      screening_answers: [],
      evidence: [],
    });
    expect(r.summary).toBe("1 of 2 of your requirements evidenced");
    expect(r.gaps).toHaveLength(0);
  });
});
