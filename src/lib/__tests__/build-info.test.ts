/**
 * A deploy marker that never invents a build.
 *
 * The engine version was serving as the deploy marker and cannot: it moves only
 * when scoring semantics move, so sixteen commits published under v1.5.2 after
 * audit #8 gated on v1.5.2. Three audits have now reported already-fixed items
 * as still open because there was no way to tell which build was serving.
 *
 * The one thing this must never do is show a confident identifier it does not
 * have — that would make the gap invisible instead of merely undetectable.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const g = globalThis as Record<string, unknown>;

function withStamp(sha: unknown, time: unknown) {
  if (sha === undefined) delete g.__BUILD_SHA__;
  else g.__BUILD_SHA__ = sha;
  if (time === undefined) delete g.__BUILD_TIME__;
  else g.__BUILD_TIME__ = time;
}

async function load() {
  vi.resetModules();
  return (await import("@/lib/build-info")).buildInfo();
}

beforeEach(() => withStamp(undefined, undefined));
afterEach(() => withStamp(undefined, undefined));

describe("buildInfo", () => {
  it("reports the stamped commit", async () => {
    withStamp("ca05fa2", "2026-09-01T08:00:00.000Z");
    const b = await load();
    expect(b.sha).toBe("ca05fa2");
    expect(b.builtAt).toBe("2026-09-01T08:00:00.000Z");
    expect(b.label).toBe("build ca05fa2");
  });

  it("says it is not stamped rather than guessing", async () => {
    // Dev, or a build environment with no git and no CI sha.
    const b = await load();
    expect(b.sha).toBeNull();
    expect(b.builtAt).toBeNull();
    expect(b.label).toBe("build not stamped");
  });

  it("treats the literal 'unknown' as not stamped", async () => {
    // vite.config falls back to "unknown" when git is unavailable; that string
    // must not reach a screen as if it were an identifier.
    withStamp("unknown", "unknown");
    const b = await load();
    expect(b.sha).toBeNull();
    expect(b.label).toBe("build not stamped");
  });

  it("treats an empty stamp as not stamped", async () => {
    withStamp("", "");
    const b = await load();
    expect(b.sha).toBeNull();
    expect(b.label).toBe("build not stamped");
  });

  it("never renders a label containing 'undefined' or 'null'", async () => {
    for (const [sha, time] of [
      [undefined, undefined],
      ["ca05fa2", undefined],
      [undefined, "2026-09-01T08:00:00.000Z"],
      [null, null],
    ]) {
      withStamp(sha, time);
      const b = await load();
      expect(b.label).not.toMatch(/undefined|null|NaN/);
      expect(b.label.length).toBeGreaterThan(0);
    }
  });
});
