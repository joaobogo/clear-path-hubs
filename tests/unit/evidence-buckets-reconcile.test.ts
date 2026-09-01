/**
 * "With verified quotes" means the quote settled the requirement.
 *
 * The evidence record header carried three percentages measuring three
 * different things — "data completeness 97%", "evidence coverage 88%", and
 * "3 of 7 must-have criteria fully evidenced" (43%). The naming was fixed
 * first. This is the arithmetic underneath it (audit 1 Sep, F24).
 *
 * 88% was 7 of 8, and the numerator counted having a passage attached, not
 * being settled by it. So "Experience with Lovable for rapid website and
 * application development" — which the named-product gate marks missing
 * because the word Lovable appears nowhere, and whose attached passages quote
 * MongoDB, Express and Jenkins — counted as verified. It was counted in
 * `missing` at the same time, so 7 + 1 = 8 reconciled by double-counting the
 * one row that was wrong.
 *
 * The passages stay visible. They are reported as what they are.
 */
import { describe, expect, it } from "vitest";
import { buildEvidenceChain } from "@/lib/evidence/evidence-graph";

const quote = (text: string) => ({ source: "cv", location: "cv:100-200", snippet: text });

/** A requirement the run settled, with a passage behind it. */
const SETTLED = {
  requirement_text: "Experience with React",
  required: true,
  status: "met",
  evidence: [quote("Built three production React applications.")],
};

/**
 * The reported case: passages attached, status missing because none of them
 * mentions the product the requirement names.
 */
const QUOTED_NOT_SETTLED = {
  requirement_text: "Experience with Lovable for rapid website and application development",
  required: false,
  status: "missing",
  evidence: [quote("Deployed MongoDB, Express and Jenkins across the stack.")],
};

/** Nothing attached at all. */
const NOTHING = {
  requirement_text: "Experience with Terraform",
  required: false,
  status: "missing",
  evidence: [],
};

function metaFor(assessment: unknown[]) {
  return buildEvidenceChain({ assessment: assessment as never[] }).meta;
}

describe("evidence buckets", () => {
  it("does not count an unsettled requirement as verified", () => {
    const meta = metaFor([SETTLED, QUOTED_NOT_SETTLED]);
    expect(meta.verified).toBe(1);
    expect(meta.quotedNotSettled).toBe(1);
  });

  it("does not count one requirement in two buckets", () => {
    // The double count is what made the old arithmetic look sound.
    const meta = metaFor([SETTLED, QUOTED_NOT_SETTLED, NOTHING]);
    expect(meta.verified + meta.quotedNotSettled + meta.missing).toBe(meta.total);
  });

  it("still counts a partial as verified — the quote did settle it", () => {
    const meta = metaFor([{ ...SETTLED, status: "partial" }]);
    expect(meta.verified).toBe(1);
    expect(meta.quotedNotSettled).toBe(0);
  });

  it("reports nothing-attached as missing, not as unsettled", () => {
    const meta = metaFor([NOTHING]);
    expect(meta.missing).toBe(1);
    expect(meta.quotedNotSettled).toBe(0);
    expect(meta.verified).toBe(0);
  });

  it("keeps the passages so a reviewer can still read them", () => {
    // Reporting the row honestly must not hide the evidence behind it.
    const { nodes } = buildEvidenceChain({ assessment: [QUOTED_NOT_SETTLED] as never[] });
    expect(nodes[0]!.sources.length).toBeGreaterThan(0);
  });
});
