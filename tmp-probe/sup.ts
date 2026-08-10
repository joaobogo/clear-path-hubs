const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
const r = await (supabaseAdmin as any).from("score_runs").update({ superseded_at: new Date().toISOString(), superseded_by_run_id: "af0f1270-0727-443a-bf40-5357b66f25d4", superseded_reason: "human_adjusted" }).eq("id","65eb2498-20d6-4667-a523-5cb02698ffdb").is("superseded_at", null).select("id,superseded_at");
console.log(JSON.stringify(r, null, 2));
