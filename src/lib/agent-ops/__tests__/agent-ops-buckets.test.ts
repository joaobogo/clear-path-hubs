import { describe, expect, it } from "vitest";
import { isSupersededError, runBucket, RUN_BUCKETS } from "../agent-ops";

describe("runBucket", () => {
  it("maps processing_jobs statuses to real buckets", () => {
    expect(runBucket("completed")).toBe("completed");
    expect(runBucket("failed")).toBe("failed");
    expect(runBucket("running")).toBe("active");
    expect(runBucket("queued")).toBe("queued");
    expect(runBucket("cancelled")).toBe("superseded");
    expect(runBucket("superseded")).toBe("superseded");
  });

  it("maps candidate processing states too", () => {
    expect(runBucket("scored")).toBe("completed");
    expect(runBucket("parsing")).toBe("active");
    expect(runBucket("ocr_required")).toBe("waiting_approval");
  });

  it("never invents pending work from an unknown status", () => {
    expect(runBucket("wat")).not.toBe("queued");
    expect(runBucket(null)).not.toBe("queued");
  });

  it("returns a known bucket for every input", () => {
    for (const s of ["completed", "failed", "queued", "running", "zzz", null]) {
      expect(RUN_BUCKETS).toContain(runBucket(s));
    }
  });
});

describe("isSupersededError", () => {
  it("recognises collision errors", () => {
    expect(
      isSupersededError("engine_error", "superseded: an up-to-date scoring run already existed"),
    ).toBe(true);
    expect(isSupersededError("superseded_by_retry", null)).toBe(true);
    expect(
      isSupersededError(null, 'duplicate key value violates unique constraint "score_runs_active_input_key"'),
    ).toBe(true);
  });

  it("leaves genuine failures alone", () => {
    expect(isSupersededError("provider_blocked", "The model refused the document")).toBe(false);
    expect(isSupersededError(null, null)).toBe(false);
  });
});
