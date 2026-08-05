import { describe, expect, it } from "vitest";
import {
  buildPreviouslyConsidered,
  consentExpired,
  isBlockedByEarlierDecision,
  mustHaveOverlap,
  type ConsideredInput,
} from "./client-previously-considered";

const NOW = new Date("2026-03-10T12:00:00Z");

const BRIEF = [
  { kind: "must_have", label: "Graphic design experience" },
  { kind: "must_have", label: "LinkedIn content management" },
  { kind: "skill", label: "Adobe" },
];

function row(over: Partial<ConsideredInput> = {}): ConsideredInput {
  return {
    candidate_profile_id: "c1",
    candidate_name: "Ana Silva",
    headline: "Social media manager",
    prior_position_id: "p0",
    prior_position_title: "Content Designer",
    prior_requirements: [
      { kind: "must_have", label: "graphic  design experience" },
      { kind: "must_have", label: "Video editing" },
    ],
    decision: "hold",
    reason_code: "comparing_candidates",
    reason_label: "Comparing against other candidates",
    decided_at: "2026-01-10T09:00:00Z",
    consent_expires_at: null,
    ...over,
  };
}

describe("mustHaveOverlap", () => {
  it("matches on normalised labels and ignores non-must-haves", () => {
    expect(mustHaveOverlap(BRIEF, row().prior_requirements)).toEqual([
      "graphic  design experience",
    ]);
  });
});

describe("isBlockedByEarlierDecision", () => {
  it("never blocks a hold", () => {
    expect(isBlockedByEarlierDecision({ decision: "hold", reason_code: "other" }, BRIEF)).toBe(false);
  });

  it("blocks a must-have gap decline when the brief still has must-haves", () => {
    expect(
      isBlockedByEarlierDecision(
        { decision: "not_moving_forward", reason_code: "missing_critical" },
        BRIEF,
      ),
    ).toBe(true);
  });

  it("allows circumstance declines", () => {
    expect(
      isBlockedByEarlierDecision(
        { decision: "not_moving_forward", reason_code: "role_filled_or_paused" },
        BRIEF,
      ),
    ).toBe(false);
  });
});

describe("consentExpired", () => {
  it("treats a past expiry as expired and a missing one as unrecorded", () => {
    expect(consentExpired("2026-01-01T00:00:00Z", NOW)).toBe(true);
    expect(consentExpired(null, NOW)).toBe(false);
    expect(consentExpired("2027-01-01T00:00:00Z", NOW)).toBe(false);
  });
});

describe("buildPreviouslyConsidered", () => {
  it("keeps revisitable rows with overlap and states why", () => {
    const out = buildPreviouslyConsidered(BRIEF, [row()], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]!.overlap_count).toBe(1);
    expect(out[0]!.decision_label).toBe("You put them on hold");
    expect(out[0]!.suggested_because).toContain("shares 1 must-have");
    expect(out[0]!.when_label).toContain("months ago");
  });

  it("drops expired consent, must-have gaps and zero overlap", () => {
    const out = buildPreviouslyConsidered(
      BRIEF,
      [
        row({ candidate_profile_id: "a", consent_expires_at: "2026-02-01T00:00:00Z" }),
        row({
          candidate_profile_id: "b",
          decision: "not_moving_forward",
          reason_code: "missing_critical",
        }),
        row({
          candidate_profile_id: "d",
          prior_requirements: [{ kind: "must_have", label: "Warehouse operations" }],
        }),
      ],
      NOW,
    );
    expect(out).toHaveLength(0);
  });

  it("keeps one row per candidate, the most recent decision", () => {
    const out = buildPreviouslyConsidered(
      BRIEF,
      [
        row({ decided_at: "2025-06-01T09:00:00Z", prior_position_title: "Old role" }),
        row({ decided_at: "2026-02-01T09:00:00Z", prior_position_title: "Newer role" }),
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.prior_position_title).toBe("Newer role");
  });

  it("orders by overlap, then recency", () => {
    const out = buildPreviouslyConsidered(
      BRIEF,
      [
        row({ candidate_profile_id: "one" }),
        row({
          candidate_profile_id: "two",
          prior_requirements: [
            { kind: "must_have", label: "Graphic design experience" },
            { kind: "must_have", label: "LinkedIn content management" },
          ],
        }),
      ],
      NOW,
    );
    expect(out.map((r) => r.candidate_profile_id)).toEqual(["two", "one"]);
  });
});
