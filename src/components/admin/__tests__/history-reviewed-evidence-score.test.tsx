/**
 * The History tab and the history timeline printed the decision
 * apply_reviewed_verdicts records as "override @ 67.50" and
 * "approved_score: 67.50", beside run rows reading "Score 73 · Strong". A
 * reader concluded a human had overridden Adiya down and her video counted for
 * nothing. That decision equals its run: it is the reviewed evidence score,
 * and with a video attached the published total is shown beside it.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));

import { HistoryTab } from "@/components/admin/candidate-detail/tabs";
import { loadCandidateHistory } from "@/lib/candidate-history.server";
import { hasVideoIntro, withVideoIntroBonus } from "@/lib/scoring/published-score";

const DRIVE_URL = "https://drive.google.com/file/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/view";
const RUN_ID = "88af9d95-a66f-47a4-a284-1efa90d3e13a";
const MATCH_ID = "b058712e-53c1-4072-9cf5-43c3d84b9801";

const match = { id: MATCH_ID, intro_video_url: DRIVE_URL, candidate_profile_id: "cp1" };
const run = {
  id: RUN_ID,
  score: "67.50",
  final_score: "67.50",
  status: "completed",
  engine_version: "taasflow-scoring-v1.7.3",
  completed_at: "2026-11-01T22:50:05Z",
};
const reviewed = {
  id: "9f29c78e-a7cb-4f7b-a6a8-a924757c2d8c",
  decision_type: "override",
  score_run_id: RUN_ID,
  approved_score: "67.50",
  reason:
    "Reviewed requirement verdicts scored by the platform formula (human-adjusted run 88af9d95).",
  actor_user_id: null,
  created_at: "2026-11-01T22:50:05Z",
};
const legacy = {
  ...reviewed,
  id: "legacy-1",
  approved_score: "60.00",
  reason: "~5 yrs marketing; must-haves not met.",
  created_at: "2026-10-29T10:00:00Z",
};

function historyTab(m: Record<string, unknown> | undefined, decisions: Record<string, unknown>[]) {
  // getAdminMatch folds every run before the tab sees it.
  const runs = [withVideoIntroBonus(run, hasVideoIntro(m))];
  return renderToStaticMarkup(<HistoryTab runs={runs} jobs={[]} decisions={decisions} match={m} />);
}

describe("History tab decisions", () => {
  it("labels apply_reviewed_verdicts' decision as the reviewed evidence score with the published total", () => {
    const html = historyTab(match, [reviewed]);
    expect(html).toContain("Reviewed evidence score");
    expect(html).toContain("67.5 + video 5 = 72.5");
    expect(html).not.toContain("override");
    expect(html).not.toContain("@ 67.50");
  });

  it("shows the evidence figure alone when no video is attached", () => {
    const html = historyTab({ ...match, intro_video_url: null }, [reviewed]);
    expect(html).toContain("Reviewed evidence score");
    expect(html).not.toContain("+ video");
  });

  it("leaves a legacy override that differs from its run as it was recorded", () => {
    const html = historyTab(match, [legacy]);
    expect(html).toContain("override");
    expect(html).toContain("@ 60.00");
    expect(html).not.toContain("Reviewed evidence score");
  });
});

/** A read-only stand-in for the admin client: every query resolves to the table's rows. */
function fakeAdmin(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit", "not", "is"]) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
      builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
      return builder;
    },
  };
}

describe("history timeline", () => {
  async function scoreEvents(m: Record<string, unknown>, decisions: Record<string, unknown>[]) {
    const history = await loadCandidateHistory(
      fakeAdmin({
        candidate_matches: [{ ...m, candidate_profiles: { full_name: "Adiya" } }],
        score_decisions: decisions,
        score_runs: [run],
      }) as never,
      { matchId: MATCH_ID },
    );
    return history.events.filter((e) => e.source === "score_decision");
  }

  it("names the decision as the reviewed evidence score and shows the published total", async () => {
    const [event] = await scoreEvents(match, [reviewed]);
    expect(event.action_label).toBe("Reviewed evidence score");
    expect(event.context).toContainEqual({
      field: "reviewed_evidence_score",
      before: null,
      after: "67.5 + video 5 = 72.5",
    });
    expect(event.context?.some((c) => c.field === "approved_score")).toBe(false);
  });

  it("keeps a legacy override's recorded amount", async () => {
    const [event] = await scoreEvents(match, [legacy]);
    expect(event.action_label).toBe("Override");
    expect(event.context).toContainEqual({ field: "approved_score", before: null, after: "60.00" });
  });
});
