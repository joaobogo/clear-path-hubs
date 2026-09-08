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
  /**
   * The drill-through must return exactly what the tile counted.
   *
   * This used to assert the opposite: that a SHORTLISTED candidate with an
   * active interview belongs in the interview drill-through. The tile does not
   * count them — `computeCandidateKpis` switches on `laneFor`, and so does
   * `isInInterview`, which this predicate's comment claimed to mirror but did
   * not. It matched `interview_active || stage === "interview_process" ||
   * stage === "offer"`, folding in the offer lane as well, so the Interviewing
   * tile said 1, this list said 2, and a third surface said 3 (audit #9, item
   * 12). The lane is the contract; a stage that has not been moved is not an
   * interview, and moving it is what makes it one.
   */
  it("interview drill-through returns exactly what the Interviewing tile counted", () => {
    const interviewing = row({ id: "a", stage: "interview_process" });
    const shortlistedWithInterview = row({ id: "b", stage: "shortlisted", interview_active: true });
    const offered = row({ id: "c", stage: "offer" });
    expect(matchesInterviewTile(interviewing)).toBe(true);
    expect(matchesInterviewTile(shortlistedWithInterview), "stage not moved").toBe(false);
    expect(matchesInterviewTile(offered), "the offer lane is not the interview lane").toBe(false);

    const out = filterCandidates([interviewing, shortlistedWithInterview, offered], {
      ...BASE,
      filter: "interview_pipeline",
    });
    expect(out.map((r) => r.match_id)).toEqual(["a"]);
  });

  it("a cancelled interview drops out of interviewing and into shortlisted", () => {
    // The canonical lane rule, applied to BOTH the tile and this list.
    const calledOff = row({
      id: "a",
      stage: "interview_process",
      interview_called_off: true,
      interview_active: false,
    });
    expect(matchesInterviewTile(calledOff)).toBe(false);
    expect(
      filterCandidates([calledOff], { ...BASE, stage: "shortlisted" }).map((r) => r.match_id),
      "a stage=shortlisted drill-through must find them",
    ).toEqual(["a"]);
    expect(
      filterCandidates([calledOff], { ...BASE, stage: "interview_process" }),
      "and the interview_process drill-through must not",
    ).toEqual([]);
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
