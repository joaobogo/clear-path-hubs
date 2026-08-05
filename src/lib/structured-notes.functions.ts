// Staff-gated server functions for structured recruiter notes.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { NOTE_TYPE_VALUES } from "@/lib/notes/structured-notes";

const target = z.object({
  kind: z.enum(["candidate_match", "position"]),
  id: z.string().uuid(),
});

const noteType = z.enum(NOTE_TYPE_VALUES as [string, ...string[]]);

export const listNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ target }).parse(raw))
  .handler(async ({ data, context }) => {
    const { requireStaff, staffClient, listStructuredNotes } = await import(
      "@/lib/notes/notes-access.server"
    );
    await requireStaff(context.userId);
    const s = await staffClient();
    return { notes: await listStructuredNotes(s, data.target, context.userId) };
  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        target,
        body: z.string().trim().min(2).max(4000),
        noteType,
        clientShareable: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, staffClient, addStructuredNote, writeNoteAudit } = await import(
      "@/lib/notes/notes-access.server"
    );
    await requireStaff(context.userId);
    const s = await staffClient();
    const result = await addStructuredNote(
      s,
      {
        target: data.target,
        body: data.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        noteType: data.noteType as any,
        clientShareable: data.clientShareable,
      },
      context.userId,
    );
    await writeNoteAudit(s, {
      actor: context.userId,
      action: "note_added",
      entityType: data.target.kind,
      entityId: data.target.id,
      organizationId: result.organization_id,
      after: {
        note_id: result.note_id,
        note_type: data.noteType,
        client_shareable: data.clientShareable,
      },
    });
    return { ok: true as const, note_id: result.note_id };
  });

export const reviseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        target,
        source: z.enum(["candidate_notes", "internal_notes"]),
        id: z.string().uuid(),
        body: z.string().trim().min(2).max(4000),
        clientShareable: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, staffClient, editStructuredNote, writeNoteAudit } = await import(
      "@/lib/notes/notes-access.server"
    );
    await requireStaff(context.userId);
    const s = await staffClient();
    const result = await editStructuredNote(
      s,
      { source: data.source, id: data.id, body: data.body, clientShareable: data.clientShareable },
      context.userId,
    );
    await writeNoteAudit(s, {
      actor: context.userId,
      action: result.mode === "revision" ? "note_revised" : "note_edited",
      entityType: data.target.kind,
      entityId: data.target.id,
      organizationId: result.organization_id,
      before: { note_id: data.id },
      after: { note_id: result.note_id, client_shareable: data.clientShareable },
    });
    return { ok: true as const, mode: result.mode };
  });
