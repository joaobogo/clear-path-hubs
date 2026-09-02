/**
 * The talent-pool filters, tested without a populated pool.
 *
 * Two browser passes could not reach these: every workspace's pool is empty, so
 * the page renders the "Building your talent pool" onboarding state and no
 * filter UI exists to drive. The predicates are a pure function, so the logic
 * can be verified here even though the surface cannot be.
 *
 * The distinction the launch pass raised, and which matters most: the SKILL
 * filter matches whole values, the SEARCH box matches substrings. That is
 * deliberate. A skill is chosen from a list of skills already in the pool, so
 * "Java" must mean Java — matching JavaScript would be wrong. Free text is
 * typed, so "Hel" must find "Helena"; requiring whole words there would break
 * ordinary searching.
 */
import { describe, expect, it } from "vitest";
import { filterMemories } from "@/routes/_authenticated/client.talent-pool";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memory = (over: Record<string, unknown> = {}): any => ({
  reason_category: "role_filled",
  consent_status: "granted",
  skills_snapshot: [],
  role_title_snapshot: null,
  reason_notes: null,
  candidate: { display_name: "Ana Silva", headline: null, location: null },
  ...over,
});

const ALL = { q: "", reason: "all", consent: "all", skill: "" };

describe("the skill filter matches whole skills", () => {
  const java = memory({
    candidate: { display_name: "Java Dev", headline: null, location: null },
    skills_snapshot: ["Java", "Spring"],
  });
  const javascript = memory({
    candidate: { display_name: "JS Dev", headline: null, location: null },
    skills_snapshot: ["JavaScript", "React"],
  });

  it("does not return a JavaScript-only candidate for Java", () => {
    const out = filterMemories([java, javascript], { ...ALL, skill: "Java" });
    expect(out.map((m) => m.candidate.display_name)).toEqual(["Java Dev"]);
  });

  it("is case-insensitive on the whole value", () => {
    expect(filterMemories([java], { ...ALL, skill: "java" })).toHaveLength(1);
    expect(filterMemories([javascript], { ...ALL, skill: "javascript" })).toHaveLength(1);
  });

  it("does not match a skill that merely contains the term", () => {
    const script = memory({ skills_snapshot: ["TypeScript"] });
    expect(filterMemories([script], { ...ALL, skill: "Script" })).toHaveLength(0);
  });
});

describe("the search box matches substrings, on purpose", () => {
  const helena = memory({
    candidate: { display_name: "Helena Carvalho", headline: "Backend Engineer", location: "Porto" },
    skills_snapshot: ["Go"],
    role_title_snapshot: "Platform Engineer",
    reason_notes: "Strong systems background",
  });

  it("finds a partial name, which whole-word matching would not", () => {
    expect(filterMemories([helena], { ...ALL, q: "Hel" })).toHaveLength(1);
  });

  it("searches every field the placeholder promises", () => {
    for (const term of ["carvalho", "backend", "porto", "platform", "systems", "go"]) {
      expect(filterMemories([helena], { ...ALL, q: term }), term).toHaveLength(1);
    }
  });

  it("returns nothing for a term that appears nowhere", () => {
    expect(filterMemories([helena], { ...ALL, q: "zzzznomatch" })).toHaveLength(0);
  });
});

describe("reason and consent", () => {
  const granted = memory({ consent_status: "granted", reason_category: "role_filled" });
  const declined = memory({ consent_status: "declined", reason_category: "timing" });

  it("narrows by consent — the filter that decides who may be contacted", () => {
    expect(filterMemories([granted, declined], { ...ALL, consent: "granted" })).toEqual([granted]);
    expect(filterMemories([granted, declined], { ...ALL, consent: "declined" })).toEqual([declined]);
  });

  it("narrows by reason", () => {
    expect(filterMemories([granted, declined], { ...ALL, reason: "timing" })).toEqual([declined]);
  });

  it("'all' does not narrow", () => {
    expect(filterMemories([granted, declined], ALL)).toHaveLength(2);
  });
});

describe("filters combine with AND, never OR", () => {
  const a = memory({
    candidate: { display_name: "Ana", headline: null, location: null },
    skills_snapshot: ["Go"],
    consent_status: "granted",
  });
  const b = memory({
    candidate: { display_name: "Bruno", headline: null, location: null },
    skills_snapshot: ["Go"],
    consent_status: "declined",
  });

  it("requires every active filter to hold", () => {
    // Both are Go; only one has consent. OR would return two.
    const out = filterMemories([a, b], { ...ALL, skill: "Go", consent: "granted" });
    expect(out).toEqual([a]);
  });

  it("returns nothing when the combination excludes everyone", () => {
    expect(filterMemories([a, b], { ...ALL, q: "Ana", consent: "declined" })).toHaveLength(0);
  });
});
