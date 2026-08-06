// Open information requests — server-only reader.
// Shared by the thin server-function wrapper and the role-detail payload.
import {
  toInfoRequestCard,
  type InfoRequestCard,
  type InfoRequestRow,
} from "@/lib/position-info-requests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;
type Row = Record<string, unknown>;

export async function loadInfoRequests(
  supabase: Client,
  data: { orgId: string; positionId: string | null },
): Promise<{ requests: InfoRequestCard[] }> {
    let query = supabase
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
      const { data: profiles } = await supabase
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
}
