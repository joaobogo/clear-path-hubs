import { describe, expect, it } from "vitest";
import {
  filterAndSortCandidates,
  filterCandidates,
  matchesInterviewTile,
  matchesTopTile,
  type CandidateListCriteria,
} from "@/lib/client-candidate-list-filter";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

const BASE: CandidateListCriteria = {
  q: "",
  location: "",
  stage: "all",
  fit: "all",
  critical: "all",
  review: "all",
  availability: "all",
  minExp: "",
  sort: "recent",
  filter: "all",
  unicorn: "0",
};

function row(over: Partial<ClientCandidateDTO> & { id: string }): ClientCandidateDTO {
  const { id, ...rest } = over;
  return {
    match_id: id,
    stage: "delivered",
    delivered_at: "2026-01-01T00:00:00Z",
    interview_active: false,
    contact_released: false,
    score: 80,
    fit_label: null,
    fit: { band: "strong" },
    unicorn: false,
    skills: [],
    position: { id: "p1", title: "Head of Ops" },
    coverage: { must_met: 2, must_total: 2 },
    requirement_rows: [],
    candidate: {
      display_name: `Cand ${id}`,
      headline: null,
      location: "Lisbon",
      availability: "immediate",
      years_experience: 5,
    },
    ...rest,
  } as unknown as ClientCandidateDTO;
}

describe("client candidate list filters", () => {
  it("interview drill-through counts an active interview regardless of stage", () => {
    const shortlistedWithInterview = row({ id: "a", stage: "shortlisted", interview_active: true });
    expect(matchesInterviewTile(shortlistedWithInterview)).toBe(true);
    const out = filterCandidates(
      [shortlistedWithInterview, row({ id: "b", stage: "shortlisted" })],
      { ...BASE, filter: "interview_pipeline" },
    );
    expect(out.map((r) => r.match_id)).toEqual(["a"]);
  });

  it("top drill-through uses the presentation band only", () => {
    expect(matchesTopTile(row({ id: "a", fit: { band: "exceptional" } } as never))).toBe(true);
    expect(matchesTopTile(row({ id: "b", fit: { band: "mixed" } } as never))).toBe(false);
  });

  it("combines chips with AND semantics", () => {
    const rows = [
      row({ id: "a", stage: "shortlisted", candidate: { display_name: "Ana", headline: null, location: "Porto", availability: "immediate", years_experience: 9 } as never }),
      row({ id: "b", stage: "shortlisted", candidate: { display_name: "Bo", headline: null, location: "Porto", availability: "immediate", years_experience: 2 } as never }),
      row({ id: "c", stage: "delivered", candidate: { display_name: "Cai", headline: null, location: "Porto", availability: "immediate", years_experience: 9 } as never }),
    ];
    const out = filterCandidates(rows, {
      ...BASE,
      stage: "shortlisted",
      minExp: "5",
      location: "porto",
    });
    expect(out.map((r) => r.match_id)).toEqual(["a"]);
  });

  it("resets to the full set when every chip is cleared", () => {
    const rows = [row({ id: "a" }), row({ id: "b", stage: "hired" })];
    expect(filterCandidates(rows, BASE)).toHaveLength(2);
  });

  it("search is bounded to visible candidate fields", () => {
    const rows = [
      row({ id: "a", skills: ["Kubernetes"] as never }),
      row({ id: "b" }),
    ];
    expect(filterCandidates(rows, { ...BASE, q: "kubernetes" }).map((r) => r.match_id)).toEqual(["a"]);
    expect(filterCandidates(rows, { ...BASE, q: "no-such-token" })).toHaveLength(0);
  });

  it("sorts by score with unscored last", () => {
    const rows = [row({ id: "a", score: null }), row({ id: "b", score: 91 })];
    expect(
      filterAndSortCandidates(rows, { ...BASE, sort: "score" }).map((r) => r.match_id),
    ).toEqual(["b", "a"]);
  });

  it("fit filter uses score-derived band, not legacy fit_label", () => {
    const rows = [
      row({ id: "beatriz", score: 88, fit_label: "strong_fit", fit: { band: "top" } } as never),
      row({ id: "ana", score: 79, fit_label: "strong_fit", fit: { band: "strong" } } as never),
      row({ id: "ines", score: 73, fit_label: "strong_fit", fit: { band: "strong" } } as never),
      row({ id: "carla", score: 66, fit_label: "worth_considering", fit: { band: "consider" } } as never),
      row({ id: "joao", score: 49, fit_label: "not_a_fit", fit: { band: "not_recommended" } } as never),
    ];
    const strong = filterCandidates(rows, { ...BASE, fit: "strong" });
    expect(strong.map((r) => r.match_id)).toEqual(["ana", "ines"]);

    const top = filterCandidates(rows, { ...BASE, fit: "top" });
    expect(top.map((r) => r.match_id)).toEqual(["beatriz"]);

    const consider = filterCandidates(rows, { ...BASE, fit: "consider" });
    expect(consider.map((r) => r.match_id)).toEqual(["carla"]);

    const notRecommended = filterCandidates(rows, { ...BASE, fit: "not_recommended" });
    expect(notRecommended.map((r) => r.match_id)).toEqual(["joao"]);
  });
});
