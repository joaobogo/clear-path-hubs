import { memo } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { buildValidationList } from "@/lib/client/validation-list";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

/**
 * The "why" of the verdict, in five seconds: up to three evidence-backed
 * strengths and up to two things worth validating. Every line traces to a real
 * evidence item or coverage status — never to free text with no source.
 */
export const TopSignals = memo(function TopSignals({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const evidenced = candidate.requirement_rows
    .filter((r) => r.status === "met" && r.evidence.length > 0)
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      text: r.label,
      detail: r.evidence[0]?.snippet ?? null,
      source: r.evidence[0]?.source ?? null,
    }));

  const strengths =
    evidenced.length > 0
      ? evidenced
      : candidate.strengths.slice(0, 3).map((s, i) => ({
          id: `strength-${i}`,
          text: s,
          detail: null,
          source: null,
        }));

  const flags = buildValidationList(candidate.requirement_rows, candidate.concerns)
    .slice(0, 2);

  if (strengths.length === 0 && flags.length === 0) return null;

  return (
    <section aria-labelledby="signals-heading" className="rounded-xl border bg-card p-4">
      <h2 id="signals-heading" className="text-sm font-semibold">
        Why — and what to check
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {strengths.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 taas-fg-success" aria-hidden />
            <span className="min-w-0 truncate">
              <span className="font-medium">{s.text}</span>
              {s.detail && (
                <span className="text-muted-foreground">
                  {" — "}
                  {s.detail}
                  {s.source ? ` (${s.source})` : ""}
                </span>
              )}
            </span>
          </li>
        ))}
        {flags.map((f) => (
          <li key={f.id} className="flex items-start gap-2">
            <Info
              className={
                f.tone === "warning"
                  ? "mt-0.5 h-3.5 w-3.5 shrink-0 taas-fg-warning"
                  : "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              }
              aria-hidden
            />
            <span className="min-w-0 truncate text-muted-foreground">
              Worth validating: {f.label ? `${f.label} — ` : ""}
              {f.sentence}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
});
