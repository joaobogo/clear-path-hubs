// Admin candidate dossier — candidate-provided intake answers, admin notes
// (internal vs client-visible), contact release control, duplicate signals,
// document pipeline state and audit history. Read from live records only.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCandidateDossier,
  addCandidateNote,
  deleteCandidateNote,
  setContactRelease,
} from "@/lib/admin-candidates.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Unlock, Trash2, Users, AlertTriangle } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function Section({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminDossier({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const dossierFn = useServerFn(getCandidateDossier);
  const addNoteFn = useServerFn(addCandidateNote);
  const delNoteFn = useServerFn(deleteCandidateNote);
  const releaseFn = useServerFn(setContactRelease);

  const key = ["candidate-dossier", matchId];
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: () => dossierFn({ data: { match_id: matchId } }),
  });

  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "client_visible">("internal");
  const [releaseReason, setReleaseReason] = useState("");

  const addNote = useMutation({
    mutationFn: () =>
      addNoteFn({
        data: { match_id: matchId, body: noteBody.trim(), visibility: noteVisibility },
      }),
    onSuccess: () => {
      setNoteBody("");
      toast.success("Note saved");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delNote = useMutation({
    mutationFn: (note_id: string) => delNoteFn({ data: { note_id, match_id: matchId } }),
    onSuccess: () => {
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: (released: boolean) =>
      releaseFn({ data: { match_id: matchId, released, reason: releaseReason.trim() || undefined } }),
    onSuccess: (r) => {
      setReleaseReason("");
      toast.success(r.released ? "Contact details released" : "Contact release revoked");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["admin-candidate", matchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading dossier…</div>;
  }

  const { match, profile, application, answers, notes, audit, interviews, documents, duplicates } =
    data as Any;

  const internalNotes = (notes as Any[]).filter((n) => n.visibility === "internal");
  const clientNotes = (notes as Any[]).filter((n) => n.visibility === "client_visible");
  const released = Boolean(match.contact_released_at);
  const published = match.client_visibility === "visible";

  return (
    <div className="space-y-4">
      {/* Identity & contact */}
      <Section
        title="Identity and contact"
        hint="Source of truth for candidate-supplied details."
      >
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Field label="Full name" value={profile?.full_name} />
          <Field label="Email" value={profile?.email} />
          <Field label="Phone" value={profile?.phone} />
          <Field
            label="Location"
            value={
              [profile?.city, profile?.region, profile?.country].filter(Boolean).join(", ") ||
              profile?.location
            }
          />
          <Field label="LinkedIn" value={profile?.linkedin_url} link />
          <Field label="Portfolio" value={profile?.portfolio_url ?? application?.portfolio_url} link />
          <Field
            label="Applied"
            value={application?.applied_at ? new Date(application.applied_at).toLocaleString() : null}
          />
          <Field label="Source" value={application?.source_kind ?? application?.source} />
        </dl>
      </Section>

      {/* Contact release */}
      <Section
        title="Contact release"
        hint="Publishing shows the profile. Releasing contact details is a separate, audited permission."
        action={
          <Badge variant={released ? "default" : "outline"} className="gap-1">
            {released ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {released ? "Released" : "Withheld"}
          </Badge>
        }
      >
        {released ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Released {new Date(match.contact_released_at).toLocaleString()}
              {match.contact_release_reason ? ` — ${match.contact_release_reason}` : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={release.isPending}
              onClick={() => release.mutate(false)}
            >
              Revoke contact release
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!published && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Not published yet</AlertTitle>
                <AlertDescription>
                  Publish this candidate to the client before releasing contact details.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="release-reason">Reason (required, recorded in audit)</Label>
              <Input
                id="release-reason"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="e.g. Client confirmed interview slot"
              />
            </div>
            <Button
              size="sm"
              disabled={!published || !releaseReason.trim() || release.isPending}
              onClick={() => release.mutate(true)}
            >
              Release contact details
            </Button>
          </div>
        )}
      </Section>

      {/* Intake answers */}
      <Section
        title="Candidate intake answers"
        hint="Exactly as submitted by the candidate. Never edited."
      >
        {(answers as Any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No screening answers on file.</p>
        ) : (
          <ul className="space-y-3">
            {(answers as Any[]).map((a) => {
              const q = a.screening_questions;
              return (
                <li key={a.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{q?.question ?? "Question"}</p>
                    {q?.dealbreaker && (
                      <Badge variant="destructive" className="text-xs">
                        Critical
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {typeof a.answer === "string" ? a.answer : JSON.stringify(a.answer)}
                  </p>
                  {q?.preferred_answer != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Preferred: {String(q.preferred_answer)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {application?.cover_letter && (
          <div className="mt-3 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cover letter
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{application.cover_letter}</p>
          </div>
        )}
      </Section>

      {/* Notes */}
      <Section
        title="Notes"
        hint="Internal notes stay with the delivery team. Client-visible notes are shown in the client workspace."
      >
        <div className="space-y-2">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            aria-label="Note body"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={noteVisibility}
              onValueChange={(v) => setNoteVisibility(v as "internal" | "client_visible")}
            >
              <SelectTrigger className="w-[220px]" aria-label="Note visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal only</SelectItem>
                <SelectItem value="client_visible">Visible to client</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={noteBody.trim().length < 2 || addNote.isPending}
              onClick={() => addNote.mutate()}
            >
              Save note
            </Button>
            {noteVisibility === "client_visible" && (
              <span className="text-xs text-muted-foreground">
                This note will be readable by the client.
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NoteColumn
            title="Internal notes"
            tone="border-muted"
            notes={internalNotes}
            onDelete={(id) => delNote.mutate(id)}
          />
          <NoteColumn
            title="Client-visible notes"
            tone="border-primary/40"
            notes={clientNotes}
            onDelete={(id) => delNote.mutate(id)}
          />
        </div>
      </Section>

      {/* Duplicates */}
      {(duplicates as Any[]).length > 0 && (
        <Section
          title="Possible duplicate profiles"
          hint="Surfaced for manual review. Nothing is merged automatically."
        >
          <ul className="space-y-2">
            {(duplicates as Any[]).map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{d.full_name ?? "Unnamed"}</span>
                  <span className="text-muted-foreground">{d.email}</span>
                </span>
                <span className="flex gap-1">
                  {d.reasons.map((r: string) => (
                    <Badge key={r} variant="outline" className="text-xs">
                      {r}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Documents */}
      <Section title="Documents" hint="Canonical PDF and parsing pipeline state.">
        {(documents as Any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents on file.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(documents as Any[]).map((f) => (
              <li key={f.id} className="rounded-md border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate font-medium">{f.filename}</span>
                  <Badge
                    variant={f.parse_state === "failed" ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {(f.parse_state ?? "unknown").replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {f.page_count ? `${f.page_count} pages · ` : ""}
                  {f.parser ? `${f.parser}${f.parser_version ? ` v${f.parser_version}` : ""} · ` : ""}
                  {new Date(f.created_at).toLocaleString()}
                </p>
                {f.parse_error && (
                  <p className="mt-1 text-xs text-destructive">{f.parse_error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Interviews */}
      <Section title="Interviews">
        {(interviews as Any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No interviews scheduled.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(interviews as Any[]).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span>
                  {(i.interview_type ?? "Interview").replace(/_/g, " ")} ·{" "}
                  <span className="text-muted-foreground">
                    {i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : "unscheduled"}
                  </span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {(i.status ?? "").replace(/_/g, " ")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Audit */}
      <Section title="Audit history" hint="Most recent 50 recorded actions on this submission.">
        {(audit as Any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit records yet.</p>
        ) : (
          <ol className="space-y-1.5 text-sm">
            {(audit as Any[]).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 border-b pb-1.5">
                <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function NoteColumn({
  title,
  notes,
  tone,
  onDelete,
}: {
  title: string;
  notes: Any[];
  tone: string;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-md border-l-2 bg-muted/20 p-2 ${tone}`}>
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() => onDelete(n.id)}
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  link,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate">
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}
