// Structured screening pilot: the candidate's answers and flags, at the top of
// the admin candidate page. Shown only for a job with pilot questions.
import type { StructuredReview } from "@/lib/screening/structured.server";
import { STRUCTURED_SECTION_TITLES } from "@/lib/screening/structured";
import { Badge } from "@/components/ui/badge";

const SOURCE_LABEL: Record<string, string> = {
  cv_linkedin: "from CV or LinkedIn",
  recruiter: "entered by a recruiter",
};

export function StructuredScreeningPanel({ review }: { review: StructuredReview }) {
  const sections = (["about_you", "this_role"] as const).map((s) => ({
    key: s,
    title: STRUCTURED_SECTION_TITLES[s],
    rows: review.rows.filter((r) => r.section === s),
  }));
  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Structured screening">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Structured screening</h2>
        {review.flags.length === 0 ? (
          <Badge variant="outline" className="text-xs">
            No flags
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            {review.flags.length === 1 ? "1 flag" : `${review.flags.length} flags`}
          </Badge>
        )}
      </div>
      {review.pre_pilot && (
        <p className="mt-1 text-xs text-muted-foreground">
          Applied before these questions were introduced. Questions marked "Not asked" are neutral:
          they raise no flag and do not lower the score.
        </p>
      )}
      {review.flags.length > 0 && (
        <ul className="mt-3 space-y-1">
          {review.flags.map((f) => (
            <li key={`${f.kind}:${f.key}`} className="text-sm">
              <span className="font-medium">
                {f.kind === "must_have" ? "Must-have" : f.kind === "verify" ? "Verify" : "Pay"}:
              </span>{" "}
              {f.message}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.key}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.title}
            </p>
            <dl className="mt-1 space-y-1 text-sm">
              {s.rows.map((r) => (
                <div key={r.key} className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">{r.label}:</dt>
                  <dd
                    className={
                      r.passes === false
                        ? "font-medium text-destructive"
                        : r.status === "answered"
                          ? ""
                          : "text-muted-foreground"
                    }
                  >
                    {r.answer}
                    {r.source && SOURCE_LABEL[r.source] ? ` (${SOURCE_LABEL[r.source]})` : ""}
                    {r.staff_only ? " · staff only" : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
