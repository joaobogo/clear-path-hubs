import { useEffect, useRef, useState } from "react";
import { Chapter } from "@/components/home/chapters/chapter";
import { CHANNELS_NAMED_IN_PUBLIC } from "@/config/channel-agents";
import { offer } from "@/config/offer";
import { RUN_CHAPTERS } from "@/config/run-chapters";
import { usePrefersReducedMotion } from "@/lib/motion/use-motion";
import { PREVIEW_RUN_FUNNEL } from "@/lib/previews/representative-fixtures";
import { cn } from "@/lib/utils";

const chapter = RUN_CHAPTERS[1]!;
const REACHED = PREVIEW_RUN_FUNNEL[0]!.count;
const nf = new Intl.NumberFormat("en-US");

/** True once the element has entered the viewport; stays true. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

/**
 * Chapter 2, Broadcast (Day 0, 11:00, the first blue band). One role card
 * fanning out to 23 lines, the named channels as a real list, and the
 * running total ticking up as the lines land.
 */
export function ChapterBroadcast({ role }: { role: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  // Full total before scripts run; ticks from zero once the fan is in view.
  const [shown, setShown] = useState(REACHED);
  useEffect(() => {
    if (reduced) return;
    if (!inView) {
      setShown(0);
      return;
    }
    const ms = 60 * offer.channels + 400;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(REACHED * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced]);

  const named = CHANNELS_NAMED_IN_PUBLIC;
  const unnamed = Math.max(0, offer.channels - named.length);
  const W = 320;
  const H = 23 * 22;

  return (
    <Chapter
      chapter={chapter}
      index={2}
      title="Two hours later, the whole market knows."
      lead={`${offer.agents} agents write the outreach, launch the campaigns and work the network in parallel, and watch for people showing intent to move. One rubric governs every channel.`}
    >
      <div ref={ref} className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-0">
        <div className="rounded-[var(--r-2)] bg-white p-5 text-[color:var(--ink)] lg:mt-[203px]">
          <p className="narrow text-[13px] font-medium text-[color:var(--faint)]">Role card</p>
          <p className="mt-1 text-xl font-semibold">{role}</p>
          <p className="mt-2 text-sm text-[color:var(--slate)]">Rubric locked · outreach written · {offer.channels} channels</p>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          aria-hidden
          className={cn("run-fan hidden max-h-[506px] lg:block", inView && "is-in")}
          preserveAspectRatio="none"
        >
          {Array.from({ length: offer.channels }, (_, i) => {
            const y = 11 + i * 22;
            return (
              <path
                key={i}
                d={`M0 ${H / 2} C ${W * 0.45} ${H / 2}, ${W * 0.55} ${y}, ${W} ${y}`}
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth={i < named.length ? 1.5 : 0.8}
                strokeOpacity={i < named.length ? 1 : 0.55}
                style={{ ["--i" as string]: i }}
              />
            );
          })}
        </svg>

        <div className="lg:pl-10">
          <ul className="flex flex-col" aria-label={`${offer.channels} channels, ${named.length} named`}>
            {named.map((c) => (
              <li key={c} className="flex h-[22px] items-center text-[15px] text-[color:var(--text)]">
                {c}
              </li>
            ))}
            <li className="flex h-[22px] items-center text-[15px] text-[color:var(--text-3)]">
              and {unnamed} more
            </li>
          </ul>
          <div className="mt-8 border-t border-[color:var(--line-2)] pt-4">
            <p className="narrow text-[13px] font-medium text-[color:var(--text-3)]">Reached by Day 0, 23:59 · example run</p>
            <p className="wide num mt-1 text-[52px] font-semibold leading-none text-[color:var(--text)]" aria-live="off">
              {nf.format(shown)}
            </p>
            <p className="sr-only">{nf.format(REACHED)} people reached</p>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
