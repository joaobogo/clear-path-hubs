/**
 * One person is described one way, on every client surface.
 *
 * The board and list showed "Matheus Poss De Oliveira · Candidate" and
 * "Wesley Franco · Candidate" beside rows carrying real titles, so the two
 * highest-scoring people were the least described — while MPO's own detail
 * page read "Freelance Developer | OAuth & API Integrations @ ByBooker"
 * (audit 1 Sep, F38).
 *
 * Two causes, both of the recurring kind:
 *
 *   1. Three components kept their own copy of the line — candidate-card,
 *      compact-list and position-detail/pipeline-board — and the third read
 *      `headline` straight off the profile row rather than the resolved DTO
 *      field. Same shape as F3, F8 and F17.
 *   2. prettifyHeadline assumed a missing headline is null. It can be the word
 *      itself: a stored "Candidate" is truthy, so it was returned unchanged and
 *      the parsed job title underneath was never reached. All three copies also
 *      used `??` on a field that is "" for "nothing known", so their own
 *      fallbacks could not run either.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { candidateLineFor, prettifyHeadline } from "@/lib/client-fit-presentation";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const SURFACES = [
  "src/components/client/candidate-card.tsx",
  "src/components/client/candidates/compact-list.tsx",
  "src/components/client/position-detail/pipeline-board.tsx",
];

describe("a generic noun is never a headline", () => {
  it("falls through the stored placeholder to the parsed role", () => {
    expect(
      prettifyHeadline("Candidate", { role: "Freelance Developer", company: "ByBooker" }),
    ).toBe("Freelance Developer at ByBooker");
  });

  it("treats the other placeholder nouns the same way", () => {
    for (const word of ["candidate", "CANDIDATE", "Applicant", "N/A", "Unknown", "Candidato"]) {
      expect(prettifyHeadline(word, { role: "Backend Engineer" }), word).toBe("Backend Engineer");
    }
  });

  it("keeps a real headline that merely contains the word", () => {
    // "Candidate Experience Lead" is a job. Matching must be on the whole
    // value, not a substring, or the guard eats real titles.
    expect(prettifyHeadline("Candidate Experience Lead", { role: "Other" })).toBe(
      "Candidate Experience Lead",
    );
  });

  it("returns nothing rather than a placeholder when nothing is known", () => {
    expect(prettifyHeadline("Candidate", {})).toBe("");
    expect(prettifyHeadline(null, {})).toBe("");
  });
});

describe("the line is built in one place", () => {
  it("appends the meta to a resolved title", () => {
    expect(
      candidateLineFor({
        headline: "Candidate",
        current_role: "Full-Stack Developer",
        years_experience: 5,
        location: "Curitiba",
      }),
    ).toBe("Full-Stack Developer · 5 yrs · Curitiba");
  });

  it("lets the location speak alone when there is no title", () => {
    expect(candidateLineFor({ headline: "Candidate", location: "Curitiba" })).toBe("Curitiba");
  });

  it("is what every client surface calls", () => {
    for (const file of SURFACES) {
      const src = read(file);
      expect(src, `${file} must use the shared resolver`).toMatch(/candidateLineFor/);
    }
  });

  it("leaves no surface building the line itself", () => {
    // The exact shape that let the board and the list disagree: a local
    // fallback chain off headline, with ?? in front of it.
    for (const file of SURFACES) {
      const src = read(file);
      expect(src, `${file} still has its own fallback chain`).not.toMatch(
        /headline\s*\?\?\s*\n?\s*\[/,
      );
    }
  });
});
