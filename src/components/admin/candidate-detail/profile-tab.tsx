// Default tab for the candidate workspace: profile + AI briefing.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/admin/candidate-detail/primitives";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
import { formatWorkAuthorization } from "@/lib/human-labels";
import { updateCandidateProfileField } from "@/lib/admin-candidates.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export // ── Profile ────────────────────────────────────────────────────────────────
function ProfileTab({
  cp,
  pos,
  m,
  siblings,
  evidence,
}: {
  cp: Any;
  pos: Any;
  m: Any;
  siblings: Any[];
  evidence: Any;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-candidate", m.id] });
  };

  const startEdit = (field: string, current: string | null) => {
    setEditing((prev) => ({ ...prev, [field]: true }));
    setDrafts((prev) => ({ ...prev, [field]: current ?? "" }));
  };

  const cancelEdit = (field: string) => {
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  const saveField = async (field: "linkedin_url" | "location") => {
    const value = drafts[field]?.trim() || null;
    setSaving((prev) => ({ ...prev, [field]: true }));
    try {
      const result = await updateCandidateProfileField({
        data: {
          candidate_profile_id: cp.id,
          [field]: value,
        },
      });
      if (result.ok) {
        toast.success(`${field === "linkedin_url" ? "LinkedIn" : "Location"} saved`);
        await invalidate();
      } else {
        toast.error("Save failed");
      }
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving((prev) => ({ ...prev, [field]: false }));
      setEditing((prev) => ({ ...prev, [field]: false }));
    }
  };

  const linkedInDisplay = cp?.linkedin_url ? (
    <a href={cp.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      Profile ↗
    </a>
  ) : null;

  const insights = evidence?.extracted?.insights as Any | null;
  return (
    <div className="space-y-4">
      {insights && <InsightsBriefing insights={insights} />}
      <div className="grid gap-4 lg:grid-cols-2">

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Candidate profile</h2>
        <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
          <Row label="Headline" v={cp?.headline} />
          <EditableRow
            label="Location"
            value={cp?.location}
            editing={editing.location}
            saving={saving.location}
            draft={drafts.location ?? ""}
            onEdit={() => startEdit("location", cp?.location)}
            onCancel={() => cancelEdit("location")}
            onDraftChange={(v) => setDrafts((prev) => ({ ...prev, location: v }))}
            onSave={() => saveField("location")}
          />
          <Row label="Timezone" v={cp?.timezone} />
          <Row label="Availability" v={cp?.availability} />
          <Row label="Experience" v={cp?.years_experience != null ? `${cp.years_experience} yrs` : null} />
          <Row label="Phone" v={cp?.phone} />
          <EditableRow
            label="LinkedIn"
            value={cp?.linkedin_url}
            display={linkedInDisplay}
            editing={editing.linkedin_url}
            saving={saving.linkedin_url}
            draft={drafts.linkedin_url ?? ""}
            onEdit={() => startEdit("linkedin_url", cp?.linkedin_url)}
            onCancel={() => cancelEdit("linkedin_url")}
            onDraftChange={(v) => setDrafts((prev) => ({ ...prev, linkedin_url: v }))}
            onSave={() => saveField("linkedin_url")}
          />
          <Row label="Work auth" v={formatWorkAuthorization(cp?.work_authorization)} />
          <Row label="Consent" v={cp?.consent?.terms ? "Given" : "Not recorded"} />
        </dl>
        {cp?.summary && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{cp.summary}</p>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Submission &amp; position</h2>
          <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
            <Row label="Application" v={<span className="font-mono text-xs">{m.application_id?.slice(0, 8)}…</span>} />
            <Row label="Submitted" v={m.created_at ? new Date(m.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }) : null} />
            <Row label="Stage" v={(m.stage ?? "—").replace(/_/g, " ")} />
            <Row label="Position" v={<Link to="/admin/positions/$id" params={{ id: pos?.id ?? "" }} className="text-primary hover:underline">{pos?.title}</Link>} />
            <Row label="Position status" v={pos?.status} />
            <Row label="Client" v={pos?.organizations?.name} />
          </dl>
        </div>

        {siblings && siblings.length > 1 && (
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Other applications by this candidate</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {siblings.filter((s) => s.id !== m.id).map((s) => (
                <li key={s.id}>
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: s.id }}
                    className="text-primary hover:underline"
                  >
                    {s.position_title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function EditableRow({
  label,
  value,
  display,
  editing,
  saving,
  draft,
  onEdit,
  onCancel,
  onDraftChange,
  onSave,
}: {
  label: string;
  value: string | null;
  display?: React.ReactNode;
  editing: boolean;
  saving: boolean;
  draft: string;
  onEdit: () => void;
  onCancel: () => void;
  onDraftChange: (v: string) => void;
  onSave: () => void;
}) {
  if (!editing) {
    return (
      <>
        <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {label}
          <button
            onClick={onEdit}
            className="text-[10px] text-primary hover:underline"
            type="button"
          >
            Edit
          </button>
        </dt>
        <dd>
          {display ?? value ?? <span className="text-muted-foreground">Not provided</span>}
        </dd>
      </>
    );
  }

  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={label === "LinkedIn" ? "https://linkedin.com/in/..." : "City, Country"}
          className="h-8 text-sm"
          disabled={saving}
        />
        <Button
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving" : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
      </dd>
    </>
  );
}

function InsightsBriefing({ insights }: { insights: Any }) {
  const rec = String(insights?.overall_recommendation ?? "consider");
  const recTone =
    rec === "advance" ? "bg-success/15 text-success dark:text-success"
    : rec === "reject" ? "bg-destructive/15 text-destructive"
    : "bg-warning/15 text-warning-foreground dark:text-warning-foreground";
  const highlights: string[] = Array.isArray(insights?.highlights) ? insights.highlights : [];
  const strengths: Any[] = Array.isArray(insights?.strengths) ? insights.strengths : [];
  const concerns: Any[] = Array.isArray(insights?.concerns) ? insights.concerns : [];
  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Candidate briefing</h2>
        <Badge variant="secondary" className="capitalize">
          {String(insights?.seniority ?? "unknown")}
        </Badge>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${recTone}`}>
          {rec}
        </span>
        {typeof insights?.confidence === "number" && (
          <span className="text-xs text-muted-foreground">
            confidence {Math.round(insights.confidence * 100)}%
          </span>
        )}
      </div>
      {insights?.headline_suggested && (
        <p className="mt-2 text-sm font-medium text-foreground">{insights.headline_suggested}</p>
      )}
      {insights?.pitch_summary && (
        <div
          className={`mt-3 rounded-md border-l-4 p-3 text-sm leading-relaxed ${
            insights.pitch_tone === "sell"
              ? "border-success bg-success/10 text-foreground"
              : insights.pitch_tone === "cautious"
                ? "border-destructive bg-destructive/10 text-foreground"
                : "border-warning bg-warning/10 text-foreground"
          }`}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {insights.pitch_tone === "sell"
              ? "Northwind Talent's pitch"
              : insights.pitch_tone === "cautious"
                ? "Honest read"
                : "Balanced view"}
          </div>
          {insights.pitch_summary}
        </div>
      )}
      {insights?.narrative && (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {insights.narrative}
        </div>
      )}
      {highlights.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Highlights
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </>
      )}
      {(strengths.length > 0 || concerns.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-background/60 p-3">
            <h4 className="text-xs font-semibold uppercase text-success dark:text-success">
              Why they fit
            </h4>
            <ul className="mt-2 space-y-2 text-sm">
              {strengths.length === 0 && <li className="text-muted-foreground">None surfaced.</li>}
              {strengths.map((s, i) => (
                <li key={i}>
                  <div className="font-medium">{s.title}</div>
                  {s.detail && <div className="text-xs text-muted-foreground">{s.detail}</div>}
                  {s.cv_quote && (
                    <div className="mt-1 border-l-2 border-success/40 pl-2 text-xs italic text-muted-foreground">
                      "{s.cv_quote}"
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <h4 className="text-xs font-semibold uppercase text-destructive">
              Where they may fall short
            </h4>
            <ul className="mt-2 space-y-2 text-sm">
              {concerns.length === 0 && <li className="text-muted-foreground">None flagged.</li>}
              {concerns.map((c, i) => (
                <li key={i}>
                  <div className="font-medium">{c.title}</div>
                  {c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
