import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isOverdue, sortOpenItems, type OpenItem } from "@/lib/client/open-items";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Feedback is expected within two days of the interview taking place. */
const FEEDBACK_WINDOW_MS = 2 * 86_400_000;

export const getClientOpenItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ items: OpenItem[] }> => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const s = context.supabase as AnyRow;

    const [requestsRes, matchesRes, interviewsRes] = await Promise.all([
      s
        .from("position_info_requests")
        .select("id, position_id, question, brief_field, created_at")
        .eq("organization_id", data.orgId)
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(50),
      s
        .from("candidate_matches")
        .select("id, position_id, stage, client_decision_due_at, delivered_at")
        .eq("organization_id", data.orgId)
        .eq("client_visibility", "visible")
        .eq("stage", "delivered")
        .limit(200),
      s
        .from("interviews")
        .select("id, candidate_match_id, position_id, completed_at, status")
        .eq("organization_id", data.orgId)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: true })
        .limit(100),
    ]);

    const requests = (requestsRes.data as AnyRow[]) ?? [];
    const matches = (matchesRes.data as AnyRow[]) ?? [];
    const interviews = (interviewsRes.data as AnyRow[]) ?? [];

    // Interviews with feedback already recorded are not owed anything.
    const interviewIds = interviews.map((i) => i.id as string);
    const scored = new Set<string>();
    if (interviewIds.length > 0) {
      const { data: cards } = await s
        .from("interview_scorecards")
        .select("interview_id")
        .in("interview_id", interviewIds);
      for (const c of ((cards as AnyRow[]) ?? [])) scored.add(c.interview_id as string);
    }

    // Role titles, so every item names the role it belongs to.
    const positionIds = Array.from(
      new Set(
        [...requests, ...matches, ...interviews]
          .map((r) => r.position_id as string | null)
          .filter((v): v is string => typeof v === "string"),
      ),
    );
    const titles = new Map<string, string>();
    if (positionIds.length > 0) {
      const { data: rows } = await s
        .from("positions")
        .select("id, title")
        .eq("organization_id", data.orgId)
        .in("id", positionIds);
      for (const p of ((rows as AnyRow[]) ?? [])) titles.set(p.id as string, p.title as string);
    }
    const roleLine = (pid: string | null) => (pid ? (titles.get(pid) ?? null) : null);

    const now = Date.now();
    const items: OpenItem[] = [];

    for (const r of requests) {
      items.push({
        kind: "info_request",
        id: r.id as string,
        label: r.question as string,
        context: roleLine(r.position_id as string | null),
        href: r.position_id ? `/client/positions/${r.position_id}` : "/client",
        due_at: null,
        overdue: false,
      });
    }

    for (const m of matches) {
      const due = (m.client_decision_due_at as string | null) ?? null;
      items.push({
        kind: "pending_decision",
        id: m.id as string,
        label: "A candidate is waiting on your decision",
        context: roleLine(m.position_id as string | null),
        href: `/client/candidates/${m.id}`,
        due_at: due,
        overdue: isOverdue(due, now),
      });
    }

    for (const i of interviews) {
      if (scored.has(i.id as string)) continue;
      const completed = i.completed_at as string | null;
      const due = completed
        ? new Date(new Date(completed).getTime() + FEEDBACK_WINDOW_MS).toISOString()
        : null;
      items.push({
        kind: "missing_feedback",
        id: i.id as string,
        label: "Interview feedback not recorded yet",
        context: roleLine(i.position_id as string | null),
        href: `/client/candidates/${i.candidate_match_id as string}`,
        due_at: due,
        overdue: isOverdue(due, now),
      });
    }

    return { items: sortOpenItems(items) };
  });
