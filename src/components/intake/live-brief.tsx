import type { IntakeReviewGroup } from "@/lib/intake-review";
import { cn } from "@/lib/utils";

/**
 * The role brief, on paper, filling in as answers arrive (The Run, Intake).
 * It reads the same rows the review step shows, so what the client sees
 * taking shape is exactly what the recruiter will read. Under it, the three
 * reassurances in order: the workspace opens first, we confirm, only then
 * you pay.
 */
const REASSURANCES = [
  { title: "Your workspace opens first", line: "Submitting the brief opens your workspace. Nothing is charged at this point." },
  { title: "We confirm the brief with you", line: "A recruiter reads it and confirms the role, the criteria and the scope within one business day." },
  { title: "Only then you pay", line: "Sourcing starts after you approve, and the pilot is paid once, for one role." },
] as const;

export function LiveBrief({
  groups,
  step,
  roleTitle,
  companyName,
  className,
}: {
  groups: readonly IntakeReviewGroup[];
  /** Zero-based current step; its group is marked as the one being written. */
  step: number;
  roleTitle: string;
  companyName: string;
  className?: string;
}) {
  const answered = groups.reduce((n, g) => n + g.rows.length, 0);
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <article className="paper bg-white p-6 sm:p-7" aria-label="Your role brief, as it stands">
        <p className="narrow text-[13px] font-medium text-[color:var(--faint)]">
          Role brief · {answered === 0 ? "builds as you answer" : `${answered} ${answered === 1 ? "answer" : "answers"} so far`}
        </p>
        <h2 className="wide mt-2 text-[26px] font-semibold leading-[1.1] text-[color:var(--ink)]">
          {roleTitle.trim() || <span className="text-[color:var(--rule-2)]">Your role</span>}
        </h2>
        <p className="mt-1 text-[15px] text-[color:var(--slate)]">
          {companyName.trim() || <span className="text-[color:var(--rule-2)]">Your company</span>}
        </p>

        <div className="mt-5 flex flex-col gap-5">
          {groups.map((g) => {
            const writing = g.step === step;
            return (
              <section key={g.step} aria-label={g.title}>
                <h3
                  className={cn(
                    "narrow border-b pb-1 text-[13px] font-medium",
                    writing ? "border-[color:var(--blue-600)] text-[color:var(--blue-600)]" : "border-[color:var(--rule)] text-[color:var(--faint)]",
                  )}
                >
                  {g.title}
                </h3>
                {g.rows.length === 0 ? (
                  <p className="mt-2 text-sm text-[color:var(--rule-2)]" aria-hidden>
                    — — —
                  </p>
                ) : (
                  <dl className="mt-2 flex flex-col gap-1.5">
                    {g.rows.map((r) => (
                      <div key={r.field} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-sm">
                        <dt className="text-[color:var(--faint)]">{r.label}</dt>
                        <dd className="min-w-0 break-words text-[color:var(--ink)]">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            );
          })}
        </div>
      </article>

      <ol className="flex flex-col divide-y divide-[color:var(--line)]">
        {REASSURANCES.map((r, i) => (
          <li key={r.title} className="flex gap-3 py-3">
            <span className="narrow num w-4 shrink-0 text-[13px] text-[color:var(--text-3)]">{i + 1}</span>
            <div>
              <p className="text-[15px] font-semibold text-[color:var(--text)]">{r.title}</p>
              <p className="mt-0.5 text-sm text-[color:var(--text-2)]">{r.line}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
