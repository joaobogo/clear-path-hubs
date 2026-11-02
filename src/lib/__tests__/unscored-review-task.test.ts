/**
 * "A candidate the pipeline cannot score always has an open admin task", for
 * a CV held with cv_employment_history_missing (owner item 6a, 2 Nov 2026).
 * One of the two Mushroom Harvesting Manager applicants had no task at all.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { candidateReviewTask } from "@/lib/cv/unscored-review";
import { ensureUnscoredReviewTask } from "@/lib/cv/unscored-review.server";

type Row = Record<string, unknown>;

/**
 * The few supabase-js calls the helper makes, recorded. The tasks table
 * applies the filters the helper sends to the rows it holds, so a test shows
 * which existing tasks count as "already open".
 */
function fakeClient(opts: { match: Row | null; openTasks?: Row[]; failInsert?: boolean }) {
  const inserts: Row[] = [];
  const filters: unknown[][] = [];
  const matches = (row: Row, f: unknown[]) => {
    const [k, col, val] = f as [string, string, unknown];
    if (k === "eq") return row[col] === val;
    if (k === "in") return (val as unknown[]).includes(row[col]);
    if (k === "is") return (row[col] ?? null) === val;
    if (k === "contains") {
      const have = (row[col] ?? {}) as Row;
      return Object.entries(val as Row).every(([key, v]) => have[key] === v);
    }
    return true;
  };
  const query = (rows: Row[] | null, single: boolean) => {
    const own: unknown[][] = [];
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "in", "is", "contains", "limit"]) {
      q[k] = (...args: unknown[]) => {
        filters.push([k, ...args]);
        own.push([k, ...args]);
        return q;
      };
    }
    const result = () => {
      if (single) return { data: rows?.[0] ?? null, error: null };
      const kept = (rows ?? []).filter((r) => own.every((f) => matches(r, f)));
      return { data: kept.map(({ id }) => ({ id })), error: null };
    };
    q.maybeSingle = async () => result();
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(ok, ko);
    return q;
  };
  const client = {
    from(table: string) {
      if (table === "candidate_matches") return query(opts.match ? [opts.match] : null, true);
      if (table === "tasks") {
        const q = query(opts.openTasks ?? [], false);
        q.insert = async (row: Row) => {
          if (opts.failInsert) throw new Error("insert failed");
          inserts.push(row);
          return { error: null };
        };
        return q;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, inserts, filters };
}

const PARKED = {
  id: "3b45fb2e-8cce-42e1-94e8-7677b9c9b341",
  organization_id: "b55b91b7-f473-4d78-8efd-f01f988eca3b",
  position_id: "9466d8ac-0b74-4b14-94e9-0e9d56021fa2",
  candidate_profile_id: "cf1489d5-0bed-43f0-bb86-3c1838ef5ee8",
  current_score_run_id: null,
  processing_error_code: "cv_employment_history_missing",
  processing_error_message:
    "Manual review required - incomplete document. The CV has no dated employment history.",
  positions: { title: "Mushroom Harvesting Manager" },
  candidate_profiles: { full_name: "Candidate B" },
};
const OUTCOME = {
  match_id: PARKED.id,
  trace_id: "pl_test",
  final_state: "manual_review_required",
  steps: [{ step: "score", ok: false }],
};

describe("the task for a CV with no dated roles", () => {
  it("names the cause and the next step, and sends nothing", () => {
    const t = candidateReviewTask({
      code: "cv_employment_history_missing",
      message: PARKED.processing_error_message,
      candidateName: "Candidate B",
      positionTitle: "Mushroom Harvesting Manager",
    });
    expect(t.title).toBe("Candidate B for Mushroom Harvesting Manager: not scored yet");
    expect(t.description).toMatch(/^No dated roles could be read from the CV\./);
    expect(t.description).toMatch(/If its roles carry dates, rescore the candidate/);
    expect(t.description).toMatch(/Nothing has been sent to the candidate\.$/);
    expect(t.reason).toBe("cv_employment_history_missing");
    expect(t.priority).toBe("normal");
  });
});

describe("ensureUnscoredReviewTask", () => {
  it("opens one candidate_review task for a match parked without dated roles", async () => {
    const { client, inserts, filters } = fakeClient({ match: PARKED });
    await ensureUnscoredReviewTask(client, OUTCOME);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      organization_id: PARKED.organization_id,
      position_id: PARKED.position_id,
      candidate_match_id: PARKED.id,
      candidate_profile_id: PARKED.candidate_profile_id,
      task_type: "candidate_review",
      status: "open",
      priority: "normal",
      title: "Candidate B for Mushroom Harvesting Manager: not scored yet",
      metadata: {
        source: "pipeline",
        reason: "cv_employment_history_missing",
        final_state: "manual_review_required",
        trace_id: "pl_test",
      },
    });
    // The duplicate check looks for any open candidate_review task on this
    // match, whoever opened it.
    expect(filters).toContainEqual(["eq", "candidate_match_id", PARKED.id]);
    expect(filters).toContainEqual(["eq", "task_type", "candidate_review"]);
    expect(filters).toContainEqual(["in", "status", ["open", "in_progress"]]);
    expect(filters.filter((f) => f[0] === "contains")).toEqual([]);
  });

  const task = (over: Row): Row => ({
    id: "t1",
    candidate_match_id: PARKED.id,
    task_type: "candidate_review",
    status: "open",
    deleted_at: null,
    metadata: { source: "pipeline" },
    ...over,
  });

  it("reuses an open pipeline task instead of adding another", async () => {
    const { client, inserts } = fakeClient({ match: PARKED, openTasks: [task({})] });
    await ensureUnscoredReviewTask(client, OUTCOME);
    expect(inserts).toHaveLength(0);
  });

  it("reuses an open task from the second review or a backfill: one task per cause (review, 2 Nov 2026)", async () => {
    // Live: 14 open candidate_review tasks from claude_second_review with
    // reason unscored_without_task (Daim's fd9e380b among them), none from
    // the pipeline. Re-parking such a match must not open a second task.
    for (const metadata of [
      { source: "claude_second_review", reason: "unscored_without_task" },
      { source: "unscored_backfill", reason: "cv_employment_history_missing" },
      {},
    ]) {
      const { client, inserts } = fakeClient({ match: PARKED, openTasks: [task({ metadata })] });
      await ensureUnscoredReviewTask(client, OUTCOME);
      expect(inserts).toHaveLength(0);
    }
  });

  it("a closed, deleted, other-type or other-match task does not count as open", async () => {
    for (const over of [
      { status: "done" },
      { status: "cancelled" },
      { deleted_at: "2026-11-01T00:00:00Z" },
      { task_type: "general_follow_up" },
      { candidate_match_id: "another-match" },
    ]) {
      const { client, inserts } = fakeClient({ match: PARKED, openTasks: [task(over)] });
      await ensureUnscoredReviewTask(client, OUTCOME);
      expect(inserts).toHaveLength(1);
    }
  });

  it("a match with a current score, or a skipped run, gets no task", async () => {
    const scored = fakeClient({ match: { ...PARKED, current_score_run_id: "run1" } });
    await ensureUnscoredReviewTask(scored.client, OUTCOME);
    expect(scored.inserts).toHaveLength(0);
    const skipped = fakeClient({ match: PARKED });
    await ensureUnscoredReviewTask(skipped.client, {
      ...OUTCOME,
      steps: [{ step: "skip", ok: true }],
    });
    expect(skipped.inserts).toHaveLength(0);
  });

  it("never throws into the scoring run", async () => {
    const { client } = fakeClient({ match: PARKED, failInsert: true });
    await expect(ensureUnscoredReviewTask(client, OUTCOME)).resolves.toBeUndefined();
  });
});

describe("every path that parks a match without dated roles opens the task", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the scoring service, not only the pipeline around it", () => {
    // A rescore from the review center or a bulk recompute calls the service
    // directly; the pipeline's own call never runs for those.
    const service = read("src/lib/scoring-service.server.ts");
    const at = service.indexOf('code: "cv_employment_history_missing"');
    expect(at).toBeGreaterThan(0);
    const branch = service.slice(at, service.indexOf("return {", at));
    expect(branch).toMatch(/ensureUnscoredReviewTask\(s, \{/);
  });

  it("the pipeline", () => {
    const runner = read("src/lib/pipeline-runner.server.ts");
    expect(runner).toMatch(/await ensureUnscoredReviewTask\(s, outcome\);/);
  });
});
