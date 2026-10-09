import { cn } from "@/lib/utils";

/**
 * Seal (The Run): ink, only where a named person approved. Carries a time;
 * carries a name once recruiters are named. Drawn solid, never as an icon.
 */
export function Seal({
  by = "Signed by a senior recruiter",
  at,
  what,
  className,
}: {
  by?: string;
  /** "Day 5, 09:00" */
  at: string;
  /** What was signed, such as "Top 10 signed off". */
  what?: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-4", className)}>
      <span
        aria-hidden
        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color:var(--human,var(--ink))]"
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" className="text-white">
          <path d="M5 13.5l5 5L21 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex flex-col">
        {what ? <span className="text-base font-semibold text-[color:var(--human,var(--ink))]">{what}</span> : null}
        <span className="text-[15px] text-[color:var(--text,var(--ink))]">{by}</span>
        <span className="num text-sm text-[color:var(--text-2,var(--slate))]">{at}</span>
      </span>
    </div>
  );
}
