import { ChapterBrief } from "@/components/home/chapters/chapter-brief";
import { ChapterBroadcast } from "@/components/home/chapters/chapter-broadcast";
import { ChapterInvoice } from "@/components/home/chapters/chapter-invoice";
import { ChapterProof } from "@/components/home/chapters/chapter-proof";
import { ChapterScore } from "@/components/home/chapters/chapter-score";
import { ChapterSignOff } from "@/components/home/chapters/chapter-signoff";

/**
 * Chapters 1 to 6 in one centred column. Chapter 7, Start, is the closing
 * band the page renders after this. Surfaces in order: white, blue, tint,
 * white, paper, white, blue.
 */
export function RunChapters({ role, lastUpdated }: { role: string; lastUpdated: string }) {
  return (
    <div className="run-chapters day mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)]">
      <div className="mx-auto w-full min-w-0 max-w-[var(--max)] divide-y divide-[color:var(--rule)]">
        <ChapterBrief role={role} />
        <ChapterBroadcast role={role} />
        <ChapterScore />
        <ChapterSignOff />
        <ChapterInvoice lastUpdated={lastUpdated} />
        <ChapterProof />
      </div>
    </div>
  );
}
