import { describe, it, expect } from "vitest";
import { computeCandidateKpis } from "../candidate-kpi";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

type MinimalCandidate = Pick<ClientCandidateDTO, "stage" | "fit">;

function candidate(
  stage: ClientCandidateDTO["stage"],
  band: ClientCandidateDTO["fit"]["band"],
): ClientCandidateDTO {
  return {
    stage,
    fit: { band } as ClientCandidateDTO["fit"],
  } as unknown as ClientCandidateDTO;
}

describe("computeCandidateKpis", () => {
  it("counts all delivered rows and maps stages to the correct tiles", () => {
    const rows: ClientCandidateDTO[] = [
      candidate("delivered", "exceptional"),
      candidate("shortlisted", "top"),
      candidate("shortlisted", "strong"),
      candidate("shortlisted", "not_recommended"),
      candidate("interview_process", "strong"),
      candidate("interview_process", "top"),
      candidate("interview_process", "consider"),
      candidate("offer", "consider"),
      candidate("offer", "not_recommended"),
      candidate("hired", "top"),
    ];

    // Hires are passed in from the confirmed offer records, never inferred
    // from the "hired" stage.
    expect(computeCandidateKpis(rows, 1)).toEqual({
      delivered: 10,
      top: 6, // exceptional + top + strong
      shortlisted: 3,
      interviewing: 3,
      offers: 2,
      hires: 1,
      awaiting_decision: 1,
      stage_partition: {
        awaiting: 1,
        shortlisted: 3,
        interviewing: 3,
        offer: 2,
        hired: 1,
        closed: 0,
        elsewhere: 0,
      },
    });
  });

  it("handles zero rows gracefully", () => {
    expect(computeCandidateKpis([])).toEqual({
      delivered: 0,
      top: 0,
      shortlisted: 0,
      interviewing: 0,
      offers: 0,
      hires: 0,
      awaiting_decision: 0,
      stage_partition: {
        awaiting: 0,
        shortlisted: 0,
        interviewing: 0,
        offer: 0,
        hired: 0,
        closed: 0,
        elsewhere: 0,
      },
    });
  });

  it("counts awaiting review as delivered-and-undecided, not the row total", () => {
    const rows = [
      { stage: "delivered", client_decided: false, fit: { band: "top" } },
      { stage: "delivered", client_decided: true, fit: { band: "top" } },
      { stage: "shortlisted", client_decided: true, fit: { band: "top" } },
    ] as unknown as ClientCandidateDTO[];
    expect(computeCandidateKpis(rows, 0).awaiting_decision).toBe(1);
  });

  it("falls back to the rows' confirmed-offer flag when no hire figure is passed", () => {
    const rows = [
      { stage: "hired", hire_confirmed: true, fit: { band: "top" } },
      { stage: "offer", hire_confirmed: false, fit: { band: "top" } },
    ] as unknown as ClientCandidateDTO[];
    expect(computeCandidateKpis(rows).hires).toBe(1);
    expect(computeCandidateKpis(rows, 1).hires).toBe(1);
  });
});
