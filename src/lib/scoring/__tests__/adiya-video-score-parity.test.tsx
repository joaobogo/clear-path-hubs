/**
 * One published score per candidate, on every surface, with the intro video.
 *
 * Adiya's live shape (2 Nov 2026): her human-adjusted run scores 67.5, staff
 * attached a Google Drive introduction video, and apply_reviewed_verdicts
 * recorded an 'override' decision of 67.5 against that same run. Runs never
 * carry the +5; every surface folds it at read time. The admin header dropped
 * it whenever an override decision existed (68 · Consider beside a Score tab,
 * list and client view reading 73 · Strong), the review queue added it without
 * the 100 cap, and the publish desk banded the bare run.
 *
 * Each surface's helper is run on the same shape here and must answer
 * 72.5 / strong.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  evidenceScoreOf,
  evidenceWithVideoLabel,
  hasVideoIntro,
  isReviewedEvidenceDecision,
  publishedBand,
  publishedScore,
  resolvePublishedRun,
  withPublishedRun,
  withRecordedOverride,
  withVideoIntroBonus,
} from "@/lib/scoring/published-score";
import { reviewRowScore } from "@/lib/scoring/review-row-score";
import { reviewedAssessmentMessage } from "@/lib/scoring/reviewed-assessment-message";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";
import { mcpPublishedFit } from "@/lib/mcp/published-fit";
import { AdminScoreNumber } from "@/components/admin/admin-score-number";

const DRIVE_URL = "https://drive.google.com/file/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/view";
const RUN_ID = "88af9d95-a66f-47a4-a284-1efa90d3e13a";

/** Values exactly as PostgREST returns numeric(6,2) columns: strings. */
function adiyaRun(score = "67.50") {
  return {
    id: RUN_ID,
    status: "completed",
    score,
    final_score: score,
    fit_label: "worth_considering",
    fit_band: "worth_considering",
    evaluation_method: "human_adjusted",
    confidence: 0.9,
  };
}

function adiyaMatch() {
  return {
    id: "b058712e-53c1-4072-9cf5-43c3d84b9801",
    intro_video_url: DRIVE_URL,
    processing_state: "scored",
    approved_score_run_id: null as string | null,
    current_score_run_id: RUN_ID,
  };
}

function overrideFor(score = "67.50") {
  return {
    id: "9f29c78e-a7cb-4f7b-a6a8-a924757c2d8c",
    decision_type: "override",
    score_run_id: RUN_ID,
    approved_score: score,
    reason:
      "Reviewed requirement verdicts scored by the platform formula (human-adjusted run 88af9d95).",
  };
}

/** The admin candidate header, as admin.candidates.$id.tsx resolves it. */
function headerRun(score = "67.50") {
  const m = adiyaMatch();
  // getAdminMatch folds every run once.
  const runs = [withVideoIntroBonus(adiyaRun(score), hasVideoIntro(m))];
  return withRecordedOverride(resolvePublishedRun(runs, m) ?? runs[0], [overrideFor(score)]);
}

