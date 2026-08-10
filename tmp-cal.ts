import { createClient } from "@supabase/supabase-js";
import { loadCalibrationDesk } from "@/lib/scoring/calibration-desk.server";
const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
for (const includeTest of [false, true]) {
  const d = await loadCalibrationDesk(s as never, { includeTest });
  console.log("=== includeTest", includeTest);
  console.log("funnel", d.funnel);
  console.log("bands", d.bands?.map((b:any)=>`${b.band}:prod=${b.produced_count} appr=${b.approved_count} hire=${b.hired_count} decl=${b.declined_count} rate=${b.approval_rate}`));
  console.log("decline_reasons", d.decline_reasons);
  console.log("families", (d as any).role_families?.map((f:any)=>`${f.role_family}:${f.produced ?? f.scored}/${f.approved}`));
  console.log("keys", Object.keys(d));
}
const { data: scope } = await s.from("organizations").select("id,name,is_test_account").eq("is_test_account", true);
console.log("test orgs", scope?.map(o=>o.name));
