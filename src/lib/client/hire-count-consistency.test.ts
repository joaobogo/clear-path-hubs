import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeKpis, type KpiRow } from "@/lib/client-kpi.server";

/**
 * The hire number must be identical on every client surface that prints it:
 *  - Account → hires total and the "N hired" row badge
 *  - Roles list (/client/positions) → HIRES
 *  - Candidates → Hiring Snapshot "Hires"
 *  - Offers board (/client/offers) → HIRES CONFIRMED
 *  - Insights → "Hires · 30d/90d/YTD"
 * All of them resolve to one selector over the confirmed offer records.
 */

function row(
  over: Partial<KpiRow> & { id: string; stage: KpiRow["stage"] },
): KpiRow {
  return {
    candidate_profile_id: `p-${over.id}`,
    position_id: "pos-1",
    approved_score_run_id: null,
    delivered_at: "2026-08-01T00:00:00Z",
    approved_score: null,
    approved_fit_label: null,
    approved_fit_band: null,
    interview_active: false,
    interview_scheduled: false,
    interview_needs_confirmation: false,
    next_interview_at: null,
    interview_requested_at: null,
    stage_entered_at: "2026-08-13T00:00:00Z",
    client_decision_due_at: null,
    recommendation: null,
    hire_confirmed: false,
    ...(over as Partial<KpiRow>),
  } as KpiRow;
}

describe("hire count consistency across client surfaces", () => {
  const rows: KpiRow[] = [
    row({ id: "beatriz", stage: "hired", hire_confirmed: true }),
    row({ id: "ana", stage: "offer" }),
    row({ id: "rui", stage: "interview_process" }),
  ];

  it("counts confirmed hire records, not the pipeline stage", () => {
    expect(computeKpis(rows, 0).hires).toBe(1);
    // A candidate parked in the hired stage without a confirmed offer record
    // is not a hire on any surface.
    expect(
      computeKpis([row({ id: "no-record", stage: "hired" })], 0).hires,
    ).toBe(0);
  });

  it("account row badge reads the same KPI key as the roles list", () => {
    const src = readFileSync(
      "src/routes/_authenticated/client.account.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/kpis\?\.hired\b/);
    expect(src).toMatch(/kpis\?\.hires\b/);
  });

  it("every hire surface reads the one selector", () => {
    for (const file of [
      "src/lib/client-kpi.server.ts",
      "src/lib/account.functions.ts",
      "src/lib/hires.functions.ts",
      "src/lib/executive.functions.ts",
    ]) {
      // Either the selector itself or the KPI library that re-exports it.
      expect(readFileSync(file, "utf8")).toMatch(
        /hires\/confirmed|kpis\/confirmed-hires/,
      );
    }
  });

  it("no surface re-derives hires from the view or the stage", () => {
    for (const file of [
      "src/lib/client-kpi.server.ts",
      "src/lib/client-overview.functions.ts",
      "src/lib/account.functions.ts",
      "src/lib/hires.functions.ts",
      "src/lib/executive.functions.ts",
      "src/lib/client/candidate-kpi.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain('.select("hires")');
      expect(src).not.toMatch(/hires:\s*(laneCounts|counts)\.hired/);
      expect(src).not.toMatch(/stage === "hired"\) hires/);
    }
  });
});
