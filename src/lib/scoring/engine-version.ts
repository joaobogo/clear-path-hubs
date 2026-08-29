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
 *
 * v1.5.0 — fairness release (audit S-05). Five deterministic changes, all
 * data-driven, none model-driven:
 *   1. Portuguese surface forms + capability realisations in the synonym
 *      table (segurança→security, diagnosed→troubleshoot, …).
 *   2. Bounded inflection matching: terms of 6+ letters also match their
 *      s/es/ed/ing forms ("workflow"→"workflows"); short ambiguous names
 *      (go, java, react) are untouched.
 *   3. Elaboration words that double as CV section headers ("professional",
 *      "skills", "technical", …) no longer count as keywords — they gave
 *      English-format CVs free credit PT CVs could not earn.
 *   4. An alternatives list of proper nouns ("Cloudflare, Netlify, or
 *      Vercel") is met by ANY one, not all of them.
 *   5. Screening answers are evidence: answer text is scanned for
 *      requirement terms, and a linked affirmative boolean floors a silent
 *      requirement at "partial · needs validation" instead of flagging a
 *      contradiction. The contradiction flag now fires only when the CV
 *      affirmatively negates what the answer claims.
 * Scores move (upward for previously under-credited candidates) — that is
 * the point of the release.
 */
/**
 * v1.5.1 — evidence honesty (audit #4, H5/M6). Two deterministic guards:
 *   1. Named-product gate: a requirement that names specific products
 *      ("Experience with Lovable", "Cloudflare, Netlify, or Vercel") can only
 *      reach "met" when one of those names actually appears. It was returning
 *      MET while quoting AWS and Kibana on a CV with no mention of Lovable.
 *   2. Self-deprecating qualifiers ("less experienced with", "still learning",
 *      "pouca experiência") join the negation cues, so "I'm less experienced
 *      with React/Supabase" stops crediting Supabase as evidence.
 * Scores move DOWN for requirements that were credited without support.
 */
/**
 * v1.5.2 — no claim without a passage (audit #4, M6). Two more guards, both
 * deterministic:
 *   1. A negation is no longer discarded because the same term also matched
 *      somewhere positive. "I'm less experienced with React/Supabase" was
 *      ignored the moment Supabase appeared elsewhere, and the row went out
 *      as MET; a qualifying statement now caps the row at "partial · needs
 *      validation".
 *   2. A "met" or "partial" row must carry at least one quote. Rows that
 *      matched a term but captured no passage went to the client as verdicts
 *      nobody could check ("English · Met" with nothing behind it); they are
 *      now "unknown · needs validation", which is what they actually are.
 * Scores move DOWN for requirements that were credited without a passage.
 */
export const ENGINE_VERSION = "taasflow-scoring-v1.5.2";
