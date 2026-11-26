/**
 * A recruiter's review survives a machine re-score (26 Nov 2026).
 *
 * One candidate's score went 31.3, 62.5, 31.3, 31.3, 62.5, 70.0 in an
 * afternoon on identical inputs: every re-score replaced the reviewed run with
 * the bare machine run, and re-applying by hand froze rows the machine had
 * since scored higher. The review control also had no Partial.
 *
 * Rules pinned here:
 *  - a verdict that differed from the machine when the person decided is
 *    deliberate and is kept;
 *  - a verdict that agreed with the machine follows the machine;
 *  - a kept verdict the machine has since moved away from is flagged;
 *  - Partial is a verdict, worth the engine's partial credit;
 *  - the same machine rows and the same calls give the same score every time.
 */
import { describe, expect, it } from "vitest";
import {
  HUMAN_LEDGER_FORMAT,
  HUMAN_VERDICTS,
  applyHumanVerdicts,
  isDeliberateVerdict,
  latestVerdicts,
  planReapply,
  recomputeAdjustedScore,
  verdictStatus,
  type AssessmentRow,
  type HumanRunLedger,
  type HumanVerdict,
  type HumanVerdictRecord,
} from "@/lib/scoring/human-adjustment";
import { DEFAULT_CALIBRATION } from "@/lib/scoring/engine-calibration";

const TEXT: Record<string, string> = {
  "req-0": "Proven new-logo enterprise sales (hunting) in data, cloud or IT services",
  "req-1": "Has personally closed enterprise deals of $2M+ in total contract value",
  "req-2": "Consistently met or exceeded multi-million new-business bookings targets",
  "req-3":
    "Deep knowledge of the cloud data ecosystem: Snowflake, Databricks, BigQuery and Microsoft",
  "req-4":
    "Established network of senior data/technology buyers (CIO, CDO, Head of Data) in UK enterprises",
  "req-5": "Based in or commutable to London, and able to travel up to 50%",
  "pref-0": "Has sold data-platform migration or modernisation",
  "pref-1": "Co-sold with hyperscaler or platform partner teams",
  "pref-2":
    "Sold for an automation- or IP-led services firm and won against large systems integrators",
  "pref-3": "Uses a formal qualification method (MEDDPICC, MEDDIC or similar)",
  "pref-4": "Has built a territory or a pipeline engine from scratch at a scale-up",
  "pref-5": "Coverage of Irish enterprises as well as UK",
};
const IDS = Object.keys(TEXT);

/** Machine rows from "req-0=partial req-1=met …". */
function machineRows(spec: string): AssessmentRow[] {
  const status = Object.fromEntries(spec.split(/\s+/).map((p) => p.split("=")));
  return IDS.map((id) => ({
    id,
    text: TEXT[id],
    required: id.startsWith("req-"),
    status: status[id] ?? "missing",
  }));
}

function record(
  id: string,
  verdict: HumanVerdict,
  machine: string,
  at: string,
  who = "John Kasprzak",
): HumanVerdictRecord {
  return {
    requirement_id: id,
    verdict,
    reason: `Reason for ${id}`,
    actor_user_id: "user-1",
    actor_name: who,
    at,
    machine_status: machine,
  };
}

const score = (rows: AssessmentRow[], screening: number | null) =>
  recomputeAdjustedScore({
    assessment: rows,
    screeningAlignment: screening,
    calibration: DEFAULT_CALIBRATION,
  });

/** Statuses as "req-0=met …" for the rows a test cares about. */
const statuses = (rows: AssessmentRow[]) => Object.fromEntries(rows.map((r) => [r.id, r.status]));

// The afternoon of 26 Nov 2026, as stored.
const MACHINE_CV_ONLY =
  "req-0=partial req-1=partial req-2=partial req-3=missing req-4=partial req-5=missing " +
  "pref-0=missing pref-1=partial pref-2=missing pref-3=partial pref-4=partial pref-5=missing";
const MACHINE_WITH_ANSWERS =
  "req-0=partial req-1=met req-2=partial req-3=missing req-4=partial req-5=partial " +
  "pref-0=missing pref-1=partial pref-2=partial pref-3=partial pref-4=partial pref-5=missing";
