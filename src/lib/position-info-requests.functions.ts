import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  briefField,
  briefPatch,
  toInfoRequestCard,
  type InfoRequestCard,
  type InfoRequestRow,
} from "@/lib/position-info-requests";

const UUID = /^[0-9a-f-]{36}$/i;

type Row = Record<string, unknown>;

/**
 * Open information requests for a workspace, or for one role.
 *
 * Each row names the exact brief field, so the card can say what is missing and
 * what it unblocks instead of "your recruiter has a question".
 */
export const listInfoRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId?: string }) => {
    const orgId = String(input?.orgId ?? "").trim();
    if (!UUID.test(orgId)) throw new Error("A workspace is required");
    const positionId = String(input?.positionId ?? "").trim();
    return { orgId, positionId: UUID.test(positionId) ? positionId : null };
  })
  .handler(async ({ data, context }): Promise<{ requests: InfoRequestCard[] }> => {
    let query = context.supabase
      .from("position_info_requests")
      .select(
        "id, position_id, brief_field, question, why_needed, unblocks, requested_by, created_at, status",
      )
      .eq("organization_id", data.orgId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(50);
    if (data.positionId) query = query.eq("position_id", data.positionId);

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load your open requests just now");

    const list = (rows as Row[]) ?? [];

    // Who asked, by name — a request with no visible author reads like spam.
    const askerIds = Array.from(
      new Set(list.map((r) => r["requested_by"]).filter((v): v is string => typeof v === "string")),
    );
    const names = new Map<string, string>();
    if (askerIds.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("auth_user_id, full_name")
        .in("auth_user_id", askerIds);
      for (const p of ((profiles as Row[]) ?? []) as Row[]) {
        const id = p["auth_user_id"];
        const name = p["full_name"];
        if (typeof id === "string" && typeof name === "string") names.set(id, name);
      }
    }

    const requests = list.map((r) => {
      const asker = typeof r["requested_by"] === "string" ? names.get(r["requested_by"] as string) : null;
      const row: InfoRequestRow = {
        id: r["id"] as string,
        position_id: (r["position_id"] as string | null) ?? null,
        brief_field: r["brief_field"] as string,
        question: r["question"] as string,
        why_needed: (r["why_needed"] as string | null) ?? null,
        unblocks: (r["unblocks"] as string | null) ?? null,
        asked_by_name: asker ?? "Your TaaSFlow recruiter",
        created_at: r["created_at"] as string,
        status: "open",
      };
      return toInfoRequestCard(row);
    });

    return { requests };
  });

/**
 * Answer a request: the answer is validated with the intake rules for the field
 * it updates, written into the brief, and the request is closed — one step, no
 * email round trip. An empty or invalid answer resolves nothing.
 */
export const answerInfoRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; answer: string }) => {
    const requestId = String(input?.requestId ?? "").trim();
    if (!UUID.test(requestId)) throw new Error("A valid request is required");
    const answer = String(input?.answer ?? "");
    if (answer.trim().length === 0) throw new Error("Write an answer before you send it");
    return { requestId, answer };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; fieldLabel: string } | { ok: false; error: string }> => {
      const { data: request, error } = await context.supabase
        .from("position_info_requests")
        .select("id, organization_id, position_id, brief_field, status")
        .eq("id", data.requestId)
        .maybeSingle();
      if (error) return { ok: false, error: "We could not open that request just now" };
      if (!request) return { ok: false, error: "That request is no longer open" };
      if (request.status !== "open") {
        return { ok: false, error: "That request has already been answered" };
      }

      const field = briefField(request.brief_field);
      if (!field) {
        return {
          ok: false,
          error: "We cannot update that part of the brief here. Message your recruiter instead.",
        };
      }

      const checked = field.validate(data.answer);
      if (!checked.ok) return { ok: false, error: checked.error };

      if (!request.position_id) {
        return { ok: false, error: "That request is not attached to a role" };
      }

      const { data: position, error: posError } = await context.supabase
        .from("positions")
        .select("id, compensation, intake_context, requirements, preferred_requirements, dealbreakers")
        .eq("id", request.position_id)
        .maybeSingle();
      if (posError || !position) {
        return { ok: false, error: "We could not read the role brief. Your answer is still here." };
      }

      const patch = briefPatch(field, checked.value, position);
      const { error: writeError } = await context.supabase
        .from("positions")
        .update(patch as never)
        .eq("id", request.position_id);
      if (writeError) {
        return { ok: false, error: "We could not save that to your brief. Your answer is still here." };
      }

      // The brief is updated; only now does the request stop being outstanding.
      const { error: closeError } = await context.supabase
        .from("position_info_requests")
        .update({
          status: "answered",
          answer: data.answer.trim(),
          answered_by: context.userId,
          answered_at: new Date().toISOString(),
        } as never)
        .eq("id", request.id);
      if (closeError) {
        return {
          ok: false,
          error:
            "Your brief was updated but we could not clear the request. Try again and nothing will be duplicated.",
        };
      }

      return { ok: true, fieldLabel: field.label };
    },
  );
