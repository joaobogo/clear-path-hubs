import { useEffect, useState } from "react";
import { RunClock } from "@/components/signature/run-clock";
import { clockLabel, RUN_CHAPTERS, type RunChapter } from "@/config/run-chapters";
import { cn } from "@/lib/utils";

/**
 * ChapterRail (The Run): sticks to the left of the homepage chapters and
 * shows the clock and where you are. The clock is the largest thing in it.
 * Below 1024 it becomes a 48 px bar under the header; on a phone that bar
 * shows only the clock. When a chapter enters, the clock rolls to the
 * chapter's time and the marker moves; the content is already in place.
 */

/** The chapter whose section is crossing the upper part of the viewport. */
export function useActiveChapter(chapters: readonly RunChapter[] = RUN_CHAPTERS): RunChapter {
  const [activeId, setActiveId] = useState(chapters[0]!.id);

  useEffect(() => {
    const sections = chapters
      .map((c) => document.getElementById(`chapter-${c.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^chapter-/, "");
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top);
          else visible.delete(id);
        }
        if (visible.size === 0) return;
        // The topmost section still in the band is the one being read.
        const [top] = [...visible.entries()].sort((a, b) => a[1] - b[1]);
        if (top) setActiveId(top[0]);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: 0 },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [chapters]);

  return chapters.find((c) => c.id === activeId) ?? chapters[0]!;
}

export function ChapterRail({ active, chapters = RUN_CHAPTERS }: { active: RunChapter; chapters?: readonly RunChapter[] }) {
  const label = clockLabel(active.clock);
  const activeIndex = chapters.findIndex((c) => c.id === active.id);

  return (
    <>
      {/* 1024 and up: the rail. */}
      <nav aria-label="Chapters" className="day sticky top-[96px] hidden self-start lg:block">
        <RunClock day={active.clock.day} label={label} size={128} className="text-[color:var(--ink)]" />
        <ol className="mt-8 flex flex-col border-l border-[color:var(--rule)]">
          {chapters.map((c, i) => {
            const state = i < activeIndex ? "done" : i === activeIndex ? "current" : "ahead";
            return (
              <li key={c.id} className="relative">
                <a
                  href={`#chapter-${c.id}`}
                  aria-current={state === "current" ? "step" : undefined}
                  className={cn(
                    "-ml-px flex min-h-11 items-center gap-2 border-l-2 pl-3 pr-1 text-[15px]",
                    state === "current" && "border-[color:var(--blue-600)] text-[color:var(--blue-600)]",
                    state === "done" && "border-[color:var(--blue-300)] text-[color:var(--slate)]",
                    state === "ahead" && "border-transparent text-[color:var(--faint)]",
                  )}
                >
                  <span className="narrow num w-4 text-[13px]">{i + 1}</span>
                  <span className={cn(state === "current" && "font-semibold")}>{c.title}</span>
                  <span className="narrow num ml-auto whitespace-nowrap text-[12px] text-[color:var(--faint)]">
                    {clockLabel(c.clock)}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Below 1024: a 48 px bar under the header. A phone shows only the clock. */}
      <div
        aria-live="polite"
        className="day sticky top-[72px] z-30 -mx-[var(--margin)] flex h-12 items-center gap-3 border-b border-[color:var(--rule)] px-[var(--margin)] lg:hidden"
      >
        <RunClock day={active.clock.day} label={label} size={26} />
        <span className="num text-sm font-semibold text-[color:var(--ink)]">{label}</span>
        <span className="hidden text-sm text-[color:var(--slate)] sm:inline">
          · {activeIndex + 1} {active.title}
        </span>
      </div>
    </>
  );
}
