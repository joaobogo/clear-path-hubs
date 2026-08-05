/**
 * Duplicate candidate detection — data loading and staff actions.
 *
 * Reads talent_persons / talent_person_identifiers (populated by
 * resolve_talent_person) and only pairs people on exact identifier matches.
 * Merging and marking-as-distinct are explicit staff actions, always audited,
 * and reversible by a platform admin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DuplicateApplicationRow,
  type DuplicateDecisionRow,
  type DuplicatePair,
  type DuplicatePersonSide,
  type DuplicateReview,
  detectPairs,
  orderedPair,
  pairKey,
} from "./duplicate-candidates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const ENTITY = "talent_persons";

function check(res: { error?: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

function uniq(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export async function requirePlatformAdmin(a: Admin, userId: string): Promise<void> {
  const { data } = await (a as Row).rpc("is_platform_admin", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

/** Load suspected duplicate pairs plus the decisions currently in force. */
export async function loadDuplicateReview(a: Admin): Promise<DuplicateReview> {
  const s = a as unknown as Row;

  const [personsRes, decisionsRes] = await Promise.all([
    s.from("talent_persons").select("id, display_name, primary_email, first_seen_at").is("merged_into_id", null),
    s
      .from("duplicate_person_decisions")
      .select("id, person_a_id, person_b_id, decision, note, created_at, decided_by")
      .is("reverted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  check(personsRes);
  check(decisionsRes);

  const persons: Row[] = personsRes.data ?? [];
  const decisions: Row[] = decisionsRes.data ?? [];
  const livePersonIds = new Set(persons.map((p) => p["id"] as string));

  const suppressed = new Set(
    decisions.map((d) => pairKey(d["person_a_id"] as string, d["person_b_id"] as string)),
  );

  if (persons.length === 0) {
    return { pairs: [], resolved: await hydrateDecisions(s, decisions), scanned_people: 0 };
  }

  const idsRes = await s
    .from("talent_person_identifiers")
    .select("person_id, kind, value")
    .in("person_id", [...livePersonIds])
    .in("kind", ["email", "phone", "candidate_profile"]);
  check(idsRes);
  const identifiers: Row[] = idsRes.data ?? [];

  const matchMap = detectPairs(
    identifiers.map((r) => ({
      person_id: r["person_id"] as string,
      kind: r["kind"] as string,
      value: String(r["value"] ?? ""),
    })),
    suppressed,
  );

  const involved = new Set<string>();
  for (const key of matchMap.keys()) {
    const [a1, b1] = key.split(":");
    if (a1) involved.add(a1);
    if (b1) involved.add(b1);
  }

  const sides = await hydrateSides(s, persons, identifiers, involved);

  const pairs: DuplicatePair[] = [];
  for (const [key, matched] of matchMap) {
    const [aId, bId] = key.split(":");
    const person_a = aId ? sides.get(aId) : undefined;
    const person_b = bId ? sides.get(bId) : undefined;
    if (!person_a || !person_b) continue;
    pairs.push({ pair_key: key, person_a, person_b, matched });
  }

  pairs.sort((x, y) => {
    const ax = x.person_a.applications.length + x.person_b.applications.length;
    const ay = y.person_a.applications.length + y.person_b.applications.length;
    return ay - ax;
  });

  return { pairs, resolved: await hydrateDecisions(s, decisions), scanned_people: persons.length };
}

async function hydrateDecisions(s: Row, decisions: Row[]): Promise<DuplicateDecisionRow[]> {
  if (decisions.length === 0) return [];
  const actorIds = uniq(decisions.map((d) => d["decided_by"] as string | null));
  const names = new Map<string, string>();
  if (actorIds.length) {
    const res = await s.from("profiles").select("user_id, full_name").in("user_id", actorIds);
    for (const row of (res.data ?? []) as Row[]) {
      names.set(row["user_id"] as string, (row["full_name"] as string) ?? "");
    }
  }
  return decisions.map((d) => ({
    id: d["id"] as string,
    person_a_id: d["person_a_id"] as string,
    person_b_id: d["person_b_id"] as string,
    decision: d["decision"] as "merged" | "distinct",
    note: (d["note"] as string | null) ?? null,
    created_at: d["created_at"] as string,
    decided_by: (d["decided_by"] as string | null) ?? null,
    decided_by_name: names.get(d["decided_by"] as string) || null,
  }));
}

async function hydrateSides(
  s: Row,
  persons: Row[],
  identifiers: Row[],
  involved: Set<string>,
): Promise<Map<string, DuplicatePersonSide>> {
  const out = new Map<string, DuplicatePersonSide>();
  if (involved.size === 0) return out;

  const byPerson = new Map<string, Row[]>();
  for (const row of identifiers) {
    const pid = row["person_id"] as string;
    if (!involved.has(pid)) continue;
    const list = byPerson.get(pid) ?? [];
    list.push(row);
    byPerson.set(pid, list);
  }

  const profileIds = uniq(
    identifiers
      .filter((r) => r["kind"] === "candidate_profile" && involved.has(r["person_id"] as string))
      .map((r) => String(r["value"] ?? "")),
  );

  const appsByProfile = new Map<string, DuplicateApplicationRow[]>();
  if (profileIds.length) {
    const [appsRes, matchRes] = await Promise.all([
      s
        .from("applications")
        .select("id, candidate_profile_id, position_id, applied_at, created_at, status")
        .in("candidate_profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(500),
      s
        .from("candidate_matches")
        .select("candidate_profile_id, position_id, stage, organization_id")
        .in("candidate_profile_id", profileIds)
        .limit(500),
    ]);
    check(appsRes);
    check(matchRes);
    const apps: Row[] = appsRes.data ?? [];
    const matches: Row[] = matchRes.data ?? [];

    const positionIds = uniq([
      ...apps.map((r) => r["position_id"] as string | null),
      ...matches.map((r) => r["position_id"] as string | null),
    ]);
    const orgIds = uniq(matches.map((r) => r["organization_id"] as string | null));

    const [posRes, orgRes] = await Promise.all([
      positionIds.length
        ? s.from("positions").select("id, title, organization_id").in("id", positionIds)
        : Promise.resolve({ data: [] as Row[] }),
      orgIds.length
        ? s.from("organizations").select("id, name").in("id", orgIds)
        : Promise.resolve({ data: [] as Row[] }),
    ]);
    const positions = new Map<string, Row>(((posRes.data ?? []) as Row[]).map((p) => [p["id"] as string, p]));
    const orgNames = new Map<string, string>(
      ((orgRes.data ?? []) as Row[]).map((o) => [o["id"] as string, (o["name"] as string) ?? ""]),
    );

    const orgForPositions = uniq(
      [...positions.values()].map((p) => p["organization_id"] as string | null),
    ).filter((id) => !orgNames.has(id));
    if (orgForPositions.length) {
      const extra = await s.from("organizations").select("id, name").in("id", orgForPositions);
      for (const o of (extra.data ?? []) as Row[]) {
        orgNames.set(o["id"] as string, (o["name"] as string) ?? "");
      }
    }

    const stageBy = new Map<string, string>();
    for (const m of matches) {
      stageBy.set(`${m["candidate_profile_id"]}:${m["position_id"]}`, (m["stage"] as string) ?? "");
    }

    for (const app of apps) {
      const pid = app["candidate_profile_id"] as string;
      const positionId = (app["position_id"] as string | null) ?? null;
      const position = positionId ? positions.get(positionId) : undefined;
      const orgId = position ? (position["organization_id"] as string | null) : null;
      const list = appsByProfile.get(pid) ?? [];
      list.push({
        application_id: app["id"] as string,
        applied_at: (app["applied_at"] as string | null) ?? (app["created_at"] as string | null) ?? null,
        position_id: positionId,
        position_title: position ? ((position["title"] as string) ?? null) : null,
        organization_name: orgId ? (orgNames.get(orgId) ?? null) : null,
        stage: stageBy.get(`${pid}:${positionId}`) ?? (app["status"] as string | null) ?? null,
      });
      appsByProfile.set(pid, list);
    }
  }

  for (const person of persons) {
    const pid = person["id"] as string;
    if (!involved.has(pid)) continue;
    const rows = byPerson.get(pid) ?? [];
    const profiles = uniq(
      rows.filter((r) => r["kind"] === "candidate_profile").map((r) => String(r["value"] ?? "")),
    );
    out.set(pid, {
      person_id: pid,
      display_name: (person["display_name"] as string | null) ?? null,
      primary_email: (person["primary_email"] as string | null) ?? null,
      first_seen_at: (person["first_seen_at"] as string | null) ?? null,
      candidate_profile_ids: profiles,
      candidate_profile_id: profiles[0] ?? null,
      emails: uniq(rows.filter((r) => r["kind"] === "email").map((r) => String(r["value"] ?? ""))),
      phones: uniq(rows.filter((r) => r["kind"] === "phone").map((r) => String(r["value"] ?? ""))),
      applications: profiles.flatMap((p) => appsByProfile.get(p) ?? []),
    });
  }

  return out;
}

async function audit(
  s: Row,
  input: {
    actorUserId: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  const res = await s.from("audit_events").insert({
    actor_user_id: input.actorUserId,
    entity_type: ENTITY,
    entity_id: input.entityId,
    action: input.action,
    before_state: input.before ?? null,
    after_state: input.after ?? null,
  });
  check(res);
}

/** Mark a pair as two distinct people. Permanently suppresses that pair. */
export async function markPersonsDistinct(
  a: Admin,
  input: { personAId: string; personBId: string; note: string | null; actorUserId: string },
): Promise<{ ok: true }> {
  const s = a as unknown as Row;
  const [aId, bId] = orderedPair(input.personAId, input.personBId);
  const res = await s
    .from("duplicate_person_decisions")
    .insert({
      person_a_id: aId,
      person_b_id: bId,
      decision: "distinct",
      note: input.note,
      decided_by: input.actorUserId,
    })
    .select("id")
    .single();
  check(res);
  await audit(s, {
    actorUserId: input.actorUserId,
    entityId: aId,
    action: "duplicate_marked_distinct",
    after: { person_a_id: aId, person_b_id: bId, decision_id: res.data?.["id"], note: input.note },
  });
  return { ok: true };
}

/**
 * Merge two people into one. Identifiers (including candidate_profile links)
 * move onto the surviving person so every application and history row is
 * reachable under a single person. Nothing is deleted.
 */
export async function mergePersons(
  a: Admin,
  input: { keepPersonId: string; mergePersonId: string; note: string | null; actorUserId: string },
): Promise<{ ok: true; moved: number }> {
  const s = a as unknown as Row;
  if (input.keepPersonId === input.mergePersonId) throw new Error("same_person");

  const personsRes = await s
    .from("talent_persons")
    .select("id, merged_into_id, display_name, primary_email")
    .in("id", [input.keepPersonId, input.mergePersonId]);
  check(personsRes);
  const persons: Row[] = personsRes.data ?? [];
  if (persons.length !== 2) throw new Error("person_not_found");
  if (persons.some((p) => p["merged_into_id"])) throw new Error("already_merged");

  const [keepIdsRes, loseIdsRes] = await Promise.all([
    s.from("talent_person_identifiers").select("id, kind, value").eq("person_id", input.keepPersonId),
    s.from("talent_person_identifiers").select("id, kind, value").eq("person_id", input.mergePersonId),
  ]);
  check(keepIdsRes);
  check(loseIdsRes);

  const existing = new Set(
    ((keepIdsRes.data ?? []) as Row[]).map((r) => `${r["kind"]}:${String(r["value"] ?? "").toLowerCase()}`),
  );
  const movable = ((loseIdsRes.data ?? []) as Row[]).filter(
    (r) => !existing.has(`${r["kind"]}:${String(r["value"] ?? "").toLowerCase()}`),
  );
  const movedIds = movable.map((r) => r["id"] as string);

  if (movedIds.length) {
    const upd = await s
      .from("talent_person_identifiers")
      .update({ person_id: input.keepPersonId, last_seen_at: new Date().toISOString() })
      .in("id", movedIds);
    check(upd);
  }

  const mark = await s
    .from("talent_persons")
    .update({ merged_into_id: input.keepPersonId })
    .eq("id", input.mergePersonId);
  check(mark);

  const [aId, bId] = orderedPair(input.keepPersonId, input.mergePersonId);
  const decision = await s
    .from("duplicate_person_decisions")
    .insert({
      person_a_id: aId,
      person_b_id: bId,
      decision: "merged",
      merged_into_id: input.keepPersonId,
      moved_identifier_ids: movedIds,
      note: input.note,
      decided_by: input.actorUserId,
    })
    .select("id")
    .single();
  check(decision);

  await audit(s, {
    actorUserId: input.actorUserId,
    entityId: input.mergePersonId,
    action: "duplicate_merged",
    before: { merged_into_id: null },
    after: {
      merged_into_id: input.keepPersonId,
      moved_identifier_ids: movedIds,
      decision_id: decision.data?.["id"],
      note: input.note,
    },
  });

  return { ok: true, moved: movedIds.length };
}

/** Undo a merge or a distinct decision. Platform admin only. */
export async function revertDuplicateDecision(
  a: Admin,
  input: { decisionId: string; actorUserId: string },
): Promise<{ ok: true }> {
  const s = a as unknown as Row;
  const res = await s
    .from("duplicate_person_decisions")
    .select("id, person_a_id, person_b_id, decision, merged_into_id, moved_identifier_ids, reverted_at")
    .eq("id", input.decisionId)
    .single();
  check(res);
  const row = res.data as Row;
  if (row["reverted_at"]) throw new Error("already_reverted");

  if (row["decision"] === "merged") {
    const keep = row["merged_into_id"] as string;
    const loser = (row["person_a_id"] as string) === keep ? (row["person_b_id"] as string) : (row["person_a_id"] as string);
    const movedIds = (row["moved_identifier_ids"] as string[]) ?? [];
    if (movedIds.length) {
      const back = await s
        .from("talent_person_identifiers")
        .update({ person_id: loser })
        .in("id", movedIds);
      check(back);
    }
    const unmark = await s.from("talent_persons").update({ merged_into_id: null }).eq("id", loser);
    check(unmark);
  }

  const upd = await s
    .from("duplicate_person_decisions")
    .update({ reverted_at: new Date().toISOString(), reverted_by: input.actorUserId })
    .eq("id", input.decisionId);
  check(upd);

  await audit(s, {
    actorUserId: input.actorUserId,
    entityId: row["person_b_id"] as string,
    action: "duplicate_decision_reverted",
    before: { decision: row["decision"], decision_id: row["id"] },
    after: { reverted: true },
  });

  return { ok: true };
}
