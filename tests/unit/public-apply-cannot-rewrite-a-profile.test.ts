/**
 * A public job application cannot rewrite somebody else's identity record.
 *
 * `submitApplicationImpl` is unauthenticated by design — a job application must
 * work for someone with no account. It resolved an existing candidate by
 * `ilike("email", …)` and then overwrote that profile's full_name, phone, all
 * location and social fields, its `consent` object, and its current_cv_file_id
 * with whatever the submitter typed (audit 1 Sep, F42).
 *
 * Matching on the email STRING is not evidence the submitter controls the
 * address. Anyone who knew a candidate's email could rewrite their contact
 * details, restamp consent, and repoint the CV a client downloads at a document
 * they had uploaded themselves.
 *
 * The implementation this guards is the one on main, which proves ownership
 * rather than inferring it: `getCallerEmail()` must return the same address as
 * the submission before any stored value is replaced. Everyone else fills
 * blanks only. That is a stronger rule than keying on whether the profile has
 * been claimed — an UNCLAIMED profile carrying a real CV is protected too.
 *
 * Source-reading rather than behavioural because the handler needs a live
 * Supabase. It is deliberately specific about WHICH writes must be conditional,
 * so removing a condition fails here rather than in production.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "src", "lib", "apply.server.ts"), "utf8");

describe("the public application endpoint", () => {
  it("proves who the caller is before trusting the email", () => {
    // The whole fix rests on this: without it there is nothing to distinguish
    // the owner of an address from someone who merely typed it.
    expect(src).toMatch(/getCallerEmail/);
    expect(src).toMatch(/const isProfileOwner = !!existingCp && callerEmail === emailLower/);
  });

  it("only a verified owner may replace stored personal details", () => {
    expect(src).toMatch(/if \(isProfileOwner\)/);

    // The finding's original shape: an unconditional overwrite of the identity
    // fields, keyed on nothing but a matching email string.
    const overwrote =
      /\.update\(\{\s*full_name: data\.full_name,[\s\S]{0,400}?\}\)\s*\.eq\("id", candidateProfileId\);/;
    expect(
      src,
      "an unconditional overwrite of full_name/phone/consent is the finding itself",
    ).not.toMatch(overwrote);
  });

  it("everyone else fills blanks and never replaces a stored value", () => {
    // An unverified submitter may complete a stub, not rewrite a person.
    expect(src).toMatch(/const isBlank =/);
    expect(src).toMatch(/if \(isBlank && value !== null/);
  });

  it("does not restamp consent for an unverified submitter", () => {
    // consent is the record that answers "did this person agree to this", so it
    // is written in the owner branch only.
    const ownerBranch = src.slice(src.indexOf("if (isProfileOwner)"), src.indexOf("} else {", src.indexOf("if (isProfileOwner)")));
    expect(ownerBranch).toMatch(/consent:/);
  });

  it("never repoints a CV that is already on the profile", () => {
    // Whatever this points at is what a client downloads for that candidate.
    expect(src).toMatch(
      /if \(profileIsNew \|\| isProfileOwner \|\| !existingCp\?\.current_cv_file_id\)/,
    );
  });

  it("reads the columns the blank-check compares against", () => {
    // A patch computed against columns that were never selected treats every
    // field as blank, which reinstates the overwrite.
    for (const col of ["full_name", "phone", "linkedin_url", "current_cv_file_id"]) {
      expect(src, `${col} must be selected to be compared`).toMatch(
        new RegExp(`select\\([\\s\\S]{0,300}${col}`),
      );
    }
  });
});
