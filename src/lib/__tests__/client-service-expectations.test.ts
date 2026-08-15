import { describe, expect, it } from "vitest";
import {
  buildServiceExpectations,
  type StoredRoleCommitment,
} from "../client-service-expectations";
import {
  COMMITMENT_LABEL,
  NOTHING_DUE_YET,
  rollupCommitments,
  type CommitmentKey,
} from "@/lib/commitments/canonical";
import type { RoleSla, SlaMetric } from "@/lib/sla";

const commitment = (over: Partial<StoredRoleCommitment> = {}): StoredRoleCommitment => ({
  positionId: "p1",
  firstShortlistDays: 10,
  shortlistSize: 5,
  interviewSlotsHours: 24,
  ...over,
});

const metric = (key: CommitmentKey, over: Partial<SlaMetric> = {}): SlaMetric =>
  ({
    key,
    label: COMMITMENT_LABEL[key],
    promise: "promise",
    state: "met",
    detail: "detail",
    varianceValue: -2,
    varianceUnit: key === "interview_slots" ? "hours" : "days",
    ...over,
  }) as SlaMetric;

const role = (metrics: SlaMetric[], id = "p1"): RoleSla =>
  ({
    positionId: id,
    title: "Role",
    metrics,
  }) as RoleSla;

describe("buildServiceExpectations", () => {
  it("says the plan is being set up when nothing is stored", () => {
    const out = buildServiceExpectations({ plan: null, commitments: [] });
    expect(out.hasPlan).toBe(false);
    expect(out.rows).toEqual([]);
  });

  it("uses the canonical commitment names and targets", () => {
    const out = buildServiceExpectations({ plan: null, commitments: [commitment()] });
    expect(out.rows.map((r) => r.key)).toEqual([
      "first_candidate",
      "full_shortlist",
      "interview_slots",
    ]);
    expect(out.rows.find((r) => r.key === "first_candidate")!.commitment).toBe(
      COMMITMENT_LABEL.first_candidate,
    );
    expect(out.rows.find((r) => r.key === "full_shortlist")!.commitment).toBe("Shortlist of 5");
    // Hours stay hours — never softened into "1 working day".
    expect(out.rows.find((r) => r.key === "interview_slots")!.promised).toBe(
      "Interview slots within 24h of a request",
    );
  });

  it("states a range when the account's roles carry different terms", () => {
    const out = buildServiceExpectations({
      plan: null,
      commitments: [commitment(), commitment({ positionId: "p2", firstShortlistDays: 14 })],
    });
    expect(out.rows.find((r) => r.key === "first_candidate")!.promised).toContain("10–14");
  });

  it("reports the measured result from the shared rollup, even from one role", () => {
    const measured = rollupCommitments([
      role([metric("first_candidate", { state: "met", varianceValue: -5 })]),
    ]);
    const out = buildServiceExpectations({ plan: null, commitments: [commitment()], measured });
    const first = out.rows.find((r) => r.key === "first_candidate")!;
    expect(first.performance).toContain("Met on 1 of 1 role");
    expect(first.sampleNote).toContain("1 role");
  });

  it("explains why a commitment has no figure yet instead of going silent", () => {
    const measured = rollupCommitments([role([metric("interview_slots", { state: "pending" })])]);
    const out = buildServiceExpectations({ plan: null, commitments: [commitment()], measured });
    expect(out.rows.find((r) => r.key === "interview_slots")!.performance).toBeNull();
    expect(out.rows.find((r) => r.key === "interview_slots")!.sampleNote).toBe(NOTHING_DUE_YET);
  });

  it("reports included roles and term from the stored plan", () => {
    const out = buildServiceExpectations({
      plan: {
        label: "Multi Position",
        rolesTotal: 5,
        rolesUsed: 2,
        source: "package",
        expiresAt: "2026-09-01T00:00:00.000Z",
      },
      commitments: [],
    });
    expect(out.planLabel).toBe("Multi Position");
    expect(out.rows.find((r) => r.key === "included_roles")!.promised).toBe("5 roles included");
    expect(out.rows.find((r) => r.key === "included_roles")!.performance).toBe("2 of 5 used so far");
    expect(out.rows.find((r) => r.key === "plan_term")!.commitment).toBe("Allowance valid until");
  });

  it("describes a subscription allowance as concurrent, not cumulative", () => {
    const out = buildServiceExpectations({
      plan: { label: "Bronze", rolesTotal: 3, rolesUsed: 1, source: "subscription", expiresAt: null },
      commitments: [],
    });
    expect(out.rows.find((r) => r.key === "included_roles")!.promised).toBe(
      "Up to 3 active roles at a time",
    );
  });
});

describe("commitment wording is shared with the Overview scorecard", () => {
  it("names every commitment identically on both surfaces", () => {
    const rollup = rollupCommitments([
      role([metric("first_candidate"), metric("full_shortlist"), metric("interview_slots")]),
    ]);
    const out = buildServiceExpectations({
      plan: null,
      commitments: [commitment()],
      measured: rollup,
    });
    for (const key of ["first_candidate", "interview_slots"] as CommitmentKey[]) {
      expect(out.rows.find((r) => r.key === key)!.commitment).toBe(COMMITMENT_LABEL[key]);
    }
  });
});
