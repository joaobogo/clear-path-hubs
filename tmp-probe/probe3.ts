import { createHumanAdjustedRun } from "../src/lib/scoring/human-adjusted-run.server";
const out = await createHumanAdjustedRun({
  matchId: "d3000000-0000-4000-8000-000000000008",
  actorUserId: "50f16ae9-8fe9-462a-acef-ce6b4b39f301",
  reason: "Verification probe: reviewer confirmed two criteria from the CV appendix.",
  verdicts: [
    { requirement_id: "req-0", verdict: "met", reason: "Confirmed in employment history section." },
    { requirement_id: "pref-0", verdict: "not_met", reason: "No evidence of this preferred skill anywhere." },
  ],
});
console.log(JSON.stringify(out, null, 2));
