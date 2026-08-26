const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
const sb = supabaseAdmin as any;
const { data: profiles } = await sb.from("candidate_profiles").select("id,email").eq("legacy_source_system","northwind-demo-2026-08");
const { data: matches } = await sb.from("candidate_matches").select("id,candidate_profile_id,current_score_run_id,processing_state").in("candidate_profile_id",(profiles??[]).map((p:any)=>p.id));
console.log(matches?.length, matches?.slice(0,3));
const { data: runs, error } = await sb.from("score_runs").select("id,candidate_match_id,final_score,status,started_at").in("candidate_match_id",(matches??[]).map((m:any)=>m.id));
console.log("runs", runs?.length, error, runs?.slice(0,3));
