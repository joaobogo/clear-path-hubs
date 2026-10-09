/**
 * The job title and team from a pasted job description, taken only from where
 * the description states them plainly.
 *
 * Kept for compatibility: the full instant read now lives in `quickReadJd`
 * (src/lib/jd-quick-read.ts), which also reads location, work model, pay,
 * start date and requirements. This returns just its title and team, so the
 * two can never disagree.
 */
import { quickReadJd } from "@/lib/jd-quick-read";

export type JdTitleGuess = { title?: string; team?: string };

export function guessTitleAndTeam(text: string): JdTitleGuess {
  const { blueprint } = quickReadJd(text ?? "");
  const out: JdTitleGuess = {};
  if (blueprint.title) out.title = blueprint.title.value;
  if (blueprint.team) out.team = blueprint.team.value;
  return out;
}
