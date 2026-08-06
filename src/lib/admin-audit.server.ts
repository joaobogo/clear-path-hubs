/**
 * Server-only half of the record audit reader.
 *
 * Kept out of the `*.functions.ts` module so nothing here can be pulled into a
 * client bundle. The candidate case is the awkward one: its events are written
 * against three different ids (match, application, candidate profile), so it
 * resolves those first and reads them as a set.
 */
import type { AuditEntity, RecordAuditPage } from "@/lib/admin-audit.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const SELECT =
  "id,action,entity_type,entity_id,created_at,actor_user_id,trace_id,before_state,after_state,organization_id";

/** Pulls the operator's stated reason out of whichever payload carried it. */
function reasonOf(row: Row): string | null {
  for (const state of [row.after_state, row.before_state]) {
    if (state && typeof state === "object") {
      const candidate =
        (state as Record<string, unknown>).reason ??
        (state as Record<string, unknown>).reason_text ??
        (state as Record<string, unknown>).note;
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return null;
}

async function candidateEntityIds(db: Db, matchId: string): Promise<string[]> {
  const { data: match } = await db
    .from("candidate_matches")
    .select("id, application_id, candidate_profile_id")
    .eq("id", matchId)
    .maybeSingle();
  return [
    matchId,
    (match?.application_id as string | null) ?? null,
    (match?.candidate_profile_id as string | null) ?? null,
  ].filter((v: string | null): v is string => Boolean(v));
}

export async function loadRecordAudit(
  db: Db,
  args: { entity: AuditEntity; id: string; limit: number; offset: number },
): Promise<RecordAuditPage> {
  const { entity, id, limit, offset } = args;

  const base = () => db.from("audit_events").select(SELECT, { count: "exact" });

  let query;
  if (entity === "client") {
    query = base().eq("organization_id", id);
  } else if (entity === "position") {
    query = base().eq("entity_id", id);
  } else {
    const ids = await candidateEntityIds(db, id);
    query = base().in("entity_id", ids);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const rows = (data ?? []) as Row[];

  // Resolve actors in one read; unknown ids read as "System" rather than a UUID.
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_user_id as string | null).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", actorIds);
    for (const p of (profiles ?? []) as Row[]) {
      names.set(
        p.user_id as string,
        (p.full_name as string | null) || (p.email as string | null) || "Unknown user",
      );
    }
  }

  const total = typeof count === "number" ? count : rows.length + offset;

  return {
    rows: rows.map((r) => ({
      id: r.id as string,
      action: r.action as string,
      entity_type: r.entity_type as string,
      created_at: r.created_at as string,
      actor_user_id: (r.actor_user_id as string | null) ?? null,
      actor_name: r.actor_user_id
        ? names.get(r.actor_user_id as string) ?? "Unknown user"
        : "System",
      reason: reasonOf(r),
      trace_id: (r.trace_id as string | null) ?? null,
    })),
    total,
    offset,
    limit,
    has_more: offset + rows.length < total,
  };
}
