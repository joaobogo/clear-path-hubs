import { cn } from "@/lib/utils";

/**
 * EvidenceStrip (The Run). One segment per requirement, in rubric order,
 * heaviest first. The number is the claim; the strip is the proof, so a
 * score never travels without it.
 *
 *   quote     solid blue   an agent found a sentence that supports it
 *   question  hatched      the CV is silent; ask in the interview
 *   none      outline      no evidence found
 *   conflict  coral        the CV contradicts itself
 *
 * Sizes: 6 by 12 in tables, 9 by 16 on cards, 18 by 30 in heroes.
 */
export type EvidenceState = "quote" | "question" | "none" | "conflict";

export function evidenceSummary(states: readonly EvidenceState[]): string {
  const quotes = states.filter((s) => s === "quote").length;
  const conflicts = states.filter((s) => s === "conflict").length;
  const base = `${quotes} of ${states.length} with a quote`;
  return conflicts ? `${base}, ${conflicts} conflict` : base;
}

const SIZE = {
  table: "h-3 w-1.5",
  card: "h-4 w-[9px]",
  hero: "h-[30px] w-[18px]",
} as const;

export function EvidenceStrip({
  states,
  size = "card",
  className,
}: {
  states: readonly EvidenceState[];
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={evidenceSummary(states)}
      className={cn("inline-flex shrink-0 items-end gap-[2px]", className)}
    >
      {states.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "block rounded-[2px]",
            SIZE[size],
            s === "quote" && "bg-[color:var(--action,var(--blue-600))]",
            s === "question" &&
              "bg-[repeating-linear-gradient(135deg,var(--action,var(--blue-600))_0_2px,transparent_2px_5px)] ring-1 ring-inset ring-[color:var(--action,var(--blue-600))]",
            s === "none" && "ring-1 ring-inset ring-[color:var(--line-2,var(--rule-2))]",
            s === "conflict" && "bg-[color:var(--alert)]",
          )}
        />
      ))}
    </span>
  );
}
