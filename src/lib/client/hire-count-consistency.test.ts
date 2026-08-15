import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeKpis, countLanes, type KpiRow } from "@/lib/client-kpi.server";

/**
 * The hire number must be identical on the three client surfaces that print it:
 *  - Account → "Roles and where they are" row badge ("N hired")
 *  - Roles list (/client/positions) → HIRES
 *  - Offers board (/client/offers) → HIRES CONFIRMED
 * All three must resolve to the single lane derivation (countLanes → hired).
 */

function row(over: Partial<KpiRow> & { id: string; stage: KpiRow["stage"] }): KpiRow {
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
    ...(over as Partial<KpiRow>),
  } as KpiRow;
}

describe("hire count consistency across client surfaces", () => {
  const rows: KpiRow[] = [
    row({ id: "beatriz", stage: "hired" as KpiRow["stage"] }),
    row({ id: "ana", stage: "offer" as KpiRow["stage"] }),
    row({ id: "rui", stage: "interview_process" as KpiRow["stage"] }),
  ];

  it("roles list KPI hires equals the lane derivation", () => {
    expect(computeKpis(rows, 0).hires).toBe(countLanes(rows).counts.hired);
    expect(computeKpis(rows, 0).hires).toBe(1);
  });

  it("account row badge reads the same KPI key as the roles list", () => {
    const src = readFileSync("src/routes/_authenticated/client.account.tsx", "utf8");
    // The old `kpis?.hired` key does not exist on ClientKpis and always printed 0.
    expect(src).not.toMatch(/kpis\?\.hired\b/);
    expect(src).toMatch(/kpis\?\.hires\b/);
  });

  it("offers board hire totals count confirmed hires, not a separate field", () => {
    const src = readFileSync("src/lib/hires.functions.ts", "utf8");
    expect(src).toContain("hire_confirmed");
  });
});
