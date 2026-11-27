/**
 * Scoring fix spec, 26 Nov 2026: "do a dry-run report for every other open
 * role before re-scoring them". The preview lists, per scored candidate, the
 * score shown today beside the one a re-score would show and the requirements
 * that would change. It must only read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const POS = "a781288f-cf6f-45d6-b78f-5db5a846bc15";
const STAFF = "e60fd0fc-0000-4000-8000-000000000001";
const writes: string[] = [];
let staff = true;
let matches: Row[] = [];

const admin = {
  rpc: async () => ({ data: staff }),
  from: (table: string) => {
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      not: () => api,
      order: () => api,
      range: async () => ({ data: matches, error: null, count: matches.length }),
      insert: () => (writes.push(`${table}:insert`), api),
      update: () => (writes.push(`${table}:update`), api),
      upsert: () => (writes.push(`${table}:upsert`), api),
      delete: () => (writes.push(`${table}:delete`), api),
    };
    return api;
  },
};
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin }));

const previews = new Map<string, unknown>();
vi.mock("@/lib/scoring-service.server", () => ({
  previewScoring: async (id: string) => {
    const p = previews.get(id);
    if (p instanceof Error) throw p;
    return p;
  },
}));

import {
  previewRoleRescoreHandler,
  previewRoleRescoreValidate,
} from "../rescore-preview.functions";

const match = (id: string, name: string, run: Row): Row => ({
  id,
  admin_status: "pending",
  client_visibility: "hidden",
  current_score_run_id: `run-${id}`,
  candidate_profiles: { full_name: name },
  score_runs: run,
});
const context = { supabase: null, userId: STAFF };
const call = () =>
  previewRoleRescoreHandler({ data: previewRoleRescoreValidate({ position_id: POS }), context });

beforeEach(() => {
  staff = true;
  writes.length = 0;
  previews.clear();
  matches = [];
});

describe("a role's re-score, previewed", () => {
  it("shows today's score beside the re-scored one, and each requirement that would change", async () => {
    matches = [
      match("m-reviewed", "Reviewed Candidate", {
        final_score: 75,
        evaluation_method: "human_adjusted",
        engine_version: "taasflow-scoring-v1.7.12",
        result: {
          requirement_assessment: [
            { id: "req-2", status: "partial" },
            { id: "req-4", status: "missing" },
            { id: "req-5", status: "met" },
          ],
        },
      }),
      match("m-machine", "Machine Candidate", {
        final_score: 60.4,
        evaluation_method: "deterministic",
        engine_version: "taasflow-scoring-v1.7.12",
        result: { requirement_assessment: [{ id: "req-0", status: "met" }] },
      }),
      match("m-unscorable", "Unscorable Candidate", {
        final_score: 41,
        evaluation_method: "deterministic",
        engine_version: "taasflow-scoring-v1.7.9",
        result: { requirement_assessment: [] },
      }),
    ];
    previews.set("m-reviewed", {
      ok: true,
      match_id: "m-reviewed",
      engine_version: "taasflow-scoring-v1.8.0",
      inputs_unchanged: false,
      machine: {
        score: 80,
        fit_label: "strong_fit",
        statuses: { "req-2": "met", "req-4": "partial", "req-5": "met" },
      },
      // The review is put back: the shown status is the reviewed one.
      reviewed: {
        score: 85,
        statuses: { "req-2": "met", "req-4": "partial", "req-5": "met" },
        kept: 4,
        followed_machine: 0,
      },
      shown_score: 85,
      eligibility: "eligible",
    });
    previews.set("m-machine", {
      ok: true,
      match_id: "m-machine",
      engine_version: "taasflow-scoring-v1.8.0",
      inputs_unchanged: false,
      machine: { score: 60.4, fit_label: "good_fit", statuses: { "req-0": "met" } },
      reviewed: null,
      shown_score: 60.4,
      eligibility: "eligible",
    });
    previews.set("m-unscorable", { ok: false, match_id: "m-unscorable", reason: "cv_unparsed" });

    const out = await call();
    expect(out.total).toBe(3);
    expect(out.rows[0]).toMatchObject({
      candidate: "Reviewed Candidate",
      current: { score: 75, method: "human_adjusted" },
      preview: { machine_score: 80, shown_score: 85, reviewed: true },
      delta: 10,
      changes: [
        { id: "req-2", from: "partial", to: "met" },
        { id: "req-4", from: "missing", to: "partial" },
      ],
    });
    expect(out.rows[1]).toMatchObject({ delta: 0, changes: [], preview: { reviewed: false } });
    expect(out.rows[2]).toMatchObject({ preview: null, reason: "cv_unparsed", delta: null });
    // Looking changes nothing.
    expect(writes).toEqual([]);
  });

  it("reports a candidate whose preview fails instead of failing the whole role", async () => {
    matches = [
      match("m-boom", "Broken Candidate", {
        final_score: 50,
        evaluation_method: "deterministic",
        engine_version: "taasflow-scoring-v1.7.12",
        result: {},
      }),
    ];
    previews.set("m-boom", new Error("inputs_unreadable"));
    const out = await call();
    expect(out.rows[0]).toMatchObject({ preview: null, reason: "inputs_unreadable" });
  });

  it("is staff only", async () => {
    staff = false;
    await expect(call()).rejects.toThrow("forbidden");
  });
});
