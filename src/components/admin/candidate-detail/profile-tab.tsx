// Default tab for the candidate workspace: profile + AI briefing.
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Row } from "@/components/admin/candidate-detail/primitives";

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
  const insights = evidence?.extracted?.insights as Any | null;
  return (
    <div className="space-y-4">
      {insights && <InsightsBriefing insights={insights} />}
      <div className="grid gap-4 lg:grid-cols-2">

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Candidate profile</h2>
        <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
          <Row label="Headline" v={cp?.headline} />
          <Row label="Location" v={cp?.location} />
          <Row label="Timezone" v={cp?.timezone} />
          <Row label="Availability" v={cp?.availability} />
          <Row label="Experience" v={cp?.years_experience != null ? `${cp.years_experience} yrs` : null} />
          <Row label="Phone" v={cp?.phone} />
          <Row label="LinkedIn" v={cp?.linkedin_url && <a href={cp.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Profile ↗</a>} />
          <Row label="Work auth" v={typeof cp?.work_authorization === "string" ? cp.work_authorization : cp?.work_authorization ? JSON.stringify(cp.work_authorization) : null} />
          <Row label="Consent" v={cp?.consent ? "Given" : "Not recorded"} />
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
            <Row label="Submitted" v={m.created_at ? new Date(m.created_at).toLocaleString() : null} />
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
              ? "Recruiter pitch"
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

