import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

/**
 * Global workspace search.
 *
 * Tenant-safe:
 * - Admin scope (platform_admin/operations memberships) → all clients, positions,
 *   candidate_matches, and messages (RLS still applies via context.supabase).
 * - Client scope → only positions and *client-visible* candidate_matches for the
 *   organizations the caller has an active membership in, plus messages threaded
 *   to those organizations.
 *
 * CV content is never searched here; only structured columns (name, title,
 * location, headline, org name, message body).
 */

export const globalSearchInput = z.object({
  q: z.string().trim().min(1).max(120),
  scope: z.enum(["admin", "client"]).optional(),
  /** Admin-only: include QA/internal orgs and their records. Default false. */
  includeTest: z.boolean().optional(),
});

export type SearchResultType =
  | "client"
  | "position"
  | "candidate"
  | "intake"
  | "message"
  | "task";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  label: string;
  /** Client / org context for the row. */
  context?: string;
  /** Current operational state, rendered as its own badge. */
  state?: string;
  href: string;
  search?: Record<string, string>;
};

export type SearchResponse = {
  scope: "admin" | "client";
  includeTest: boolean;
  /** Per-group cap applied server-side. */
  limit: number;
  groups: {
    clients: SearchResult[];
    positions: SearchResult[];
    candidates: SearchResult[];
    intakes: SearchResult[];
    messages: SearchResult[];
    tasks: SearchResult[];
  };
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

import { sanitizeSearchTerm, orIlike, ilikeValue } from "./search/postgrest-filter";

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => globalSearchInput.parse(raw))
  .handler(async ({ data, context }): Promise<SearchResponse> => {
    const { supabase, userId } = context;
    const term = sanitizeSearchTerm(data.q);
    const like = `%${term}%`;

    // Resolve caller scope + accessible org IDs from memberships.
    const { data: memberships } = await supabase
      .from("memberships")
      .select("organization_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active");
    const rows = (memberships as AnyRow[]) ?? [];
    const isStaff = rows.some(
      (m) => m.role === "platform_admin" || m.role === "operations",
    );
    const requested = data.scope ?? (isStaff ? "admin" : "client");
    const scope: "admin" | "client" = requested === "admin" && isStaff ? "admin" : "client";
    const orgIds = rows
      .filter((m) => m.organization_id)
      .map((m) => m.organization_id as string);

    const emptyGroups = (): SearchResponse["groups"] => ({
      clients: [],
      positions: [],
      candidates: [],
      intakes: [],
      messages: [],
      tasks: [],
    });

    // Bounded per-group limits.
    const LIMIT = 6;
    if (!term) {
      return {
        scope: data.scope ?? "client",
        includeTest: false,
        limit: LIMIT,
        groups: emptyGroups(),
      };
    }

    // Test/QA records follow the one global staff preference; client scope
    // never sees them, whatever the preference says.
    const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
    const testScope = await loadTestScope(supabase, scope === "admin" ? undefined : "never");
    const includeTest = testScope.includeTest;


    // Early exit for client scope with no org access.
    if (scope === "client" && orgIds.length === 0) {
      return { scope, includeTest, limit: LIMIT, groups: emptyGroups() };
    }

    const groups: SearchResponse["groups"] = emptyGroups();

    // Clients — admin only.
    if (scope === "admin") {
      let oq = supabase
        .from("organizations")
        .select("id, name, industry, status, archived_at")
        .ilike("name", ilikeValue(term)!)
        .order("name")
        .limit(LIMIT);
      oq = excludeTestOrgs(oq, testScope, "id");
      const { data: orgs, error } = await oq;
      if (error) throw new Error(error.message);
      groups.clients = ((orgs as AnyRow[]) ?? []).map((o) => ({
        type: "client",
        id: o.id,
        label: o.name,
        context: o.industry ?? undefined,
        state: o.archived_at ? "archived" : (o.status ?? undefined),
        href: `/admin/clients/${o.id}`,
      }));
    }

    // Positions.
    {
      let query = supabase
        .from("positions")
        .select("id, title, location, status, is_test_record, organization_id, organizations(name)")
        .or(orIlike(["title", "location"], term)!)
        .order("updated_at", { ascending: false })
        .limit(LIMIT);
      if (scope === "client") query = query.in("organization_id", orgIds);
      else query = excludeTestOrgs(query, testScope).eq("is_test_record", false);
      const { data: positions, error } = await query;
      if (error) throw new Error(error.message);
      groups.positions = ((positions as AnyRow[]) ?? []).map((p) => {
        const orgName = p.organizations?.name as string | undefined;
        const context = [orgName, p.location].filter(Boolean).join(" · ");
        const state = p.status ? String(p.status).replace(/_/g, " ") : undefined;

        if (scope === "admin") {
          return {
            type: "position",
            id: p.id,
            label: p.title,
            context,
            state,
            href: `/admin/positions/${p.id}`,
          };
        }
        return {
          type: "position",
          id: p.id,
          label: p.title,
          context,
          state,
          href: `/client/positions/${p.id}`,
          search: { org: p.organization_id },
        };

      });
    }

    // Candidates via candidate_matches (never expose hidden matches to clients).
    {
      // Two-step: find matching candidate_profile ids, then look up matches
      // scoped correctly. Keeps embedding simple and RLS-friendly.
      // Candidate profiles are not readable through client RLS (names are
      // released per client+job), so searching them with the caller's client
      // returned nothing. Resolve the name index with the privileged client
      // and use the ids ONLY to intersect matches the caller can already see
      // below — tenant isolation still comes from the RLS-scoped match query.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("candidate_profiles")
        .select("id, full_name, email, headline")
        .or(orIlike(["full_name", "email", "headline"], term)!)
        .limit(50);
      if (pErr) throw new Error(pErr.message);
      const profileIds = ((profiles as AnyRow[]) ?? []).map((p) => p.id);
      const profileById = new Map<string, AnyRow>(
        ((profiles as AnyRow[]) ?? []).map((p) => [p.id, p]),
      );
      if (profileIds.length > 0) {
        let mq = supabase
          .from("candidate_matches")
          .select(
            "id, candidate_profile_id, position_id, organization_id, client_visibility, stage, positions(title), organizations(name)",
          )
          .in("candidate_profile_id", profileIds)
          .order("updated_at", { ascending: false })
          .limit(LIMIT * 2);
        if (scope === "client") {
          mq = mq.in("organization_id", orgIds).eq("client_visibility", "visible");
        } else {
          mq = excludeTestOrgs(mq, testScope);
        }
        const { data: matches, error } = await mq;
        if (error) throw new Error(error.message);
        const seen = new Set<string>();
        const list: SearchResult[] = [];
        for (const m of ((matches as AnyRow[]) ?? [])) {
          if (list.length >= LIMIT) break;
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          const prof = profileById.get(m.candidate_profile_id);
          const label = prof?.full_name || prof?.email || "Candidate";
          const context = [m.positions?.title, m.organizations?.name].filter(Boolean).join(" · ");
          const state = m.stage ? String(m.stage).replace(/_/g, " ") : undefined;
          if (scope === "admin") {
            list.push({
              type: "candidate",
              id: m.id,
              label,
              context,
              state,
              href: `/admin/candidates/${m.id}`,
            });
          } else {
            list.push({
              type: "candidate",
              id: m.id,
              label,
              context,
              state,
              href: `/client/candidates/${m.id}`,
              search: { org: m.organization_id },
            });
          }
        }
        groups.candidates = list;
      }
    }

    // Intakes — admin only. Company or role title, with lead/conversion state.
    if (scope === "admin") {
      let iq = supabase
        .from("intake_submissions")
        .select(
          "id, company_name, role_title, status, lead_status, position_id, organization_id, created_at",
        )
        .or(orIlike(["company_name", "role_title", "primary_email"], term)!)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (testScope.orgIds.length) {
        // Keep intakes with no org yet; drop the ones tied to a test org.
        iq = iq.or(
          `organization_id.is.null,organization_id.not.in.(${testScope.orgIds.join(",")})`,
        );
      }
      const { data: intakes, error } = await iq;
      if (error) throw new Error(error.message);
      groups.intakes = ((intakes as AnyRow[]) ?? []).map((i) => ({
        type: "intake" as const,
        id: i.id,
        label: i.role_title || i.company_name || "Intake",
        context: [i.company_name, new Date(i.created_at).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })]
          .filter(Boolean)
          .join(" · "),
        state: [
          i.position_id ? "converted" : "not converted",
          i.lead_status && i.lead_status !== "open" ? i.lead_status : i.status,
        ]
          .filter(Boolean)
          .join(" · ")
          .replace(/_/g, " "),
        href: "/admin/intake",
      }));
    }


    // Messages — body search. Client scope filtered by thread_id in orgIds.
    {
      let mq = supabase
        .from("messages")
        .select("id, body, thread_id, created_at")
        .ilike("body", ilikeValue(term)!)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (scope === "client") mq = mq.in("thread_id", orgIds);
      const { data: msgs, error } = await mq;
      if (error) throw new Error(error.message);
      groups.messages = ((msgs as AnyRow[]) ?? []).map((m) => {
        const snippet = String(m.body ?? "").slice(0, 120);
        const href = scope === "admin" ? "/admin/messages" : "/client/messages";
        return {
          type: "message",
          id: m.id,
          label: snippet || "Message",
          context: new Date(m.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }),
          href,
          search: scope === "client" ? { org: m.thread_id as string } : undefined,
        };
      });
    }

    // Tasks — title search scoped to caller's orgs (client) or all (admin).
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tq: any = supabase
        .from("tasks")
        .select("id, title, status, task_type, organization_id, due_at, blocking")
        .ilike("title", ilikeValue(term)!)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("updated_at", { ascending: false })
        .limit(LIMIT);
      if (scope === "client") tq = tq.in("organization_id", orgIds);
      else tq = excludeTestOrgs(tq, testScope);
      const { data: tasks, error } = await tq;
      if (error) throw new Error(error.message);
      groups.tasks = ((tasks as AnyRow[]) ?? []).map((t) => ({
        type: "task" as const,
        id: t.id,
        label: t.title,
        context: [t.task_type?.replace(/_/g, " "), t.blocking ? "blocking" : null]
          .filter(Boolean)
          .join(" · "),
        state: t.status ? String(t.status).replace(/_/g, " ") : undefined,
        href: scope === "admin" ? "/admin" : "/client/approvals",
        search: scope === "client" ? { org: t.organization_id as string } : undefined,
      }));
    }

    return { scope, includeTest, limit: LIMIT, groups };

  });