describe("Adiya: run 67.5 + Drive video + override 67.5 on the same run", () => {
  const PUBLISHED = 72.5;
  const BAND = "strong";

  it("the admin header keeps the bonus when an override decision exists", () => {
    const run = headerRun();
    expect(publishedScore(run)).toBe(PUBLISHED);
    expect(publishedBand(run)).toBe(BAND);
    // The header hands AdminScoreNumber the row as loaded (numeric columns as strings).
    const html = renderToStaticMarkup(<AdminScoreNumber run={run as never} size="lg" />);
    expect(html).toContain('aria-label="Score 73"');
    expect(html).toContain("Strong");
    expect(html).not.toContain("Consider");
  });

  it("the Score tab (folded runs, no override applied) agrees with the header", () => {
    const m = adiyaMatch();
    const run = withVideoIntroBonus(adiyaRun(), hasVideoIntro(m));
    expect(publishedScore(run)).toBe(PUBLISHED);
    expect(publishedBand(run)).toBe(BAND);
  });

  it("the admin list (view row folded by match_id) agrees", () => {
    const viewRow = {
      match_id: adiyaMatch().id,
      score: "67.50",
      final_score: "67.50",
      score_band: "consider",
    };
    const row = withVideoIntroBonus(viewRow, true);
    expect(publishedScore(row)).toBe(PUBLISHED);
    expect(publishedBand(row)).toBe(BAND);
  });

  it("the admin embeds (withPublishedRun) agree", () => {
    const row = withPublishedRun({ ...adiyaMatch(), approved_run: null, current_run: adiyaRun() });
    expect(publishedScore(row.score_runs)).toBe(PUBLISHED);
    expect(publishedBand(row.score_runs)).toBe(BAND);
  });

  it("the review queue row agrees", () => {
    expect(reviewRowScore(67.5, adiyaMatch())).toEqual({
      final_score: PUBLISHED,
      score_band: BAND,
    });
  });

  it("the publish desk agrees", () => {
    // getPublishDeskGroups: score_runs = withVideoIntroBonus(approved ?? current, hasVideoIntro(r)),
    // and admin.publish.tsx prints publishedBand(run).
    const r = adiyaMatch();
    const approved = null;
    const deskRun = withVideoIntroBonus(approved ?? adiyaRun(), hasVideoIntro(r));
    expect(publishedScore(deskRun)).toBe(PUBLISHED);
    expect(publishedBand(deskRun)).toBe(BAND);
  });

  it("the client DTO agrees", () => {
    const dto = toClientCandidateDTO({
      ...adiyaMatch(),
      stage: "delivered",
      candidate_profiles: { full_name: "Adiya" },
      positions: {
        id: "p1",
        title: "Group Marketing Manager",
        requirements: [],
        preferred_requirements: [],
      },
      score_runs: adiyaRun(),
    } as never);
    expect(dto.score).toBe(Math.round(PUBLISHED));
    expect(dto.fit.band).toBe(BAND);
  });

  it("the MCP client tools report the published score and headline, not the stored label", () => {
    const fit = mcpPublishedFit(adiyaMatch(), adiyaRun());
    expect(fit).toEqual({ score: Math.round(PUBLISHED), fitLabel: "Strong", videoBonus: 5 });
  });

  it("the human-verification toast prints evidence + video = published", () => {
    expect(reviewedAssessmentMessage({ final_score: 67.5, video_bonus: 5 })).toBe(
      "Recorded — new reviewed assessment: evidence 67.5 + video 5 = 73/100",
    );
  });

  it("the decision history labels the decision as the reviewed evidence score", () => {
    const m = adiyaMatch();
    const folded = withVideoIntroBonus(adiyaRun(), hasVideoIntro(m));
    expect(evidenceScoreOf(folded)).toBe(67.5);
    expect(isReviewedEvidenceDecision(overrideFor(), folded)).toBe(true);
    expect(evidenceWithVideoLabel(overrideFor().approved_score, hasVideoIntro(m))).toBe(
      "67.5 + video 5 = 73",
    );
  });
});

describe("the ceiling still holds", () => {
  it("a 97.5 override with a video publishes 100 in the header, not 102.5", () => {
    const run = headerRun("97.50");
    expect(publishedScore(run)).toBe(100);
    expect(publishedBand(run)).toBe("exceptional");
    expect((run as { video_bonus_awarded?: number }).video_bonus_awarded).toBe(2.5);
  });

  it("the review queue caps a 97.5 with a video at 100", () => {
    expect(reviewRowScore(97.5, adiyaMatch())).toEqual({
      final_score: 100,
      score_band: "exceptional",
    });
    expect(reviewRowScore(97, adiyaMatch()).final_score).toBe(100);
  });

  it("the toast and history print the award that fits", () => {
    expect(reviewedAssessmentMessage({ final_score: 97.5, video_bonus: 2.5 })).toBe(
      "Recorded — new reviewed assessment: evidence 97.5 + video 2.5 = 100/100",
    );
    expect(evidenceWithVideoLabel(100, true)).toBe("100");
    // Terms stay additive at the stored precision near the ceiling.
    expect(evidenceWithVideoLabel("97.55", true)).toBe("97.55 + video 2.45 = 100");
  });
});

