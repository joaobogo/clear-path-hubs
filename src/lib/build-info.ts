/**
 * Which build is actually serving this page.
 *
 * The engine version was doing this job and cannot. ENGINE_VERSION changes only
 * when scoring SEMANTICS change, so a release containing nothing but interface
 * and derivation fixes ships under the same number as the release before it.
 * That is correct for score reproducibility and useless as a deploy marker:
 * after audit #8 cleared its gate on v1.5.2, sixteen further commits published
 * under v1.5.2 as well, and "Engine running today" could no longer answer the
 * one question every audit starts with — am I testing the code I am reading?
 *
 * The publish gap has now caused three audits to report fixed items as still
 * open (audits #3, #7, and the standing caveat on #8). It is a reporting
 * problem, not a code problem, and this is the reporting fix: a marker that
 * changes on every build, whatever changed in it.
 *
 * Values are injected by vite.config.ts at build time. In dev, and in any
 * environment where git is unavailable, they degrade to something honest
 * rather than to a plausible-looking lie.
 */

declare const __BUILD_SHA__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

function injected(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value !== "unknown" ? value : null;
}

export type BuildInfo = {
  /** Short commit sha of the build, or null when it could not be determined. */
  sha: string | null;
  /** ISO timestamp the bundle was built, or null. */
  builtAt: string | null;
  /** One line for a status strip. Never claims a build it cannot identify. */
  label: string;
};

export function buildInfo(): BuildInfo {
  const sha = injected(typeof __BUILD_SHA__ === "undefined" ? null : __BUILD_SHA__);
  const builtAt = injected(typeof __BUILD_TIME__ === "undefined" ? null : __BUILD_TIME__);

  if (!sha && !builtAt) return { sha, builtAt, label: "build not stamped" };
  if (sha && builtAt) return { sha, builtAt, label: `build ${sha}` };
  return { sha, builtAt, label: sha ? `build ${sha}` : "build time only" };
}
