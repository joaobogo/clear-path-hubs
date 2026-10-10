import { ChapterBrief } from "@/components/home/chapters/chapter-brief";
import { ChapterBroadcast } from "@/components/home/chapters/chapter-broadcast";
import { ChapterInvoice } from "@/components/home/chapters/chapter-invoice";
import { ChapterProof } from "@/components/home/chapters/chapter-proof";
import { ChapterScore } from "@/components/home/chapters/chapter-score";
import { ChapterSignOff } from "@/components/home/chapters/chapter-signoff";
import { ChapterRail, useActiveChapter } from "@/components/layout/chapter-rail";

/**
 * Chapters 1 to 6 beside the rail. Chapter 7, Start, is the closing band
 * the page renders after this. Surfaces in order: white, blue, tint, white,
 * paper, white, blue.
 */
export function RunChapters({ role, lastUpdated }: { role: string; lastUpdated: string }) {
  const active = useActiveChapter();
  return (
    <div className="day mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)]">
      <div className="grid gap-x-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <ChapterRail active={active} />
        <div className="min-w-0 divide-y divide-[color:var(--rule)]">
          <ChapterBrief role={role} />
          <ChapterBroadcast role={role} />
          <ChapterScore />
          <ChapterSignOff />
          <ChapterInvoice lastUpdated={lastUpdated} />
          <ChapterProof />
        </div>
      </div>
    </div>
  );
}
