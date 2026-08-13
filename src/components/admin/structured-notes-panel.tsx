import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Eye, EyeOff, Pencil } from "lucide-react";
import { createNote, listNotes, reviseNote } from "@/lib/structured-notes.functions";
import {
  NOTE_TYPES,
  noteTypeLabel,
  withinEditWindow,
  type NoteTargetKind,
  type NoteType,
  type StructuredNote,
} from "@/lib/notes/structured-notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { toastError } from "@/lib/toast-error";

type Props = {
  targetKind: NoteTargetKind;
  targetId: string;
  title?: string;
};

export function StructuredNotesPanel({ targetKind, targetId, title = "Recruiter notes" }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listNotes);
  const add = useServerFn(createNote);
  const revise = useServerFn(reviseNote);

  const target = useMemo(() => ({ kind: targetKind, id: targetId }), [targetKind, targetId]);
  const queryKey = ["structured-notes", targetKind, targetId];

  const notesQuery = useQuery({
    queryKey,
    queryFn: () => list({ data: { target } }),
  });

  const [body, setBody] = useState("");
  const [noteType, setNoteType] = useState<NoteType | "">("");
  const [shareable, setShareable] = useState(false);
  const [filter, setFilter] = useState<NoteType | "all">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editShareable, setEditShareable] = useState(false);

  const addMutation = useMutation({
    mutationFn: async () =>
      add({
        data: { target, body, noteType: noteType as NoteType, clientShareable: shareable },
      }),
    onSuccess: async () => {
      // Only clear the draft once the write is confirmed.
      setBody("");
      setNoteType("");
      setShareable(false);
      await qc.invalidateQueries({ queryKey });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't add. Nothing was saved — please try again." }),
  });

  const editMutation = useMutation({
    mutationFn: async (note: StructuredNote) =>
      revise({
        data: {
          target,
          source: note.source,
          id: note.id,
          body: editBody,
          clientShareable: editShareable,
        },
      }),
    onSuccess: async () => {
      setEditingId(null);
      setEditBody("");
      await qc.invalidateQueries({ queryKey });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't edit. Nothing was saved — please try again." }),
  });

  const notes = (notesQuery.data?.notes ?? []) as StructuredNote[];
  const visible = filter === "all" ? notes : notes.filter((n) => n.note_type === filter);
  const canSubmit = body.trim().length >= 2 && noteType !== "" && !addMutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as NoteType | "all")}>
            <SelectTrigger className="h-8 w-40" aria-label="Filter notes by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {NOTE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Every note needs a type. Only notes marked shareable can be used in a client update — the rest
          stay staff-internal.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Composer — always visible, including in the empty and error states. */}
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="What happened, what it means, what happens next…"
            aria-label="Note body"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
              <SelectTrigger className="w-44" aria-label="Note type (required)">
                <SelectValue placeholder="Note type (required)" />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id="note-shareable"
                checked={shareable}
                onCheckedChange={(v) => setShareable(v === true)}
              />
              <Label htmlFor="note-shareable" className="text-xs font-normal">
                Safe to share with the client
              </Label>
            </div>

            <Button size="sm" disabled={!canSubmit} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Saving…" : "Add note"}
            </Button>
          </div>

          {noteType === "" && body.trim().length >= 2 ? (
            <p className="text-xs text-muted-foreground">Pick a note type to save.</p>
          ) : null}

          {addMutation.isError ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Save failed. Your text is still here.</span>
              <Button size="sm" variant="outline" onClick={() => addMutation.mutate()}>
                Retry save
              </Button>
            </div>
          ) : null}
        </div>

        {/* List */}
        <PanelState
          query={notesQuery}
          isEmpty={visible.length === 0}
          empty={
            <PanelEmpty
              title={notes.length === 0 ? "No notes yet" : `No ${noteTypeLabel(filter).toLowerCase()} notes yet`}
            />
          }
        >
          <ul className="space-y-3">
            {visible.map((n) => {
              const stillEditable = n.is_mine && withinEditWindow(n.created_at);
              const isEditing = editingId === n.id;
              return (
                <li key={`${n.source}:${n.id}`} className="rounded-md border border-border/60 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={n.note_type === "risk" ? "destructive" : "secondary"}>
                      {noteTypeLabel(n.note_type)}
                    </Badge>
                    {n.client_shareable ? (
                      <Badge variant="outline" className="gap-1">
                        <Eye className="h-3 w-3" /> Client-shareable
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <EyeOff className="h-3 w-3" /> Internal
                      </Badge>
                    )}
                    {n.revision_number > 1 ? (
                      <Badge variant="outline">Revision {n.revision_number}</Badge>
                    ) : null}
                    <span>{n.author_name}</span>
                    <span>·</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.edited_at ? <span>· edited</span> : null}
                    {(stillEditable || n.is_mine) && !isEditing ? (
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 underline hover:text-foreground"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditBody(n.body);
                          setEditShareable(n.client_shareable);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        {stillEditable ? "Edit" : "Add revision"}
                      </button>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        maxLength={4000}
                        aria-label="Edit note body"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`shareable-${n.id}`}
                            checked={editShareable}
                            onCheckedChange={(v) => setEditShareable(v === true)}
                          />
                          <Label htmlFor={`shareable-${n.id}`} className="text-xs font-normal">
                            Safe to share with the client
                          </Label>
                        </div>
                        <Button
                          size="sm"
                          disabled={editBody.trim().length < 2 || editMutation.isPending}
                          onClick={() => editMutation.mutate(n)}
                        >
                          {editMutation.isPending ? "Saving…" : stillEditable ? "Save edit" : "Save revision"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null);
                            setEditBody("");
                          }}
                        >
                          Cancel
                        </Button>
                        {!stillEditable ? (
                          <span className="text-xs text-muted-foreground">
                            The 15-minute edit window has passed — this saves a new revision.
                          </span>
                        ) : null}
                      </div>
                      {editMutation.isError ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Save failed. Your text is still here.</span>
                          <Button size="sm" variant="outline" onClick={() => editMutation.mutate(n)}>
                            Retry save
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </PanelState>
      </CardContent>
    </Card>
  );
}
