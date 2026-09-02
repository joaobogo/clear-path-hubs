/**
 * A stage change that did not happen must not report success.
 *
 * The client's Shortlist button POSTed, got HTTP 200 and
 * `{ ok: true, trace_id }`, showed "Added to your shortlist", and the candidate
 * was unchanged on reload. Reproduced on three candidates across two different
 * transitions (launch pass round 7).
 *
 * `update().eq().eq()` returns `error: null` when it matches ZERO rows — that
 * is a successful statement that updated nothing, which is exactly what
 * row-level security produces when a policy filters the target row out. Every
 * stage writer checked only `error`, so "no exception" was read as "it worked".
 *
 * cm_client_editor_update requires client_visibility = 'visible' AND
 * canonical_state = 'published_to_client'. A match that is visible but in a
 * different canonical_state passes the READ policy and fails the WRITE one, so
 * the row is fetchable, the button renders, and the update matches nothing.
 *
 * The fix asks for the row back. These tests drive persistStage against a fake
 * query builder, because the failure is entirely in how the response is read.
 */
import { describe, expect, it } from "vitest";
import { persistStage, StageNotPersistedError } from "@/lib/client/persist-stage";

/** Minimal PostgREST-shaped builder: every method chains, maybeSingle resolves. */
function db(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "update", "eq", "select"]) {
    builder[m] = (...args: unknown[]) => {
      calls[m] = args;
      return builder;
    };
  }
  builder.maybeSingle = async () => result;
  return { builder, calls };
}

describe("persistStage", () => {
  it("throws when the update matched no row, even with error null", () => {
    // The exact shape RLS produces, and the exact shape that was being read as
    // success.
    const { builder } = db({ data: null, error: null });
    return expect(
      persistStage(builder, { matchId: "m1", orgId: "o1", toStage: "shortlisted" }),
    ).rejects.toBeInstanceOf(StageNotPersistedError);
  });

  it("throws when a row came back in a different stage than requested", () => {
    // A trigger rewrote it, or the transition was rejected. Either way the
    // caller must not claim the move.
    const { builder } = db({ data: { id: "m1", stage: "delivered" }, error: null });
    return expect(
      persistStage(builder, { matchId: "m1", orgId: "o1", toStage: "shortlisted" }),
    ).rejects.toBeInstanceOf(StageNotPersistedError);
  });

  it("returns the persisted row when the move really happened", async () => {
    const { builder } = db({ data: { id: "m1", stage: "shortlisted" }, error: null });
    await expect(
      persistStage(builder, { matchId: "m1", orgId: "o1", toStage: "shortlisted" }),
    ).resolves.toEqual({ id: "m1", stage: "shortlisted" });
  });

  it("still surfaces a real database error", async () => {
    const { builder } = db({ data: null, error: { message: "boom" } });
    await expect(
      persistStage(builder, { matchId: "m1", orgId: "o1", toStage: "shortlisted" }),
    ).rejects.toThrow("boom");
  });

  it("asks for the row back — without select there is nothing to check", () => {
    const { builder, calls } = db({ data: { id: "m1", stage: "shortlisted" }, error: null });
    return persistStage(builder, { matchId: "m1", orgId: "o1", toStage: "shortlisted" }).then(
      () => {
        expect(calls.select, "the select is what makes a no-op detectable").toBeDefined();
      },
    );
  });

  it("tells the client something actionable, not a stack trace", () => {
    const err = new StageNotPersistedError("m1", "shortlisted");
    expect(err.message).toMatch(/could not be moved/i);
    expect(err.message).toMatch(/permission/i);
  });
});

describe("every stage writer goes through it", () => {
  it("no server path updates stage without checking a row came back", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const offenders: string[] = [];

    for (const file of [
      "src/lib/client-decisions.functions.ts",
      "src/lib/hires.functions.ts",
      "src/lib/interview-feedback.functions.ts",
    ]) {
      const body = readFileSync(join(process.cwd(), file), "utf8");
      // A bare stage update with no .select() cannot tell a filtered-out row
      // from a successful one.
      const bare = /\.from\("candidate_matches"\)\s*\n\s*\.update\(\{\s*stage[\s\S]{0,120}?\.eq\("organization_id"[^)]*\);/g;
      for (const m of body.matchAll(bare)) {
        if (!m[0].includes(".select(")) {
          offenders.push(`${file}: ${m[0].split("\n")[1]?.trim() ?? m[0].slice(0, 60)}`);
        }
      }
    }

    expect(
      offenders,
      "these can report success for a write RLS discarded:\n" + offenders.join("\n"),
    ).toEqual([]);
  });
});
