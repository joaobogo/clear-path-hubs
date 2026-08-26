import { mintActor, callFn } from "../seed-northwind-demo/rpc";
const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
const sb = supabaseAdmin as any;
const ADMIN = "e60fd0fc-3f4d-4911-b469-c672ca0ca369";
const POS = "11de1704-eeff-4179-802e-02ac0845179f";
const actor = await mintActor(sb, ADMIN);
const { data: matches } = await sb
  .from("candidate_matches")
  .select("id, client_visibility")
  .eq("position_id", POS);
for (const m of (matches ?? []) as any[]) {
  if (m.client_visibility === "visible") {
    const r = await callFn(actor, "admin.functions.ts", "setMatchClientVisibility", {
      match_id: m.id,
      visibility: "hidden",
    });
    console.log("hidden", m.id, JSON.stringify(r).slice(0, 120));
  }
}
const out = await callFn(actor, "admin.functions.ts", "deletePosition", {
  id: POS,
  reason: "QA fixture role removed before demo hand-off",
});
console.log("deletePosition →", JSON.stringify(out));
