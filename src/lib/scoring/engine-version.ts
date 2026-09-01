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
/**
 * v1.5.3 — the guards above, applied where they were needed (audit 1 Sep).
 *
 * Neither of these is a new rule. Both are rules v1.5.0 and v1.5.1 already
 * declared, reaching a case they never actually covered — which is why an
 * auditor found them still live on a record scored under v1.5.2, and why the
 * Supabase sentence below had already been reported in audit #5.
 *
 *   1. The negation and self-deprecating-qualifier test ran on the CV ONLY.
 *      A term found in a SCREENING ANSWER was credited without it, so
 *      "I'm less experienced with React/Supabase" — the exact sentence the
 *      v1.5.1 note names — went out as Supabase · Met. Screening answers are
 *      where a candidate is most likely to qualify a claim, so this was the
 *      corpus the guard was needed on most.
 *   2. The named-product gate demoted "met" to "partial" when none of the
 *      products a requirement names appeared, and left an existing "partial"
 *      untouched. A requirement that never reached met therefore kept credit
 *      it had earned on framing words: "Experience with Lovable for rapid
 *      website and application development" was Partial on "application" and
 *      "development", quoted against MongoDB, Express and Jenkins. Generic
 *      overlap is not evidence of a named tool at any status.
 *
 * Scores move DOWN for requirements credited from a qualified screening answer
 * or from framing words around a product name. Both directions of the
 * named-product gate are unchanged otherwise: naming the product is still the
 * evidence, whatever the keyword ratio does.
 */
/**
 * v1.5.4 — the same guard, one branch over (audit 1 Sep rev 16).
 *
 * v1.5.3 put the negation test on the screening path, and put it inside the
 * `hits.length === 0` branch — the fallback for "the CV said nothing". So it
 * covered the candidate whose CV is silent about Supabase and missed the one
 * whose CV lists Supabase and whose screening answer then says "I'm less
 * experienced with React/Supabase". That is the more common of the two shapes
 * and it produced the identical false Met, because the qualifying sentence was
 * never read at all.
 *
 * What that one row propped up, per the audit: the Score tab's headline
 * "Preferred coverage 100%" and a named STRENGTH, "Demonstrated: Experience
 * with Supabase", on the role's only preferred requirement. A false Met is
 * rarely just one chip.
 *
 * A qualifying statement in a screening answer now caps a CV-matched
 * requirement the same way a qualifying statement in the CV does: status falls
 * from met to partial, needs_validation is set, and the passage is kept so a
 * reviewer sees what was read. Scores move DOWN only for candidates who
 * qualified their own claim; the golden corpus is unchanged.
 *
 * This is the fourth fix in this series applied to one branch while a sibling
 * kept the old behaviour, so the guard test asserts the property across both
 * branches rather than the branch that was wrong this time.
 */
export const ENGINE_VERSION = "taasflow-scoring-v1.5.4";
