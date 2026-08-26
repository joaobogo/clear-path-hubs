const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
const sb = supabaseAdmin as any;
const cols = "id,final_score,fit_label,confidence,evidence_confidence,must_have_coverage,preferred_coverage,requirement_coverage,contradiction_status,engine_version,evaluation_method,score_composition".split(",");
for (const c of cols) {
  const { error } = await sb.from("score_runs").select(c).limit(1);
  if (error) console.log("BAD", c, error.message);
}
console.log("done");
