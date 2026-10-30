import { describe, expect, it } from "vitest";
import { buildRequirementRows } from "../client-fit-presentation";

/**
 * A requirement a person verified is shown as that person decided it. Before
 * this, a verified "not evidenced" row could read "Partially met" on the client
 * page when an unrelated passage from another requirement shared a keyword.
 */
const position = {
  requirements: [
    { label: "Hands-on marketing experience in Japan" },
    { label: "10 or more years of progressive marketing experience" },
  ],
  preferred_requirements: [{ label: "MBA or professional marketing qualification" }],
};

function coverage(opts: { humanVerified: boolean }) {
  const market = {
    id: "req-0",
    text: "Hands-on marketing experience in Japan",
    required: true,
    status: "missing",
    evidence: [],
    ...(opts.humanVerified
      ? { human_verified: true, human_verdict: "not_met", human_reason: "No Japan work on the CV." }
      : {}),
  };
  const mba = {
    id: "pref-0",
    text: "MBA or professional marketing qualification",
    required: false,
    status: "missing",
    evidence: [],
    ...(opts.humanVerified
      ? { human_verified: true, human_verdict: "not_met", human_reason: "Bachelor only." }
      : {}),
  };
  return {
    requirement_assessment: [
      market,
      {
        id: "req-1",
        text: "10 or more years of progressive marketing experience",
        required: true,
        status: "met",
        evidence: [
          {
            source: "cv",
            snippet:
              "Fifteen years of progressive marketing experience in Japan and Dubai, with an executive marketing qualification.",
            requirement_id: "req-1",
          },
        ],
      },
      mba,
    ],
  };
}

function items(cov: ReturnType<typeof coverage>) {
  return cov.requirement_assessment.flatMap((req) =>
    (req.evidence ?? []).map((e) => ({
      requirement_id: req.id,
      requirement: req.text,
      label: req.text,
      snippet: e.snippet,
      source: e.source,
      result: req.status,
    })),
  );
}

describe("client requirement rows honour a verified verdict", () => {
  it("rescues a keyword match for a machine row that has no quote", () => {
    const cov = coverage({ humanVerified: false });
    const rows = buildRequirementRows(position, cov, items(cov));
    expect(rows[0]!.status).toBe("partial");
    expect(rows[2]!.status).toBe("partial");
  });

  it("keeps a verified 'not evidenced' row as not evidenced, with no borrowed quote", () => {
    const cov = coverage({ humanVerified: true });
    const rows = buildRequirementRows(position, cov, items(cov));
    expect(rows[0]!.status).toBe("not_evidenced");
    expect(rows[0]!.evidence).toHaveLength(0);
    expect(rows[2]!.status).toBe("not_evidenced");
    expect(rows[1]!.status).toBe("met");
  });
});