const REVIEW: Array<[string, HumanVerdict]> = [
  ["req-0", "met"],
  ["req-1", "partial"],
  ["req-2", "met"],
  ["req-3", "not_met"],
  ["req-4", "partial"],
  ["req-5", "met"],
  ["pref-0", "not_met"],
  ["pref-1", "partial"],
  ["pref-2", "not_met"],
  ["pref-3", "met"],
  ["pref-4", "met"],
  ["pref-5", "partial"],
];
/** A review run in the older format: machine_status is the base run's. */
function legacyRun(run_id: string, at: string, machineSpec: string): HumanRunLedger {
  const rows = machineRows(machineSpec);
  return {
    run_id,
    at,
    verdicts: REVIEW.map(([id, v]) => record(id, v, rows.find((r) => r.id === id)!.status, at)),
    assessment: rows,
  };
}
const HISTORY: HumanRunLedger[] = [
  legacyRun("b892f134", "2026-11-26T15:52:12Z", MACHINE_CV_ONLY),
  legacyRun("a29b876a", "2026-11-26T15:56:40Z", MACHINE_CV_ONLY),
  // Re-applied by hand after the answers: machine_status was overwritten.
  legacyRun("bdab8db5", "2026-11-26T17:50:41Z", MACHINE_WITH_ANSWERS),
];

describe("Partial is a recruiter verdict", () => {
  it("is offered, and stands for the partial status", () => {
    expect([...HUMAN_VERDICTS]).toEqual(["met", "partial", "not_met", "not_applicable"]);
    expect(verdictStatus("partial")).toBe("partial");
    expect(verdictStatus("met")).toBe("met");
    expect(verdictStatus("not_met")).toBe("missing");
    expect(verdictStatus("not_applicable")).toBeNull();
  });

  it("is worth the engine's partial credit: not met to partial adds 0.5/6 on a six-must-have role", () => {
    const rows = machineRows("req-0=met req-1=met req-2=met req-3=missing req-4=met req-5=met");
    const before = score(rows, null).must_have_coverage;
    const partial = applyHumanVerdicts(rows, [
      record("req-3", "partial", "missing", "2026-11-26T18:00:00Z"),
    ]);
    const after = score(partial.assessment, null).must_have_coverage;
    expect(partial.assessment.find((r) => r.id === "req-3")!.status).toBe("partial");
    expect(after - before).toBeCloseTo(DEFAULT_CALIBRATION.partial_credit / 6, 3);
    expect(DEFAULT_CALIBRATION.partial_credit).toBe(0.5);
  });
});

describe("deliberate or carried forward", () => {
  it("is deliberate only when it differed from the machine at the time", () => {
    expect(isDeliberateVerdict("met", "partial")).toBe(true);
    expect(isDeliberateVerdict("partial", "missing")).toBe(true);
    expect(isDeliberateVerdict("not_met", "partial")).toBe(true);
    expect(isDeliberateVerdict("met", "met")).toBe(false);
    expect(isDeliberateVerdict("partial", "partial")).toBe(false);
    expect(isDeliberateVerdict("not_met", "missing")).toBe(false);
    // The machine never says "not applicable".
    expect(isDeliberateVerdict("not_applicable", "missing")).toBe(true);
  });

  it("reads older review runs back to where each call began", () => {
    const stored = Object.fromEntries(latestVerdicts(HISTORY).map((v) => [v.requirement_id, v]));
    // req-1 was "partial" against a machine "partial" at 15:52; the 17:50
    // re-apply recorded machine "met", but the person never changed it.
    expect(stored["req-1"]).toMatchObject({
      verdict: "partial",
      decided_machine_status: "partial",
      deliberate: false,
    });
    expect(stored["pref-2"]).toMatchObject({
      verdict: "not_met",
      decided_machine_status: "missing",
      deliberate: false,
    });
    expect(stored["req-0"]).toMatchObject({
      verdict: "met",
      decided_machine_status: "partial",
      deliberate: true,
    });
    expect(stored["req-5"]).toMatchObject({
      verdict: "met",
      decided_machine_status: "missing",
      deliberate: true,
    });
    expect(stored["pref-5"]).toMatchObject({
      verdict: "partial",
      decided_machine_status: "missing",
      deliberate: true,
    });
    // The person who decided and when are kept, not the time of the re-apply.
    expect(stored["req-0"].at).toBe("2026-11-26T15:52:12Z");
    expect(stored["req-0"].actor_name).toBe("John Kasprzak");
    expect(
      Object.values(stored)
        .filter((v) => v.deliberate)
        .map((v) => v.requirement_id)
        .sort(),
    ).toEqual(["pref-3", "pref-4", "pref-5", "req-0", "req-2", "req-5"]);
  });
});

