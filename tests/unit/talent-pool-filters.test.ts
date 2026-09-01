/**
 * The talent pool is filterable.
 *
 * The page rendered every entry as one flat grid with no search, no reason
 * filter and no consent filter — so a pool of any real size could not be
 * worked. The server function already accepted `q`, `reason` and `status`;
 * nothing on the page passed them.
 *
 * Consent is a filter and not decoration: it decides who may be contacted, and
 * a pool view that cannot answer "who has granted consent" cannot be used for
 * outreach without opening every card.
 */
import { describe, expect, it } from "vitest";
import { filterMemories } from "@/routes/_authenticated/client.talent-pool";
import type { TalentMemoryDTO } from "@/lib/talent-memory.functions";

const NONE = { q: "", reason: "all", consent: "all", skill: "" };

function memory(over: Partial<TalentMemoryDTO> = {}): TalentMemoryDTO {
  return {
    id: "m1",
    organization_id: "org",
    candidate_profile_id: "p1",
    source_match_id: null,
    source_position_id: null,
    reason_category: "timing",
    reason_notes: null,
    headline_snapshot: null,
    seniority_snapshot: null,
    role_title_snapshot: null,
    skills_snapshot: [],
    score_snapshot: null,
    owner_user_id: null,
    owner_name: null,
    consent_status: "pending",
    consent_updated_at: null,
    consent_expires_at: null,
    status: "active",
    last_resurfaced_at: null,
    last_reengaged_at: null,
    tagged_by: null,
    tagged_by_name: null,
    tagged_at: "2026-01-01T00:00:00Z",
    candidate: {
      display_name: "Ana Pinto",
      email_masked: "a•••@example.com",
      headline: null,
      seniority: null,
      location: null,
      match_id: null,
    },
    ...over,
  };
}

describe("no filters", () => {
  it("returns every entry", () => {
    const rows = [memory({ id: "a" }), memory({ id: "b" })];
    expect(filterMemories(rows, NONE)).toHaveLength(2);
  });
});

describe("reason", () => {
  it("keeps only the chosen reason", () => {
    const rows = [
      memory({ id: "a", reason_category: "comp_gap" }),
      memory({ id: "b", reason_category: "timing" }),
    ];
    const out = filterMemories(rows, { ...NONE, reason: "comp_gap" });
    expect(out.map((m) => m.id)).toEqual(["a"]);
  });
});

describe("consent", () => {
  it("isolates who may actually be contacted", () => {
    // The reason this filter exists: outreach cannot start from a list that
    // mixes granted with withdrawn.
    const rows = [
      memory({ id: "granted", consent_status: "granted" }),
      memory({ id: "pending", consent_status: "pending" }),
      memory({ id: "withdrawn", consent_status: "withdrawn" }),
    ];
    const out = filterMemories(rows, { ...NONE, consent: "granted" });
    expect(out.map((m) => m.id)).toEqual(["granted"]);
  });
});

describe("skill", () => {
  it("matches a whole skill, not a fragment of one", () => {
    // "Java" must not select a Kotlin/JavaScript engineer.
    const rows = [
      memory({ id: "java", skills_snapshot: ["Java", "Spring"] }),
      memory({ id: "js", skills_snapshot: ["JavaScript", "React"] }),
    ];
    const out = filterMemories(rows, { ...NONE, skill: "java" });
    expect(out.map((m) => m.id)).toEqual(["java"]);
  });

  it("ignores case", () => {
    const rows = [memory({ id: "a", skills_snapshot: ["TypeScript"] })];
    expect(filterMemories(rows, { ...NONE, skill: "typescript" })).toHaveLength(1);
  });
});

describe("search", () => {
  it("searches name, headline, role, notes, location and skills", () => {
    const rows = [
      memory({ id: "name", candidate: { ...memory().candidate, display_name: "Rui Almeida" } }),
      memory({ id: "headline", candidate: { ...memory().candidate, headline: "Staff Engineer" } }),
      memory({ id: "role", role_title_snapshot: "Backend Engineer" }),
      memory({ id: "notes", reason_notes: "Strong on distributed systems" }),
      memory({ id: "location", candidate: { ...memory().candidate, location: "Lisbon" } }),
      memory({ id: "skill", skills_snapshot: ["Kubernetes"] }),
    ];
    const hit = (q: string) => filterMemories(rows, { ...NONE, q }).map((m) => m.id);
    expect(hit("almeida")).toEqual(["name"]);
    expect(hit("staff")).toEqual(["headline"]);
    expect(hit("backend")).toEqual(["role"]);
    expect(hit("distributed")).toEqual(["notes"]);
    expect(hit("lisbon")).toEqual(["location"]);
    expect(hit("kubernetes")).toEqual(["skill"]);
  });

  it("ignores surrounding whitespace", () => {
    const rows = [memory({ id: "a" })];
    expect(filterMemories(rows, { ...NONE, q: "  ana  " })).toHaveLength(1);
  });
});

describe("combined filters", () => {
  it("narrows on every active filter at once", () => {
    // AND, not OR: each filter the user sets must reduce the set further.
    const rows = [
      memory({
        id: "match",
        reason_category: "comp_gap",
        consent_status: "granted",
        skills_snapshot: ["Go"],
        candidate: { ...memory().candidate, display_name: "Ana Pinto" },
      }),
      memory({
        id: "wrong-consent",
        reason_category: "comp_gap",
        consent_status: "pending",
        skills_snapshot: ["Go"],
        candidate: { ...memory().candidate, display_name: "Ana Pinto" },
      }),
      memory({
        id: "wrong-reason",
        reason_category: "timing",
        consent_status: "granted",
        skills_snapshot: ["Go"],
        candidate: { ...memory().candidate, display_name: "Ana Pinto" },
      }),
    ];
    const out = filterMemories(rows, {
      q: "ana",
      reason: "comp_gap",
      consent: "granted",
      skill: "go",
    });
    expect(out.map((m) => m.id)).toEqual(["match"]);
  });

  it("returns nothing rather than falling back to everything", () => {
    // A filtered-to-empty result must stay empty — the page distinguishes it
    // from an empty pool in its own copy.
    const rows = [memory({ id: "a", reason_category: "timing" })];
    expect(filterMemories(rows, { ...NONE, reason: "geo" })).toEqual([]);
  });
});
