import type { ReactNode } from "react";
import { clockLabel, type RunChapter } from "@/config/run-chapters";
import { cn } from "@/lib/utils";

/**
 * One chapter of the run: its surface, its time, an h2, and 112 above /
 * 120 below. Lines before boxes; a 1 px rule separates chapters.
 */
export function Chapter({
  chapter,
  index,
  title,
  lead,
  children,
  className,
}: {
  chapter: RunChapter;
  index: number;
  title: string;
  lead: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const surface = chapter.surface === "paper" ? "day bg-[color:var(--paper)]" : chapter.surface;
  return (
    <section
      id={`chapter-${chapter.id}`}
      aria-labelledby={`chapter-${chapter.id}-title`}
      className={cn(surface, "scroll-mt-[120px] px-6 pb-[120px] pt-[112px] sm:px-10 lg:px-14", className)}
    >
      <p className="narrow num text-[13px] font-medium text-[color:var(--text-3)]">
        {index}. {clockLabel(chapter.clock)}
      </p>
      <h2
        id={`chapter-${chapter.id}-title`}
        className="mt-3 max-w-[18ch] text-[36px] leading-[1.04] text-[color:var(--text)] sm:text-[44px]"
      >
        {title}
      </h2>
      <p className="mt-5 max-w-[640px] text-[19px] leading-[1.45] text-[color:var(--text-2)] sm:text-[21px]">{lead}</p>
      <div className="mt-12">{children}</div>
    </section>
  );
}