describe("re-applying a review on a new machine run", () => {
  const machine = machineRows(MACHINE_WITH_ANSWERS);
  const plan = planReapply(machine, latestVerdicts(HISTORY));
  const reviewed = applyHumanVerdicts(machine, plan.apply).assessment;

  it("carried-forward calls follow the machine", () => {
    // The machine moved req-1 to met and pref-2 to partial after the answers.
    expect(statuses(reviewed)["req-1"]).toBe("met");
    expect(statuses(reviewed)["pref-2"]).toBe("partial");
    expect(plan.carried_forward.map((r) => r.requirement_id).sort()).toEqual(["pref-2", "req-1"]);
    expect(reviewed.find((r) => r.id === "req-1")!.human_verified).toBeUndefined();
  });

  it("deliberate calls are kept", () => {
    expect(statuses(reviewed)).toMatchObject({
      "req-0": "met",
      "req-2": "met",
      "req-5": "met",
      "pref-3": "met",
      "pref-4": "met",
      "pref-5": "partial",
    });
    const kept = reviewed.find((r) => r.id === "req-0")!;
    expect(kept).toMatchObject({
      human_verified: true,
      human_verdict: "met",
      human_actor_name: "John Kasprzak",
      human_at: "2026-11-26T15:52:12Z",
      machine_status: "partial",
      human_decided_machine_status: "partial",
    });
  });

  it("a call that agreed with the machine stays verified while the machine still agrees", () => {
    // req-3, req-4, pref-0, pref-1: reviewed, same as the machine then and now.
    for (const id of ["req-3", "req-4", "pref-0", "pref-1"]) {
      const row = reviewed.find((r) => r.id === id)!;
      expect(row.human_verified).toBe(true);
      expect(row.status).toBe(machine.find((r) => r.id === id)!.status);
      expect(row.machine_changed_since_review).toBe(false);
    }
  });

  it("flags a kept call the machine has since moved away from", () => {
    // req-5: decided "met" against machine "missing"; the machine now says partial.
    expect(reviewed.find((r) => r.id === "req-5")).toMatchObject({
      status: "met",
      machine_status: "partial",
      human_decided_machine_status: "missing",
      machine_changed_since_review: true,
    });
    // req-0: the machine has not moved, so nothing to flag.
    expect(reviewed.find((r) => r.id === "req-0")!.machine_changed_since_review).toBe(false);
    // A kept call the machine has caught up with is not a disagreement.
    const caughtUp = machineRows(MACHINE_WITH_ANSWERS.replace("req-5=partial", "req-5=met"));
    const again = applyHumanVerdicts(
      caughtUp,
      planReapply(caughtUp, latestVerdicts(HISTORY)).apply,
    ).assessment;
    expect(again.find((r) => r.id === "req-5")).toMatchObject({
      status: "met",
      machine_changed_since_review: false,
    });
  });

  it("scoring twice in a row gives the identical score and rows", () => {
    const once = score(reviewed, 1);
    // The run that was just written, in today's format, is the history now.
    const ledger: HumanRunLedger = {
      run_id: "new-1",
      at: "2026-11-26T19:00:00Z",
      format: HUMAN_LEDGER_FORMAT,
      verdicts: plan.apply,
      carried_forward: plan.carried_forward,
      assessment: reviewed,
    };
    const plan2 = planReapply(machine, latestVerdicts([...HISTORY, ledger]));
    const reviewed2 = applyHumanVerdicts(machine, plan2.apply).assessment;
    expect(statuses(reviewed2)).toEqual(statuses(reviewed));
    expect(score(reviewed2, 1).final_score).toBe(once.final_score);
    // And a third time, from the second.
    const ledger2 = {
      ...ledger,
      run_id: "new-2",
      at: "2026-11-26T20:00:00Z",
      verdicts: plan2.apply,
      carried_forward: plan2.carried_forward,
      assessment: reviewed2,
    };
    const plan3 = planReapply(machine, latestVerdicts([...HISTORY, ledger, ledger2]));
    expect(score(applyHumanVerdicts(machine, plan3.apply).assessment, 1).final_score).toBe(
      once.final_score,
    );
  });

  it("a carried-forward call comes back when the machine returns to what was reviewed", () => {
    const back = machineRows(MACHINE_WITH_ANSWERS.replace("req-1=met", "req-1=partial"));
    const ledger: HumanRunLedger = {
      run_id: "new-1",
      at: "2026-11-26T19:00:00Z",
      format: HUMAN_LEDGER_FORMAT,
      verdicts: plan.apply,
      carried_forward: plan.carried_forward,
      assessment: reviewed,
    };
    const p = planReapply(back, latestVerdicts([...HISTORY, ledger]));
    const rows = applyHumanVerdicts(back, p.apply).assessment;
    expect(rows.find((r) => r.id === "req-1")).toMatchObject({
      status: "partial",
      human_verified: true,
    });
  });

  it("finds a requirement by its wording when the role's list was reordered, and drops a call on a removed one", () => {
    const reordered = [...machine]
      .reverse()
      .filter((r) => r.id !== "pref-5")
      .map((r, i) => ({ ...r, id: `row-${i}` }));
    const p = planReapply(reordered, latestVerdicts(HISTORY));
    const rows = applyHumanVerdicts(reordered, p.apply).assessment;
    expect(rows.find((r) => r.text === TEXT["req-0"])).toMatchObject({
      status: "met",
      human_verified: true,
    });
    expect(p.dropped).toEqual([{ requirement_id: "pref-5", requirement_text: TEXT["pref-5"] }]);
  });
});

