import { createClient } from "@supabase/supabase-js";
import { runExportJob, createExportJob, describeScope, signExportDownload, EXPORT_ROW_CAP } from "@/lib/exports.server";
const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: rel } = await s.from("v_admin_candidate_index").select("position_id,contact_released,email,phone");
console.log("view rows:", rel!.map(r=>({p:r.position_id.slice(0,8),rel:r.contact_released,em:r.email,ph:r.phone})));
const byPos = new Map<string, any[]>();
for (const r of rel!) { const a = byPos.get(r.position_id) ?? []; a.push(r); byPos.set(r.position_id, a); }
const target = [...byPos.entries()].find(([,a]) => a.every(r=>r.contact_released===true) && a.some(r=>r.email));
console.log("all-released position:", target?.[0], "rows", target?.[1].length);
const { data: staff } = await s.from("user_roles").select("user_id").eq("role","admin").limit(1);
const uid = staff![0].user_id;
if (target) for (const mask of [true, false]) {
  const filters = { position_id: target[0], include_contact: true, mask_contacts: mask } as any;
  const id = await createExportJob(s, { userId: uid, filters, scopeLabel: await describeScope(s, filters) });
  const res = await runExportJob(s, id, uid);
  const { url } = await signExportDownload(s, id, uid);
  const r = await fetch(url); const t = await r.text();
  console.log("=== mask", mask, res.status, "HTTP", r.status, r.headers.get("content-disposition"));
  console.log(t.split("\n").filter(l=>l.startsWith("# Contact"))[0]);
  const cols = t.split("\n")[6].split(","); const row = t.split("\n")[7].split(",");
  console.log("email col:", row[cols.indexOf("email")], "| phone col:", row[cols.indexOf("phone")]);
  const { data: job } = await s.from("export_jobs").select("row_count,contact_included,contact_omission_reason").eq("id",id).single();
  console.log("audit row:", job);
}
// cap mechanism: same query shape, limit lowered to 3
const { data: capped, count } = await s.from("v_admin_candidate_index").select("match_id",{count:"exact"}).order("created_at",{ascending:false}).limit(3);
console.log("cap mechanism: returned", capped!.length, "of count", count, "| header would read:", `# Rows: ${capped!.length}${(count??0)>3?` (capped at 3 of ${count})`:""}`, "| real cap", EXPORT_ROW_CAP);
