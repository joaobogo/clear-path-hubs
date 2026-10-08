import { AlertCircle, Building2, CheckCircle2, ClipboardList, Coins, FileText, ListChecks, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntakeMissingField, IntakeReview, IntakeReviewRow } from "@/lib/intake-review";

type EditTarget = { step: number; focusLabel: string | null; field: string };
type OnEdit = (target: EditTarget) => void;
const SECTION_ICONS = { company: Building2, role: FileText, requirements: ListChecks, practicalities: MapPin, compensation: Coins, workflow: ClipboardList };

export function IntakeReviewPanel({
  review, loading = false, onEdit, issues = [], incomplete = [],
}: {
  review: IntakeReview;
  loading?: boolean;
  onEdit: OnEdit;
  issues?: string[];
  incomplete?: string[];
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Restoring your hiring brief" className="space-y-4" data-testid="review-skeleton">
        {[0, 1, 2].map((g) => (
          <div key={g} className="rounded-lg border border-border p-5">
            <div className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="mt-4 h-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    );
  }
  const issueCount = review.missing.length + issues.length;
  const StatusIcon = issueCount ? AlertCircle : CheckCircle2;
  return (
    <section className="min-w-0 space-y-6 text-foreground" aria-label="Review your hiring brief" data-testid="intake-review">
      <header className="space-y-3 border-b border-border pb-6">
        <h2 className="text-xl font-semibold sm:text-2xl">Review your hiring brief</h2>
        {review.headline && <p className="break-words text-base font-medium [overflow-wrap:anywhere]">{review.headline}</p>}
        <div role="status" className="flex min-w-0 items-start gap-2 text-sm">
          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {issueCount ? `${issueCount} required ${issueCount === 1 ? "issue" : "issues"} to resolve before submitting`
              : incomplete.length ? "Required answers complete · Optional details still open"
              : "Required answers complete"}
          </p>
        </div>
      </header>
      {review.missing.length > 0 && <MissingList missing={review.missing} onEdit={onEdit} />}
      {issues.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="text-sm font-semibold">Check these answers before submitting</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {issues.map((issue, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{issue}</li>)}
          </ul>
        </div>
      )}
      {review.groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your answers will appear here as you add them.</p>
      ) : (
        <div className="grid min-w-0 gap-5 md:grid-cols-2 print:block print:space-y-5">
          {review.groups.map((group) => {
            const Icon = SECTION_ICONS[group.id as keyof typeof SECTION_ICONS] ?? FileText;
            const wide = ["role", "requirements", "workflow"].includes(group.id);
            return (
              <section key={group.id} aria-labelledby={`review-heading-${group.id}`}
                className={`min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6 print:rounded-none print:shadow-none ${wide ? "md:col-span-2" : ""}`}
                data-testid={`review-group-${group.id}`}>
                <div className="flex min-w-0 items-center gap-3 border-b border-border pb-4">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h3 id={`review-heading-${group.id}`} className="min-w-0 text-base font-semibold">{group.title}</h3>
                </div>
                <dl className={`mt-4 grid min-w-0 gap-x-6 gap-y-5 ${wide ? "sm:grid-cols-2" : ""}`}>
                  {group.rows.map((r) => <ReviewRow key={r.field} row={r} onEdit={onEdit} wide={wide} />)}
                </dl>
                {group.id === "role" && group.rows.some((r) => r.field === "jdFilename") && !group.rows.some((r) => r.field === "jobDescriptionText") && (
                  <p className="mt-4 text-sm text-muted-foreground">No extracted job text is available yet. The attached document will be submitted with your brief.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ReviewRow({ row, onEdit, wide }: { row: IntakeReviewRow; onEdit: OnEdit; wide: boolean }) {
  return (
    <div className={`min-w-0 space-y-2 ${row.fullWidth && wide ? "sm:col-span-2" : ""}`} data-testid={`review-row-${row.field}`}>
      <dt className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0 break-words text-sm font-medium text-muted-foreground">{row.label}</span>
        {row.editable !== false && <EditLink label={`Edit ${row.label}`} onClick={() => onEdit({ step: row.step, focusLabel: row.focusLabel, field: row.field })} />}
      </dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">
        {row.stages ? (
          <ol className="space-y-4" aria-label="Interview sequence">
            {row.stages.map((stage, index) => (
              <li key={index} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 print:break-inside-avoid">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">{index + 1}</span>
                <div className="min-w-0">
                  <p className="font-medium"><span className="sr-only">Stage {index + 1}: </span>{stage.name || "Stage name still needed"}</p>
                  {stage.format && <p className="text-muted-foreground">Format: {stage.format}</p>}
                  {stage.owner && <p>Owner: {stage.owner}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : row.items ? (
          <ul className={`list-disc space-y-2 pl-5 ${row.field === "dealBreakerList" ? "border-t border-border pt-3" : ""}`}>
            {row.items.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        ) : row.value}
      </dd>
    </div>
  );
}

function MissingList({ missing, onEdit }: { missing: IntakeMissingField[]; onEdit: OnEdit }) {
  return (
    <div role="alert" data-testid="review-missing" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <h3 className="text-sm font-semibold">{missing.length === 1 ? "One required answer is still missing." : `${missing.length} required answers are still missing.`}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {missing.map((m) => (
          <li key={m.field}>
            <Button type="button" variant="link" className="h-auto min-h-11 max-w-full justify-start whitespace-normal px-0 text-left underline" onClick={() => onEdit(m)}>{m.label}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} aria-label={label} className="shrink-0 print:hidden">
      <Pencil aria-hidden="true" /> Edit
    </Button>
  );
}
