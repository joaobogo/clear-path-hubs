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

    expect(computeCandidateKpis(rows)).toEqual({
      delivered: 10,
      top: 6, // exceptional + top + strong
      shortlisted: 3,
      interviewing: 3,
      offers: 2,
      hires: 1,
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
    });
  });
});