describe("overrides on runs without a video are unchanged", () => {
  it("a bare (unfolded) run takes the override amount as before", () => {
    const run = withRecordedOverride({ id: "r", score: 66, final_score: 66 }, [
      { decision_type: "override", score_run_id: "r", approved_score: 80 },
    ]);
    expect(publishedScore(run)).toBe(80);
  });

  it("a legacy override that differs from its run is not relabelled", () => {
    const folded = withVideoIntroBonus(adiyaRun(), true);
    expect(isReviewedEvidenceDecision(overrideFor("60.00"), folded)).toBe(false);
    expect(isReviewedEvidenceDecision({ ...overrideFor(), decision_type: "approve" }, folded)).toBe(
      false,
    );
    expect(isReviewedEvidenceDecision({ ...overrideFor(), score_run_id: "other" }, folded)).toBe(
      false,
    );
  });

  it("the toast without a video keeps the bare figure", () => {
    expect(reviewedAssessmentMessage({ final_score: 67.5, video_bonus: 0 })).toBe(
      "Recorded — new reviewed assessment at 67.5/100",
    );
  });
});

describe("the surfaces read through the shared helpers", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("the publish desk selects the video link, folds the bonus and bands the published run", () => {
    const fns = read("src/lib/admin.functions.ts");
    const desk = fns.slice(fns.indexOf("export const getPublishDeskGroups"));
    const body = desk.slice(0, desk.indexOf("export const getOperationsIncidents"));
    expect(body).toMatch(/approved_score_run_id,intro_video_url/);
    expect(body).toMatch(/withVideoIntroBonus\(approved \?\? current, hasVideoIntro\(r\)\)/);
    const page = read("src/routes/_authenticated/admin.publish.tsx");
    expect(page).toMatch(/publishedBand\(run\)/);
    expect(page).not.toMatch(/classifyBand\(Number\(run\.score\)\)/);
  });

  it("the journey tab folds the bonus and labels with the published figure and band", () => {
    const src = read("src/lib/journey.functions.ts");
    expect(src).toMatch(/current_score_run_id, intro_video_url/);
    expect(src).toMatch(/withVideoIntroBonus\(r, hasVideoIntro\(match\)\)/);
    expect(src).toMatch(/publishedScoreDisplay\(pub\)/);
    expect(src).toMatch(/publishedBand\(pub\)/);
  });

  it("the talent-memory snapshot stores the published figure and voids an unreadable CV", () => {
    const src = read("src/lib/talent-memory.functions.ts");
    expect(src).toMatch(/approved_score_run_id, intro_video_url, processing_state/);
    expect(src).toMatch(
      /scoreVoidedByUnreadableCv\(match as AnyRow\)\s*\?\s*null\s*:\s*publishedScore\(withVideoIntroBonus\(/,
    );
    expect(src).not.toMatch(/score_snapshot: \(run as AnyRow\)\?\.final_score/);
  });

  it("the MCP tools no longer return the stored fit_label", () => {
    for (const p of ["src/lib/mcp/tools/get-candidate.ts", "src/lib/mcp/tools/list-shortlist.ts"]) {
      const src = read(p);
      expect(src, p).toMatch(/mcpPublishedFit\(/);
      expect(src, p).not.toMatch(/fitLabel: run\.fit_label/);
    }
  });

  it("the human-adjusted run returns the published figure and the panel prints it", () => {
    const server = read("src/lib/scoring/human-adjusted-run.server.ts");
    expect(server).toMatch(/current_score_run_id,intro_video_url/);
    expect(server).toMatch(
      /published_score: scoreVoidedByUnreadableCv\(match\)\s*\?\s*null\s*:\s*publishedScore\(/,
    );
    const panel = read("src/components/admin/human-verification-panel.tsx");
    expect(panel).toMatch(/reviewedAssessmentMessage\(/);
  });
});
