import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addInternalNote,
  deleteInternalNote,
  listInternalNotes,
} from "@/lib/admin-workbench.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EntityType = "position" | "candidate_match" | "organization";

const KINDS = [
  { value: "note", label: "Note" },
  { value: "handoff", label: "Handoff" },
  { value: "risk", label: "Risk" },
  { value: "decision", label: "Decision" },
] as const;

export function InternalNotes({
  entityType,
  entityId,
  organizationId,
  title = "Internal notes and handoff",
}: {
  entityType: EntityType;
  entityId: string;
  organizationId?: string | null;
  title?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listInternalNotes);
  const addFn = useServerFn(addInternalNote);
  const delFn = useServerFn(deleteInternalNote);

  const [body, setBody] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("note");

  const key = ["internal-notes", entityType, entityId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { entityType, entityId } }),
  });

  const add = useMutation({
    mutationFn: async () =>
      addFn({
        data: {
          entityType,
          entityId,
          organizationId: organizationId ?? null,
          body,
          kind,
          pinned: kind === "handoff",
        },
      }),
    onSuccess: async () => {
      setBody("");
      setKind("note");
      await qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: key }),
  });

  const notes = data?.notes ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Staff only. Never shown to clients or candidates. Write enough that a colleague can pick this up cold.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="What has happened, what is blocked, what happens next…"
            aria-label="Internal note"
          />
          <div className="flex items-center gap-2">
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="w-40" aria-label="Note type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={body.trim().length < 2 || add.isPending}
              onClick={() => add.mutate()}
            >
              {add.isPending ? "Saving…" : "Add note"}
            </Button>
            {add.isError ? (
              <span className="text-xs text-destructive">{(add.error as Error).message}</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading notes…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No internal notes yet. The first handoff note is the most useful one.
            </p>
          ) : (
            notes.map((n: any) => (
              <div key={n.id} className="rounded-md border border-border/60 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={n.kind === "risk" ? "destructive" : "secondary"}>{n.kind}</Badge>
                  {n.pinned ? <Badge variant="outline">Pinned</Badge> : null}
                  <span>{n.author_name}</span>
                  <span>·</span>
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.is_mine ? (
                    <button
                      type="button"
                      className="ml-auto underline hover:text-foreground"
                      onClick={() => remove.mutate(n.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
