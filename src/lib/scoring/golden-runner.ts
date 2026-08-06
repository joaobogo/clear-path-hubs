/**
 * Golden-score regression runner.
 *
 * Produces a stable, human-readable snapshot of what the scoring engine
 * currently believes, for the shared fixture corpus. The snapshot deliberately
 * also carries the *policy inputs* — engine version, calibration version, the
 * calibration defaults that move numbers, and the band table — so that a change
 * to any of those prints a diff even when no fixture score moves.
 */
import { scoreCandidate } from "@/lib/scoring-engine.server";
import {
  CALIBRATION_VERSION,
  DEFAULT_CALIBRATION,
  ROLE_FAMILY_CALIBRATION,
  serialiseCalibration,
} from "./engine-calibration";
import { ENGINE_VERSION } from "./engine-version";
import { SCORE_BAND_BOUNDARIES, classifyBand } from "./bands";
import { FIXTURES } from "./golden-corpus";

export type GoldenScore = {
  name: string;
  status: string;
  raw_score: number;
  score: number;
  band: string;
  fit_label: string;
  applied_caps: string[];
  must_have_coverage: number;
  evidence_confidence: number;
  overall_confidence: number;
  evaluation_method: string;
  input_hash: string;
};

export type GoldenSnapshot = {
  policy: {
    engine_version: string;
    calibration_version: string;
    bands: { key: string; min: number }[];
    default_calibration: Record<string, unknown>;
    role_family_overrides: Record<string, unknown>;
  };
  fixtures: GoldenScore[];
};

export function computeGoldenSnapshot(): GoldenSnapshot {
  const fixtures = FIXTURES.map((f): GoldenScore => {
    const r = scoreCandidate({
      cv_text: f.cv,
      requirements: [f.requirement],
      screening: [],
    });
    const a = r.requirement_assessment[0]!;
    return {
      name: f.name,
      status: a.status,
      raw_score: r.raw_score,
      score: r.score,
      band: classifyBand(r.score),
      fit_label: r.fit_label,
      applied_caps: r.applied_caps.map((c) => `${c.reason}@${c.cap}`),
      must_have_coverage: r.must_have_coverage,
      evidence_confidence: r.evidence_confidence,
      overall_confidence: r.overall_confidence,
      evaluation_method: r.evaluation_method,
      input_hash: r.input_hash,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    policy: {
      engine_version: ENGINE_VERSION,
      calibration_version: CALIBRATION_VERSION,
      bands: SCORE_BAND_BOUNDARIES.map((b) => ({ key: b.key, min: b.min })),
      default_calibration: serialiseCalibration(DEFAULT_CALIBRATION),
      role_family_overrides: JSON.parse(JSON.stringify(ROLE_FAMILY_CALIBRATION)) as Record<
        string,
        unknown
      >,
    },
    fixtures,
  };
}

/** Field-level differences between the accepted golden file and the current engine. */
export function diffGolden(
  accepted: GoldenSnapshot,
  current: GoldenSnapshot,
): string[] {
  const diffs: string[] = [];

  const a = JSON.stringify(accepted.policy, null, 2).split("\n");
  const b = JSON.stringify(current.policy, null, 2).split("\n");
  if (a.join("\n") !== b.join("\n")) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (a[i] !== b[i]) diffs.push(`policy: - ${a[i] ?? "(absent)"}   + ${b[i] ?? "(absent)"}`);
    }
  }

  const byName = new Map(accepted.fixtures.map((f) => [f.name, f]));
  for (const cur of current.fixtures) {
    const prev = byName.get(cur.name);
    if (!prev) {
      diffs.push(`new fixture: ${cur.name} (score ${cur.score}, band ${cur.band})`);
      continue;
    }
    byName.delete(cur.name);
    for (const key of Object.keys(cur) as (keyof GoldenScore)[]) {
      const before = JSON.stringify(prev[key]);
      const after = JSON.stringify(cur[key]);
      if (before !== after) diffs.push(`${cur.name} :: ${key}: ${before} -> ${after}`);
    }
  }
  for (const missing of byName.keys()) {
    diffs.push(`removed fixture: ${missing}`);
  }

  return diffs;
}
