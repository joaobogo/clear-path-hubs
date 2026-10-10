/**
 * The seven chapters of the run, in the order a role runs. The rail on the
 * homepage reads this list; each chapter section carries the matching id.
 *
 * Time is "Day n, hh:mm" counted from the approved brief, never a date. The
 * clock closes in ink at sign-off (day 5); later chapters sit past it.
 */
export type RunSurface = "day" | "tint" | "blue" | "paper";

export type RunChapter = {
  id: string;
  title: string;
  /** What the rail clock shows. `day` drives the ring; `time` the label. */
  clock: { day: number; time?: string; label?: string };
  surface: RunSurface;
};

export const RUN_SIGN_OFF_DAY = 5;

export const RUN_CHAPTERS: readonly RunChapter[] = [
  { id: "brief", title: "Brief", clock: { day: 0, time: "09:00" }, surface: "day" },
  { id: "broadcast", title: "Broadcast", clock: { day: 0, time: "11:00" }, surface: "blue" },
  { id: "score", title: "Score", clock: { day: 3, time: "14:20", label: "Days 1 to 4" }, surface: "tint" },
  { id: "sign-off", title: "Sign-off", clock: { day: 5, time: "09:00" }, surface: "day" },
  { id: "invoice", title: "Invoice", clock: { day: 30, label: "Day 30" }, surface: "paper" },
  { id: "proof", title: "Proof", clock: { day: 30, label: "Since launch" }, surface: "day" },
  { id: "start", title: "Start", clock: { day: 30, label: "Now" }, surface: "blue" },
];

/** "Day 0, 09:00", or the chapter's own label when it is not on the clock. */
export function clockLabel(c: RunChapter["clock"]): string {
  if (c.label) return c.label;
  return c.time ? `Day ${c.day}, ${c.time}` : `Day ${c.day}`;
}

/** How much of the five-day ring is filled, 0 to 1. */
export function clockFraction(day: number): number {
  return Math.max(0, Math.min(1, day / RUN_SIGN_OFF_DAY));
}
