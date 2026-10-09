import { describe, expect, it } from "vitest";
import {
  amountLabel,
  diffDays,
  varianceLabel,
  type RoleSla,
  type SlaMetric,
} from "@/lib/sla";
import { dayMetric, emptySummary, summarise } from "@/lib/sla-report.server";
import { COMMITMENT_LABEL, rollupCommitments } from "@/lib/commitments/canonical";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOffset(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

function actualAtOrNull(baseline: string, days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null;
  return dateOffset(baseline, days);
}

function buildRole(
  title: string,
  baseline: string,
  overrides: {
    firstCandidate?: { actualDays?: number | null };
    fullShortlist?: { actualDays?: number | null; targetSize?: number };
  } = {},
  status = "active",
): RoleSla {
  const metrics: SlaMetric[] = [];

  const firstCandidateOverride = overrides.firstCandidate ?? { actualDays: null };
  const fullShortlistOverride = overrides.fullShortlist ?? { actualDays: null, targetSize: 3 };

  // First candidate
  const firstActualDays = firstCandidateOverride.actualDays ?? null;
  metrics.push(
    dayMetric({
      key: "first_candidate",
      label: COMMITMENT_LABEL.first_candidate,
      promise: "Within 5 days of launch",
      baselineAt: baseline,
      dueAt: dateOffset(baseline, 5),
      actualAt: actualAtOrNull(baseline, firstActualDays),
      now: Date.now(),
    }),
  );

  // Full shortlist
  const targetSize = fullShortlistOverride.targetSize ?? 3;
  const fullActualDays = fullShortlistOverride.actualDays ?? null;
  const shortlistActualAt = actualAtOrNull(baseline, fullActualDays);
  const shortlistBase = dayMetric({
    key: "full_shortlist",
    label: COMMITMENT_LABEL.full_shortlist,
    promise: `${targetSize} candidates within 5 days`,
    baselineAt: baseline,
    dueAt: dateOffset(baseline, 5),
    actualAt: shortlistActualAt,
    now: Date.now(),
  });
  metrics.push({
    ...shortlistBase,
    actual:
      shortlistActualAt === null
        ? "1 of 3 so far"
        : amountLabel(diffDays(baseline, shortlistActualAt), "days"),
    varianceValue: shortlistActualAt === null ? null : shortlistBase.varianceValue,
    variance: shortlistActualAt === null ? "Not measured" : shortlistBase.variance,
  });

  return {
    positionId: `pos-${title}`,
    title,
    status,
    baselineAt: baseline,
    metrics,
    state: "met",
  };
}

describe("SLA commitment arithmetic", () => {
  const baseline = "2026-01-01T00:00:00.000Z";

  it("shows same-day delivery as 'Same day as launch', not 0 days", () => {
    const role = buildRole("A", baseline, { firstCandidate: { actualDays: 0 } });
    const first = role.metrics.find((m) => m.key === "first_candidate")!;
    expect(first.actual).toBe("Same day as launch");
    expect(first.variance).toBe("5 days early");
    expect(first.state).toBe("met");
  });

  it("does not invent a variance for a shortlist that is not yet full", () => {
    const role = buildRole("A", baseline, { fullShortlist: { actualDays: null, targetSize: 3 } });
    const full = role.metrics.find((m) => m.key === "full_shortlist")!;
    expect(full.actual).toBe("1 of 3 so far");
    expect(full.variance).toBe("Not measured");
    expect(full.varianceValue).toBeNull();
  });

  it("counts every displayed row in the summary total", () => {
    const roles: RoleSla[] = [
      buildRole("A", baseline, {
        firstCandidate: { actualDays: 0 },
        fullShortlist: { actualDays: 3, targetSize: 3 },
      }),
      buildRole("B", baseline, {
        firstCandidate: { actualDays: 6 },
        fullShortlist: { actualDays: null, targetSize: 3 },
      }),
    ];
    const summary = summarise(roles);
    // A: first=0d (met), full=3d (met)
    // B: first=6d (missed), full=null (missed, but no invented variance)
    expect(summary.total).toBe(4); // 2 roles × 2 commitments
    expect(summary.measured).toBe(4); // all four have an outcome, even though the B shortlist variance is not invented
    expect(summary.met).toBe(2); // A first, A full
    expect(summary.onTimeRate).toBe(50); // 2/4 = 50%
  });

  it("includes every measured row in the average variance", () => {
    const roles: RoleSla[] = [
      buildRole("A", baseline, {
        firstCandidate: { actualDays: 0 }, // variance -5 days
        fullShortlist: { actualDays: 3, targetSize: 3 }, // variance -2 days
      }),
      buildRole("B", baseline, {
        firstCandidate: { actualDays: 6 }, // variance +1 day
        fullShortlist: { actualDays: null, targetSize: 3 }, // missed, variance not invented
      }),
    ];
    const summary = summarise(roles);
    // measured variances: -5, -2, +1 = -6 total / 3 = -2
    expect(summary.averageVarianceDays).toBeCloseTo(-2, 2);
  });

  it("keeps the plan table and overview scorecard numbers identical for the same commitment", () => {
    const roles: RoleSla[] = [
      buildRole("A", baseline, {
        firstCandidate: { actualDays: 0 },
        fullShortlist: { actualDays: 3, targetSize: 3 },
      }),
    ];
    const rollup = rollupCommitments(roles);
    const first = rollup.first_candidate;
    expect(first.performance).toContain("Met on 1 of 1 role");
    expect(first.performance).toContain("0 days average");
    expect(first.performance).toContain("5 days early on average");
    expect(first.averageVariance).toBe(-5);
  });

  it("exposes a sensible empty summary", () => {
    const summary = emptySummary();
    expect(summary.total).toBe(0);
    expect(summary.averageVarianceDays).toBeNull();
  });
});

describe("variance helpers", () => {
  it("returns 'on time' for zero variance", () => {
    expect(varianceLabel(0, "days")).toBe("on time");
  });

  it("returns '—' for null variance", () => {
    expect(varianceLabel(null, "hours")).toBe("—");
  });
});
