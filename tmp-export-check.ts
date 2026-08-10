import { createClient } from "@supabase/supabase-js";
import { runExportJob, createExportJob, describeScope, listExportJobs, signExportDownload, EXPORT_ROW_CAP } from "@/lib/exports.server";
const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: pos } = await s.from("candidate_matches").select("position_id, organization_id").limit(1);
const p = pos![0];
const { data: staff } = await s.from("user_roles").select("user_id").eq("role","admin").limit(1);
const uid = staff![0].user_id;
for (const mask of [true, false]) {
  const filters = { position_id: p.position_id, include_contact: true, mask_contacts: mask } as any;
  const label = await describeScope(s, filters);
  const id = await createExportJob(s, { userId: uid, filters, scopeLabel: label });
  const res = await runExportJob(s, id, uid);
  console.log("mask=", mask, res);
  if (res.status === "completed") {
    const { url } = await signExportDownload(s, id, uid);
    const r = await fetch(url);
    const text = await r.text();
    console.log("HTTP", r.status, "ctype", r.headers.get("content-type"), "bytes", text.length);
    console.log(text.split("\n").slice(0,9).join("\n"));
    console.log("...rows:", text.split("\n").length - 7);
  }
}
console.log("cap const", EXPORT_ROW_CAP);
const { count } = await s.from("v_admin_candidate_index").select("match_id", { count: "exact", head: true });
console.log("total rows in view", count);
