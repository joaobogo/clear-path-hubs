import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const org = (await admin.from("organizations").select("id,name").ilike("name","%Northwind%").limit(1)).data![0] as any;
console.log("org", org);
const m = await import("./src/lib/admin-account-view.server");
for (const [k, fn] of [["commercial", m.loadAccountCommercial], ["delivery", m.loadAccountDelivery], ["engagement", m.loadAccountEngagement]] as const) {
  try { const r = await (fn as any)(admin, org.id); console.log(k, "OK", JSON.stringify(r).slice(0,200)); }
  catch (e) { console.log(k, "FAIL", (e as Error).message, (e as Error).stack?.split("\n")[1]); }
}
