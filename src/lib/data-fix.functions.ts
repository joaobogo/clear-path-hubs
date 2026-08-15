import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const applyOfferDataFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[DATA-FIX] Starting offer data fix...");
    
    // Beatriz Costa fix
    const beatrizId = "738ec9ba-a937-48ad-ad12-a6546a1050ab";
    const { error: bErr } = await context.supabase
      .from("hire_records")
      .update({
        status: "hire_confirmed",
        close_reason: null,
        close_reason_notes: null,
        accepted_at: "2026-08-13T03:00:00Z",
        hired_at: "2026-08-13T03:16:48Z"
      })
      .eq("id", beatrizId);
    
    if (bErr) console.error("[DATA-FIX] Beatriz fix error:", bErr);
    else console.log("[DATA-FIX] Beatriz fix applied.");

    // Rui Fernandes fix
    const ruiMatchId = "6b7967b1-50ec-4f25-9d14-7245bd57b36f";
    const { data: existing, error: rReadErr } = await context.supabase
      .from("hire_records")
      .select("id")
      .eq("candidate_match_id", ruiMatchId)
      .maybeSingle();

    if (rReadErr) console.error("[DATA-FIX] Rui read error:", rReadErr);

    if (!existing) {
      console.log("[DATA-FIX] Creating missing Rui offer record...");
      const { error: rInsErr } = await context.supabase
        .from("hire_records")
        .insert({
          candidate_match_id: ruiMatchId,
          organization_id: "0c86fa1b-94ee-46b8-9a11-a42cee39bfed",
          position_id: "ee6d2a82-6122-4026-95e4-45a7821b7b7d",
          candidate_profile_id: "4557800a-543d-413c-a19e-41b6ed3649ff",
          status: "offer_sent",
          created_by: "8af09529-81c2-4b93-9d5e-b4387aa0f2b2",
          owner_user_id: "8af09529-81c2-4b93-9d5e-b4387aa0f2b2",
          sent_at: "2026-08-15T03:00:00Z",
          created_at: "2026-08-15T03:00:00Z",
          updated_at: "2026-08-15T03:00:00Z"
        });
      if (rInsErr) console.error("[DATA-FIX] Rui insert error:", rInsErr);
    } else {
      console.log("[DATA-FIX] Rui offer record already exists.");
    }

    return { ok: true };
  });

