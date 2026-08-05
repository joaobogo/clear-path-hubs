// Server-side structured note reads/writes. Staff-only; called from
// src/lib/structured-notes.functions.ts.
import {
  NOTE_EDIT_WINDOW_MS,
  type NoteTargetKind,
  type NoteType,
  type StructuredNote,
} from "./structured-notes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const KIND_FOR_TYPE: Record<NoteType, string> = {
  screening: "note",
  client_feedback: "decision",
  risk: "risk",
  logistics: "handoff",
};

async function authorNames(s: AnyClient, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await s.from("profiles").select("id, full_name, email").in("id", unique);
  return Object.fromEntries(
    (data ?? []).map((p: AnyRow) => [p.id, (p.full_name as string) || (p.email as string) || "Staff"]),
  );
}

function shape(row: AnyRow, source: StructuredNote["source"], names: Record<string, string>, userId: string): StructuredNote {
  const created = new Date(row.created_at as string).getTime();
  const isMine = row.author_user_id === userId;
  return {
    id: row.id as string,
    source,
    body: row.body as string,
    note_type: row.note_type as NoteType,
    client_shareable:
      source === "candidate_notes" ? row.visibility === "client_visible" : row.client_shareable === true,
    author_user_id: (row.author_user_id as string) ?? null,
    author_name: names[row.author_user_id as string] ?? "Staff",
    is_mine: isMine,
    created_at: row.created_at as string,
    edited_at: (row.edited_at as string) ?? null,
    revision_group_id: (row.revision_group_id as string) ?? (row.id as string),
    revision_number: (row.revision_number as number) ?? 1,
    editable: isMine && Number.isFinite(created) && Date.now() - created <= NOTE_EDIT_WINDOW_MS,
  };
}

export async function listStructuredNotes(
  s: AnyClient,
  target: { kind: NoteTargetKind; id: string },
  userId: string,
): Promise<StructuredNote[]> {
  const queries: Promise<{ rows: AnyRow[]; source: StructuredNote["source"] }>[] = [];

  if (target.kind === "candidate_match") {
    queries.push(
      s
        .from("candidate_notes")
        .select(
          "id, body, note_type, visibility, author_user_id, created_at, edited_at, revision_group_id, revision_number",
        )
        .eq("candidate_match_id", target.id)
        .is("superseded_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
        .then((r: AnyRow) => {
          if (r.error) throw new Error(r.error.message);
          return { rows: (r.data ?? []) as AnyRow[], source: "candidate_notes" as const };
        }),
    );
  }

  queries.push(
    s
      .from("internal_notes")
      .select(
        "id, body, note_type, client_shareable, author_user_id, created_at, edited_at, revision_group_id, revision_number",
      )
      .eq("entity_type", target.kind)
      .eq("entity_id", target.id)
      .is("superseded_at", null)
      .order("created_at", { ascending: false })
      .limit(200)
      .then((r: AnyRow) => {
        if (r.error) throw new Error(r.error.message);
        return { rows: (r.data ?? []) as AnyRow[], source: "internal_notes" as const };
      }),
  );

  const results = await Promise.all(queries);
  const names = await authorNames(
    s,
    results.flatMap((g) => g.rows.map((r) => r.author_user_id as string)),
  );

  return results
    .flatMap((g) => g.rows.map((r) => shape(r, g.source, names, userId)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addStructuredNote(
  s: AnyClient,
  input: {
    target: { kind: NoteTargetKind; id: string };
    body: string;
    noteType: NoteType;
    clientShareable: boolean;
  },
  userId: string,
): Promise<{ note_id: string; organization_id: string | null }> {
  if (input.target.kind === "candidate_match") {
    const { data: match } = await s
      .from("candidate_matches")
      .select("id, organization_id")
      .eq("id", input.target.id)
      .maybeSingle();
    if (!match) throw new Error("not_found");
    const id = crypto.randomUUID();
    const { error } = await s.from("candidate_notes").insert({
      id,
      candidate_match_id: input.target.id,
      organization_id: match.organization_id,
      body: input.body,
      note_type: input.noteType,
      visibility: input.clientShareable ? "client_visible" : "internal",
      author_user_id: userId,
      revision_group_id: id,
      revision_number: 1,
    });
    if (error) throw new Error(error.message);
    return { note_id: id, organization_id: (match.organization_id as string) ?? null };
  }

  const { data: position } = await s
    .from("positions")
    .select("id, organization_id")
    .eq("id", input.target.id)
    .maybeSingle();
  if (!position) throw new Error("not_found");
  const id = crypto.randomUUID();
  const { error } = await s.from("internal_notes").insert({
    id,
    entity_type: "position",
    entity_id: input.target.id,
    organization_id: position.organization_id,
    body: input.body,
    kind: KIND_FOR_TYPE[input.noteType],
    note_type: input.noteType,
    client_shareable: input.clientShareable,
    pinned: input.noteType === "risk",
    author_user_id: userId,
    revision_group_id: id,
    revision_number: 1,
  });
  if (error) throw new Error(error.message);
  return { note_id: id, organization_id: (position.organization_id as string) ?? null };
}

/**
 * Inside the 15-minute window an edit rewrites the note in place. After it, the
 * original is superseded and a new revision row is written — history is never
 * overwritten.
 */
export async function editStructuredNote(
  s: AnyClient,
  input: { source: StructuredNote["source"]; id: string; body: string; clientShareable: boolean },
  userId: string,
): Promise<{ mode: "in_place" | "revision"; note_id: string; organization_id: string | null }> {
  const table = input.source;
  const { data: before } = await s.from(table).select("*").eq("id", input.id).maybeSingle();
  if (!before) throw new Error("not_found");
  if (before.author_user_id !== userId) throw new Error("forbidden");

  const now = new Date();
  const createdAt = new Date(before.created_at as string).getTime();
  const inWindow = Number.isFinite(createdAt) && now.getTime() - createdAt <= NOTE_EDIT_WINDOW_MS;
  const orgId = (before.organization_id as string) ?? null;

  const visibilityPatch =
    table === "candidate_notes"
      ? { visibility: input.clientShareable ? "client_visible" : "internal" }
      : { client_shareable: input.clientShareable };

  if (inWindow) {
    const { error } = await s
      .from(table)
      .update({ body: input.body, edited_at: now.toISOString(), ...visibilityPatch })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { mode: "in_place", note_id: input.id, organization_id: orgId };
  }

  const groupId = (before.revision_group_id as string) ?? (before.id as string);
  const { data: latest } = await s
    .from(table)
    .select("revision_number")
    .eq("revision_group_id", groupId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextRevision = ((latest?.revision_number as number) ?? 1) + 1;

  const newId = crypto.randomUUID();
  const base =
    table === "candidate_notes"
      ? {
          id: newId,
          candidate_match_id: before.candidate_match_id,
          organization_id: before.organization_id,
          note_type: before.note_type,
        }
      : {
          id: newId,
          entity_type: before.entity_type,
          entity_id: before.entity_id,
          organization_id: before.organization_id,
          kind: before.kind,
          pinned: before.pinned,
          note_type: before.note_type,
        };

  const { error: insertError } = await s.from(table).insert({
    ...base,
    body: input.body,
    author_user_id: userId,
    revision_group_id: groupId,
    revision_number: nextRevision,
    ...visibilityPatch,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: supersedeError } = await s
    .from(table)
    .update({ superseded_at: now.toISOString() })
    .eq("id", input.id);
  if (supersedeError) throw new Error(supersedeError.message);

  return { mode: "revision", note_id: newId, organization_id: orgId };
}
