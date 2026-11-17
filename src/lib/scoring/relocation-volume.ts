/**
 * Relocation-first scoring (positions.scoring_mode = 'relocation_volume').
 *
 * For volume roles abroad where the client cares that a person will really
 * move and work the shifts, not about their CV. Pass/fail stays with the
 * dealbreaker questions (the engine's own disqualification). The score is:
 *
 *   commitment 40 · start 20 · flexibility 20 · experience 20 (bonus only)
 *
 * Each dimension is read from screening questions tagged with
 * screening_questions.scoring_dimension. Experience can also come from the
 * CV, and it never drops below a strong baseline, so a person without
 * experience is not treated as having a gap. No language, degree, seniority,
 * years or age input exists here. Pure and deterministic.
 */
import { asBoolean } from "./eligibility";

export const RELOCATION_VOLUME_MODE = "relocation_volume" as const;
export const RELOCATION_VOLUME_VERSION = "relocation-volume-1";

export type RelocationDimension = "commitment" | "start" | "flexibility" | "experience";

export const RELOCATION_WEIGHTS: Record<RelocationDimension, number> = {
  commitment: 0.4,
  start: 0.2,
  flexibility: 0.2,
  experience: 0.2,
};

/** Unanswered is "not known yet", scored in the middle, never as a fail. */
export const UNKNOWN_CREDIT = 0.5;
/** Ordinary answer on a scored dimension. */
export const ORDINARY_CREDIT = 0.75;
/** No warehouse/physical experience still earns this share of the bonus. */
export const EXPERIENCE_BASELINE = 0.75;

export interface RelocationAnswer {
  question_id: string;
  answer_type: string;
  value: unknown;
  scoring_dimension?: string | null;
  options?: unknown;
  /** Dealbreaker questions count toward flexibility when tagged so. */
  dealbreaker?: boolean;
}

export interface RelocationBreakdown {
  dimensions: Record<RelocationDimension, { score: number; answered: number; source: string }>;
  /** 0-1, before any disqualification cap. */
  composite: number;
}

const EXPERIENCE_RE =
  /\b(armaz[eé]m|estoque|log[ií]stic|centro de distribui|separa[cç][aã]o|picking|empilhadeira|expedi[cç][aã]o|warehouse|forklift|repositor|carga e descarga|operador de produ|auxiliar de produ|ajudante geral|conferente)/i;

function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
    return (v as { value: unknown }).value;
  }
  return v;
}

/** A choice question's option labels, in order. Shared with the apply form. */
export function choiceOptions(options: unknown): string[] {
  return optionList(options);
}

function optionList(options: unknown): string[] {
  const raw = unwrap(options);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => (o && typeof o === "object" ? (o as { label?: unknown; value?: unknown }).label ?? (o as { value?: unknown }).value : o))
    .map((o) => String(o ?? "").trim())
    .filter(Boolean);
}

function chosen(v: unknown): string[] {
  const raw = unwrap(v);
  return (Array.isArray(raw) ? raw : [raw])
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).trim());
}

/** Commitment text: a concrete, long-term plan scores higher. Writing style is not judged. */
export function commitmentFromText(text: string): number {
  const t = text.trim().toLowerCase();
  if (!t) return UNKNOWN_CREDIT;
  const years = /(\d+)\s*(anos?|years?)/.exec(t);
  const months = /(\d+)\s*(m[eê]s|meses|months?)/.exec(t);
  if (/n[aã]o sei|talvez|ainda n[aã]o decidi/.test(t) && !years) return 0.6;
  if (years && Number(years[1]) >= 1) return 1;
  if (/(um|dois|tr[eê]s|quatro|cinco) anos|longo prazo|muitos anos|definitiv|morar|ficar de vez|para sempre|construir|fam[ií]lia/.test(t)) return 1;
  if (months) {
    const m = Number(months[1]);
    if (m >= 12) return 1;
    if (m >= 6) return ORDINARY_CREDIT;
    return 0.5;
  }
  return ORDINARY_CREDIT;
}

/** Ordered choice: the first option is the best (e.g. "right after the visa"). */
function ordinalScore(answer: RelocationAnswer): number | null {
  const opts = optionList(answer.options);
  const picked = chosen(answer.value);
  if (!picked.length) return null;
  if (!opts.length) return ORDINARY_CREDIT;
  const idx = opts.findIndex((o) => o.toLowerCase() === picked[0]!.toLowerCase());
  if (idx < 0) return ORDINARY_CREDIT;
  const ladder = [1, 0.85, 0.6, 0.35];
  return ladder[Math.min(idx, ladder.length - 1)]!;
}

/** Multi-choice: the share of the schedules accepted. */
function shareScore(answer: RelocationAnswer): number | null {
  const opts = optionList(answer.options);
  const picked = chosen(answer.value);
  if (!picked.length) return null;
  if (!opts.length) return ORDINARY_CREDIT;
  const lower = new Set(picked.map((p) => p.toLowerCase()));
  const hits = opts.filter((o) => lower.has(o.toLowerCase())).length;
  return 0.4 + 0.6 * (hits / opts.length);
}

function answerScore(dim: RelocationDimension, a: RelocationAnswer): number | null {
  const type = a.answer_type;
  if (type === "boolean") {
    const b = asBoolean(a.value);
    if (b === null) return null;
    if (dim === "experience") return b ? 1 : EXPERIENCE_BASELINE;
    // A "yes" on a tagged yes/no question is an ordinary positive answer.
    return b ? (a.dealbreaker ? ORDINARY_CREDIT : 1) : 0.3;
  }
  if (type === "single_choice") return ordinalScore(a);
  if (type === "multi_choice") return shareScore(a);
  const text = chosen(a.value).join(" ");
  if (!text) return null;
  if (dim === "commitment") return commitmentFromText(text);
  if (dim === "experience") return EXPERIENCE_RE.test(text) ? 1 : EXPERIENCE_BASELINE;
  return ORDINARY_CREDIT;
}

export function scoreRelocationVolume(input: { cv_text: string; screening: RelocationAnswer[] }): RelocationBreakdown {
  const dims = {} as RelocationBreakdown["dimensions"];
  for (const dim of Object.keys(RELOCATION_WEIGHTS) as RelocationDimension[]) {
    const scores = input.screening
      .filter((a) => a.scoring_dimension === dim)
      .map((a) => answerScore(dim, a))
      .filter((n): n is number => n !== null);
    let score = scores.length ? scores.reduce((t, n) => t + n, 0) / scores.length : UNKNOWN_CREDIT;
    let source = scores.length ? "screening" : "unanswered";
    if (dim === "experience") {
      const cvHit = EXPERIENCE_RE.test(input.cv_text ?? "");
      if (cvHit) {
        score = 1;
        source = scores.length ? "screening+cv" : "cv";
      }
      // Bonus only: never below the baseline.
      score = Math.max(EXPERIENCE_BASELINE, score);
    }
    dims[dim] = { score: Math.round(score * 10000) / 10000, answered: scores.length, source };
  }
  const composite = (Object.keys(RELOCATION_WEIGHTS) as RelocationDimension[]).reduce(
    (t, d) => t + dims[d].score * RELOCATION_WEIGHTS[d],
    0,
  );
  return { dimensions: dims, composite: Math.round(composite * 10000) / 10000 };
}
