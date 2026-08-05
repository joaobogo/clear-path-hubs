import { Pencil } from "lucide-react";
import type { IntakeMissingField, IntakeReview, IntakeReviewRow } from "@/lib/intake-review";

/**
 * The pre-submit review: the whole brief on one screen, every row editable
 * without losing the rest of the answers.
 */
export function IntakeReviewPanel({
  review,
  loading = false,
  onEdit,
}: {
  review: IntakeReview;
  loading?: boolean;
  /** Sends the client back to the step and control the row came from. */
  onEdit: (target: { step: number; focusLabel: string | null; field: string }) => void;
}) {
  if (loading) {
    return (
      <div aria-busy className="space-y-4" data-testid="review-skeleton">
        {[0, 1, 2].map((g) => (
          <div key={g} className="rounded-lg border border-[color:var(--brand-navy)]/12 p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-[color:var(--brand-navy)]/10" />
            <div className="mt-3 space-y-2">
              {[0, 1].map((r) => (
                <div key={r} className="grid gap-1 sm:grid-cols-[160px_1fr]">
                  <div className="h-3 w-28 animate-pulse rounded bg-[color:var(--brand-navy)]/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-[color:var(--brand-navy)]/10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="intake-review">
      {review.missing.length > 0 && (
        <MissingList missing={review.missing} onEdit={onEdit} />
      )}

      {review.groups.length === 0 ? (
        <p className="text-sm text-[color:var(--brand-navy)]/75">
          Nothing filled in yet — your answers appear here as you add them.
        </p>
      ) : (
        review.groups.map((group) => (
          <div
            key={group.step}
            className="rounded-lg border border-[color:var(--brand-navy)]/12 p-4"
            data-testid={`review-group-${group.step}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <EditLink
                label={`Edit ${group.title}`}
                onClick={() =>
                  onEdit({
                    step: group.step,
                    focusLabel: group.rows[0]?.focusLabel ?? null,
                    field: group.rows[0]?.field ?? "",
                  })
                }
              />
            </div>
            <dl className="mt-3 space-y-2">
              {group.rows.map((r) => (
                <ReviewRow key={r.field} row={r} onEdit={onEdit} />
              ))}
            </dl>
          </div>
        ))
      )}
    </div>
  );
}

function ReviewRow({
  row,
  onEdit,
}: {
  row: IntakeReviewRow;
  onEdit: (target: { step: number; focusLabel: string | null; field: string }) => void;
}) {
  return (
    <div
      className="grid gap-1 sm:grid-cols-[160px_1fr_auto] sm:items-baseline"
      data-testid={`review-row-${row.field}`}
    >
      <dt className="text-xs uppercase tracking-wide text-[color:var(--brand-navy)]/75">
        {row.label}
      </dt>
      <dd className="text-sm whitespace-pre-wrap break-words">{row.value}</dd>
      <EditLink
        label={`Edit ${row.label}`}
        onClick={() => onEdit({ step: row.step, focusLabel: row.focusLabel, field: row.field })}
      />
    </div>
  );
}

function MissingList({
  missing,
  onEdit,
}: {
  missing: IntakeMissingField[];
  onEdit: (target: { step: number; focusLabel: string | null; field: string }) => void;
}) {
  return (
    <div
      role="alert"
      data-testid="review-missing"
      className="rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-4"
    >
      <p className="text-sm font-semibold">
        {missing.length === 1
          ? "One required answer is still missing."
          : `${missing.length} required answers are still missing.`}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {missing.map((m) => (
          <li key={m.field}>
            <button
              type="button"
              className="underline"
              onClick={() => onEdit({ step: m.step, focusLabel: m.focusLabel, field: m.field })}
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[color:var(--brand-navy)]/70">
        You can submit as soon as these are filled in. Everything else you have typed is kept.
      </p>
    </div>
  );
}

function EditLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-1 text-sm underline text-[color:var(--brand-navy)]/70"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden />
      Edit
    </button>
  );
}
