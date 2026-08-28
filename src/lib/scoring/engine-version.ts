/**
 * Client-safe engine identity.
 *
 * The engine itself is server-only, but browser surfaces need to compare the
 * version that produced a stored score against the version running today in
 * order to say "this was assessed by an older engine". Keeping the constants
 * here means no UI file imports a `.server` module to read a string.
 */
/**
 * Bump this whenever the engine can produce a different number for the same
 * inputs. It is load-bearing in two places:
 *
 *   - input_hash includes it, and a rescore REUSES a completed run whose hash
 *     matches. Without a bump, "rescore everyone" silently returns every old
 *     score and nothing recomputes.
 *   - the freshness model compares it against the version that produced a
 *     stored run, so bumping marks every existing score as assessed by an
 *     older engine and offers the re-check.
 *
 * v1.4.0 — requirement framing words ("proven", "hands-on", "experience") no
 * longer count as keywords, so a candidate is no longer marked down for not
 * writing words nobody writes about themselves.
 *
 * v1.4.1 — "screening contradicts CV" now requires a specific answer whose
 * subject overlaps a specific unevidenced required requirement, and records
 * the pairs in contradiction_rows. The old test (any yes + any missing
 * must-have) flagged essentially every real candidate and blocked approval
 * with nothing to resolve. Scores are unchanged; the flag and concerns are.
 */
export const ENGINE_VERSION = "taasflow-scoring-v1.4.1";
