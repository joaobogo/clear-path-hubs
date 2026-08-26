/**
 * Evidence substance — the anti keyword-echo measure.
 *
 * Audit finding (FIX-09): a three-line CV that simply repeated the three
 * must-have keywords scored 100/100 "Exceptional" and out-ranked detailed,
 * realistic candidates. The engine only ever asked "was the term present?", so
 * a keyword list was indistinguishable from a career.
 *
 * This module answers the question the engine was missing: how much substance
 * sits *around* the matched terms. It is pure, deterministic and calibrated —
 * every threshold lives on the rubric's calibration record, not here.
 *
 * Three independent signals, because each can be gamed alone:
 *
 *   1. Document substance — characters and distinct non-stopword tokens. A
 *      keyword list has almost no vocabulary of its own.
 *   2. Evidence depth — how many DISTINCT passages of the CV the evidence came
 *      from. Repeating one sentence per requirement is one passage, not three.
 *   3. Evidence context — how many words that are NOT the matched terms sit
 *      inside each evidence snippet. This is the signal that survives length
 *      padding: a term standing alone in a bullet has no context, a term inside
 *      a described achievement has plenty.
 */

import type { EngineCalibration } from "./engine-calibration";

/** Minimal shapes so this module never imports the server-only engine. */
type EvidenceLike = {
  matched_terms: string[];
  snippet: string;
  location: string;
};

const CONTEXT_STOP = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","by","at","from",
  "is","are","be","been","being","was","were","have","has","had","as","this","that",
  "you","your","we","our","their","it","its","not","but","if","then","so","than",
  "will","can","may","must","should","would","using","use","used","across","into",
]);

function contextTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9+.#-]{2,}/g) ?? []).filter(
    (t) => !CONTEXT_STOP.has(t),
  );
}

/** Character offset of a `cv:<start>-<end>` location, or null. */
function locationStart(location: string): number | null {
  const m = /^cv:(\d+)-/.exec(location);
  return m ? Number(m[1]) : null;
}

export type SubstanceVerdict = "substantive" | "thin" | "keyword_echo";

export type SubstanceMeasure = {
  cv_chars: number;
  distinct_tokens: number;
  /** Distinct regions of the CV any evidence was drawn from. */
  evidence_passages: number;
  /** Mean count of non-matched, non-stopword words inside evidence snippets. */
  avg_context_tokens: number;
  /** Share of the CV's vocabulary that is just the rubric's own terms. */
  echo_ratio: number;
  /** 0-1 rollup of length and vocabulary against the calibrated targets. */
  substance_ratio: number;
  /** 0-1 depth factor combining passage count and snippet context. */
  depth_ratio: number;
  verdict: SubstanceVerdict;
  /** Plain-language reason, for concerns and applied_caps. Null when substantive. */
  reason: string | null;
};

/**
 * Measure the substance behind a run's evidence.
 *
 * `matchedTerms` is every term the run matched anywhere, used for the echo
 * ratio. Passages are bucketed by calibrated width so two snippets pulled from
 * the same sentence count once.
 */
export function measureSubstance(args: {
  cv_text: string;
  evidence: EvidenceLike[];
  matched_terms: string[];
  calibration: EngineCalibration;
}): SubstanceMeasure {
  const cal = args.calibration;
  const cv = args.cv_text ?? "";
  const cv_chars = cv.trim().length;
  const tokens = new Set(contextTokens(cv));
  const distinct_tokens = tokens.size;

  const matched = new Set(
    args.matched_terms.flatMap((t) => contextTokens(t)).filter(Boolean),
  );
  const echo_ratio = distinct_tokens > 0 ? matched.size / distinct_tokens : 0;

  // Distinct passages: bucket snippet offsets by the passage width so repeated
  // quoting of one sentence cannot inflate depth.
  const width = Math.max(1, cal.evidence_passage_width_chars);
  const buckets = new Set<string>();
  for (const e of args.evidence) {
    const start = locationStart(e.location);
    buckets.add(
      start === null
        ? `text:${e.snippet.slice(0, 40).toLowerCase()}`
        : `bucket:${Math.floor(start / width)}`,
    );
  }
  const evidence_passages = buckets.size;

  const contextCounts = args.evidence.map((e) => {
    const termWords = new Set(e.matched_terms.flatMap((t) => contextTokens(t)));
    return contextTokens(e.snippet).filter((t) => !termWords.has(t)).length;
  });
  const avg_context_tokens = contextCounts.length
    ? Math.round(
        (contextCounts.reduce((s, n) => s + n, 0) / contextCounts.length) * 100,
      ) / 100
    : 0;

  const lengthRatio = Math.min(1, cv_chars / Math.max(1, cal.substance_target_chars));
  const vocabRatio = Math.min(
    1,
    distinct_tokens / Math.max(1, cal.substance_target_tokens),
  );
  const substance_ratio = Math.round(((lengthRatio + vocabRatio) / 2) * 1000) / 1000;

  const passageRatio = args.evidence.length
    ? Math.min(1, evidence_passages / Math.max(1, cal.evidence_passage_target))
    : 0;
  const contextRatio = Math.min(
    1,
    avg_context_tokens / Math.max(1, cal.evidence_context_target_tokens),
  );
  const depth_ratio = Math.round(((passageRatio + contextRatio) / 2) * 1000) / 1000;

  const thinDocument =
    cv_chars < cal.substance_min_chars || distinct_tokens < cal.substance_min_tokens;
  const shallowEvidence =
    args.evidence.length > 0 &&
    avg_context_tokens < cal.evidence_context_min_tokens;
  const echoing = echo_ratio >= cal.keyword_echo_ratio;

  let verdict: SubstanceVerdict = "substantive";
  let reason: string | null = null;
  if (thinDocument && (shallowEvidence || echoing)) {
    verdict = "keyword_echo";
    reason =
      `the CV is ${cv_chars} characters of ${distinct_tokens} distinct words and the matched terms carry ` +
      `${avg_context_tokens} words of surrounding detail — this reads as a keyword list, not evidence`;
  } else if (thinDocument) {
    verdict = "thin";
    reason =
      `the CV holds only ${cv_chars} characters and ${distinct_tokens} distinct words, ` +
      `too little to support a top band`;
  } else if (shallowEvidence) {
    verdict = "thin";
    reason =
      `matched terms appear with an average of ${avg_context_tokens} words of surrounding detail, ` +
      `below the ${cal.evidence_context_min_tokens} words needed to read as described experience`;
  }

  return {
    cv_chars,
    distinct_tokens,
    evidence_passages,
    avg_context_tokens,
    echo_ratio: Math.round(echo_ratio * 1000) / 1000,
    substance_ratio,
    depth_ratio,
    verdict,
    reason,
  };
}
