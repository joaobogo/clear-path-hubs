/**
 * A cheap, deterministic first read of a pasted job description: the job title
 * and the team, taken only from where a description states them plainly.
 *
 * Why it exists: the full read is a model call that starts after a pause and can
 * fail quietly, which left "Job title" and "Team" empty on the next screen even
 * though the client had just pasted a description that names both. This fills
 * the two fields at once; the model read replaces them when it returns, and the
 * client confirms or changes them on the next screen. It never guesses from
 * prose: no labelled line and no title-shaped first line means no answer.
 */

export type JdTitleGuess = { title?: string; team?: string };

const TITLE_LABEL = /^\s*(?:job\s*title|position\s*title|position|role\s*title|role|title)\s*[:\-–—]\s*(.+?)\s*$/i;
const TEAM_LABEL = /^\s*(?:team|department|function|business\s*unit|group)\s*[:\-–—]\s*(.+?)\s*$/i;

/** Markdown heading marks, bullets and emphasis around a line. */
function cleanLine(raw: string): string {
  return raw
    .replace(/^\s*(?:#{1,6}|[-*•>]+)\s*/, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that mean the first line is company boilerplate, not a title. */
const NOT_A_TITLE =
  /\b(?:about\s+us|about\s+the|who\s+we\s+are|we\s+are|we're|we\s+is|our\s+(?:mission|company|team)|job\s+description|overview|summary|company|apply|location|salary|benefits)\b/i;

function looksLikeTitle(line: string): boolean {
  if (line.length < 3 || line.length > 90) return false;
  if (!/[a-z]/i.test(line)) return false;
  if (/[.!?:;]$/.test(line)) return false;
  if (line.split(" ").length > 12) return false;
  if (NOT_A_TITLE.test(line)) return false;
  return true;
}

function trimValue(v: string, max: number): string | undefined {
  const out = cleanLine(v).slice(0, max).trim();
  return out.length >= 2 ? out : undefined;
}

export function guessTitleAndTeam(text: string): JdTitleGuess {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .slice(0, 80)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return {};

  const out: JdTitleGuess = {};
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (!out.title) {
      const t = TITLE_LABEL.exec(cleaned);
      if (t?.[1]) out.title = trimValue(t[1], 160);
    }
    if (!out.team) {
      const m = TEAM_LABEL.exec(cleaned);
      if (m?.[1]) out.team = trimValue(m[1], 120);
    }
    if (out.title && out.team) break;
  }

  if (!out.title) {
    const first = cleanLine(lines[0]!);
    if (looksLikeTitle(first)) out.title = first;
  }
  return out;
}
