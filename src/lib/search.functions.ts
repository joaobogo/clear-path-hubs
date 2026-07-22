import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const searchInput = z.object({
  q: z.string().trim().min(2).max(100),
  types: z
    .array(z.enum(["client", "position", "candidate", "application", "match"]))
    .optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export type SearchHit = {
  entity_type: "client" | "position" | "candidate" | "application" | "match";
  entity_id: string;
  title: string;
  context: string;
  href: string;
};

// Global search — RLS-scoped. Each sub-query runs through the user's
// authenticated Supabase client, so only rows the caller is allowed to see
// are returned. Trigram indexes back the ILIKE fan-out at scale.
export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => searchInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.q;
    const like = `%${q}%`;
    const limit = data.limit;
    const wanted = new Set(data.types ?? ["client", "position", "candidate", "application", "match"]);
    const hits: SearchHit[] = [];

    if (wanted.has("client")) {
      const { data: rows } = await supabase
        .from("organizations")
        .select("id, name, domain")
        .ilike("name", like)
        .limit(limit);
      for (const r of rows ?? [])
        hits.push({
          entity_type: "client",
          entity_id: r.id,
          title: r.name,
          context: r.domain ?? "Client organization",
          href: `/admin/clients/${r.id}`,
        });
    }

    if (wanted.has("position")) {
      const { data: rows } = await supabase
        .from("positions")
        .select("id, title, status, organization_id")
        .ilike("title", like)
        .limit(limit);
      for (const r of rows ?? [])
        hits.push({
          entity_type: "position",
          entity_id: r.id,
          title: r.title,
          context: `Position · ${r.status}`,
          href: `/admin/positions/${r.id}`,
        });
    }

    if (wanted.has("candidate")) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(q);
      let query = supabase
        .from("candidate_profiles")
        .select("id, full_name, email, headline")
        .limit(limit);
      query = isUuid
        ? query.eq("id", q)
        : query.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
      const { data: rows } = await query;
      for (const r of rows ?? [])
        hits.push({
          entity_type: "candidate",
          entity_id: r.id,
          title: r.full_name,
          context: r.headline ?? r.email,
          href: `/admin/candidates/${r.id}`,
        });
    }

    if (wanted.has("match")) {
      const { data: rows } = await supabase
        .from("candidate_matches")
        .select("id, position_id, stage, overall_score")
        .limit(limit);
      for (const r of rows ?? [])
        hits.push({
          entity_type: "match",
          entity_id: r.id,
          title: `Match · ${r.stage}`,
          context: `Score ${r.overall_score ?? "—"}`,
          href: `/admin/matches/${r.id}`,
        });
    }

    return { hits: hits.slice(0, limit), truncated: hits.length > limit };
  });
