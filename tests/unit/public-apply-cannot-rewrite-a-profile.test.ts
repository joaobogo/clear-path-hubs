/**
 * A public job application cannot rewrite somebody else's identity record.
 *
 * `submitApplication` is unauthenticated by design — a job application form must
 * work for someone with no account. It resolved an existing candidate by
 * `ilike("email", …)` and then overwrote that profile's full_name, phone, all
 * location and social fields, its `consent` object, and its current_cv_file_id
 * with whatever the submitter typed (audit 1 Sep, F42).
 *
 * Matching on the email STRING is not evidence the submitter controls the
 * address. So anyone who knew a candidate's email could rewrite that
 * candidate's name and contact details, flip `network_opt_in`, restamp the
 * consent record, and repoint the CV a client downloads at a document they
 * uploaded themselves.
 *
 * Two rules hold it shut, and this reads the source for both:
 *
 *   claimed profile   (user_id IS NOT NULL) — read-only from this endpoint.
 *   unclaimed profile (user_id IS NULL)     — fill blanks, never overwrite.
 *
 * This is a source-reading guard rather than a behavioural one because the
 * handler needs a live Supabase to run. It is deliberately specific about WHICH
 * writes must be conditional, so deleting the condition fails here rather than
 * in production.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src", "lib", "apply.server.ts"), "utf8");

/** The submitApplication handler only. */
const handler = (() => {
  const start = src.indexOf("export async function submitApplicationServer");
  const from = start === -1 ? 0 : start;
  return src.slice(from);
})();

describe("the public application endpoint", () => {
  it("decides whether the profile is claimed before writing anything", () => {
    expect(
      src,
      "without this flag there is nothing to condition the writes on",
    ).toMatch(/const profileIsClaimed = Boolean\(existingCp\?\.user_id\)/);
  });

  it("does not touch a claimed profile", () => {
    // The identity-overwrite branch must be behind the claimed check.
    expect(src).toMatch(/if \(!profileIsClaimed\)/);

    // And the old unconditional overwrite must be gone. Its signature was a
    // full_name write followed by a bare .eq("id", candidateProfileId).
    const overwrote = /\.update\(\{\s*full_name: data\.full_name,[\s\S]{0,400}?\}\)\s*\.eq\("id", candidateProfileId\);/;
    expect(
      src,
      "an unconditional overwrite of full_name/phone/consent is the finding itself",
    ).not.toMatch(overwrote);
  });

  it("fills blanks rather than overwriting values that are already there", () => {
    // An unclaimed profile may still be a different real person.
    expect(src).toMatch(/const blank = \(col: string\)/);
    expect(src).toMatch(/if \(blank\("full_name"\) && data\.full_name\)/);
    expect(src).toMatch(/if \(blank\("phone"\) && data\.phone\)/);
    expect(
      src,
      "consent is the record that answers 'did this person agree' — it must not be restamped",
    ).toMatch(/if \(blank\("consent"\)\)/);
  });

  it("re-asserts unclaimed at write time, not just at read time", () => {
    // The profile can be claimed between the SELECT and the UPDATE.
    const guarded = src.match(/\.is\("user_id", null\)/g) ?? [];
    expect(
      guarded.length,
      "expected the race guard on both the profile patch and the CV pointer",
    ).toBeGreaterThanOrEqual(2);
  });

  it("never repoints a claimed profile's current CV", () => {
    // A client opening that candidate downloads whatever this points at.
    expect(src).toMatch(
      /if \(!profileIsClaimed\) \{\s*await supabaseAdmin\s*\.from\("candidate_profiles"\)\s*\.update\(\{ current_cv_file_id: fileId \}\)/,
    );
  });

  it("still reads the columns it needs to decide all of the above", () => {
    // A patch computed against columns that were never selected silently
    // treats every field as blank, which reinstates the overwrite.
    for (const col of ["full_name", "phone", "consent", "linkedin_url"]) {
      expect(handler, `${col} must be selected to be compared`).toMatch(
        new RegExp(`select\\([\\s\\S]{0,300}${col}`),
      );
    }
  });
});
