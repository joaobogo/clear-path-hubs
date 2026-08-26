const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
const sb = supabaseAdmin as any;
const { data, error } = await sb.from("positions").select("requirements,preferred_requirements,title").eq("id","ee6d2a82-6122-4026-95e4-45a7821b7b7d").maybeSingle();
console.log(error, JSON.stringify(data,null,2));
const { data: q, error: e2 } = await sb.from("screening_questions").select("question,answer_type,options,is_knockout,display_order").eq("position_id","ee6d2a82-6122-4026-95e4-45a7821b7b7d").order("display_order");
console.log(e2, JSON.stringify(q,null,2));