describe("the two candidates in the spec", () => {
  it("first candidate: review kept, John's data-platform call recorded as Partial, about 81.7", () => {
    const machine = machineRows(MACHINE_WITH_ANSWERS);
    const johnsCall = {
      ...record("req-3", "partial", "missing", "2026-11-26T19:30:00Z"),
      requirement_text: TEXT["req-3"],
      decided_machine_status: "missing",
      deliberate: true,
    };
    const stored = latestVerdicts(HISTORY).filter((v) => v.requirement_id !== "req-3");
    const plan = planReapply(machine, [...stored, johnsCall]);
    const reviewed = applyHumanVerdicts(machine, plan.apply).assessment;
    const out = score(reviewed, 1);
    expect(statuses(reviewed)).toMatchObject({
      "req-1": "met",
      "req-3": "partial",
      "req-4": "partial",
      "pref-2": "partial",
    });
    expect(out.must_have_coverage).toBeCloseTo(5 / 6, 4);
    expect(out.preferred_coverage).toBeCloseTo(3.5 / 6, 4);
    expect(out.final_score).toBe(81.7);
  });

  it("second candidate: four recruiter calls on the machine run, 75.0", () => {
    const machine = machineRows(
      "req-0=met req-1=met req-2=partial req-3=met req-4=missing req-5=partial " +
        "pref-0=missing pref-1=partial pref-2=missing pref-3=partial pref-4=partial pref-5=missing",
    );
    const calls: Array<[string, HumanVerdict]> = [
      ["req-5", "met"],
      ["pref-1", "met"],
      ["pref-0", "partial"],
      ["pref-5", "partial"],
    ];
    const reviewed = applyHumanVerdicts(
      machine,
      calls.map(([id, v]) =>
        record(id, v, machine.find((r) => r.id === id)!.status, "2026-11-26T19:30:00Z"),
      ),
    ).assessment;
    const out = score(reviewed, 1);
    expect(out.must_have_coverage).toBeCloseTo(4.5 / 6, 4);
    expect(out.preferred_coverage).toBeCloseTo(3 / 6, 4);
    expect(out.final_score).toBe(75);
  });
});

describe("what the client reads for a recruiter's verdict", () => {
  it("shows a recruiter's partly-met call as decided, and says who decided it", async () => {
    const { recruiterVerifiedLabel, resolveRequirementStatus } =
      await import("@/lib/client/requirement-status");
    const row = {
      status: "partial" as const,
      evidence: [],
      contradictions: [],
      recruiter_verified: true,
    };
    // No CV quote is needed: this is the recruiter's call, labelled as such.
    expect(resolveRequirementStatus(row)).toBe("partial");
    expect(recruiterVerifiedLabel({ status: "partial", recruiter_verified: true })).toBe(
      "Partly met (recruiter verified)",
    );
    expect(recruiterVerifiedLabel({ status: "met", recruiter_verified: true })).toBe(
      "Met (recruiter verified)",
    );
    // A machine row with no quote is still not evidenced, and carries no label.
    expect(resolveRequirementStatus({ ...row, recruiter_verified: false })).toBe("not_evidenced");
    expect(recruiterVerifiedLabel({ status: "partial" })).toBeNull();
    expect(
      recruiterVerifiedLabel({ status: "not_evidenced", recruiter_verified: true }),
    ).toBeNull();
  });
});
