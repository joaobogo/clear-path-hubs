/**
 * The Boardroom shortlist slide reads the client candidate DTOs the overview
 * sends. It used to read `full_name` and `fit_score`, which that DTO does not
 * have, so every candidate showed as "Candidate N" with a fit of 0. It now
 * shows the display name, the published score (video bonus folded in, the
 * same figure as the candidate page) and the first strength; a voided score is
 * a dash, never 0.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SlideShortlist, boardroomShortlist } from "@/routes/_authenticated/boardroom";
import { toClientCandidateDTO, type ClientCandidateDTO } from "@/lib/client-kpi.server";

function dto(over: Partial<ClientCandidateDTO>): ClientCandidateDTO {
  return {
    candidate: { display_name: "Candidate" },
    score: null,
    strengths: [],
    ...over,
  } as unknown as ClientCandidateDTO;
}

describe("boardroomShortlist", () => {
  it("uses the display name, the published score and the first strength", () => {
    const [row] = boardroomShortlist([
      dto({
        candidate: { display_name: "Adiya Example" } as ClientCandidateDTO["candidate"],
        score: 73,
        strengths: ["Led brand launches in two markets", "Second"],
      }),
    ]);
    expect(row).toEqual({
      rank: 1,
      name: "Adiya Example",
      score: 73,
      note: "Led brand launches in two markets",
    });
  });

  it("keeps a voided score null instead of 0", () => {
    const [row] = boardroomShortlist([dto({ score: null })]);
    expect(row!.score).toBeNull();
  });

  it("takes the top three only", () => {
    const rows = boardroomShortlist([
      dto({ score: 90 }),
      dto({ score: 80 }),
      dto({ score: 70 }),
      dto({ score: 60 }),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("matches the candidate page's figure for a candidate with a video", () => {
    const real = toClientCandidateDTO({
      id: "b058712e-53c1-4072-9cf5-43c3d84b9801",
      stage: "delivered",
      intro_video_url: "https://drive.google.com/file/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/view",
      candidate_profiles: { full_name: "Adiya Example" },
      positions: { id: "p1", title: "Group Marketing Manager", requirements: [] },
      score_runs: { score: 67.5, final_score: 67.5, fit_label: "worth_considering" },
      application_answers: [],
      audit_events: [],
      evidence_items: [],
    });
    const [row] = boardroomShortlist([real]);
    expect(row!.name).toBe("Adiya Example");
    expect(row!.score).toBe(real.score);
    expect(row!.score).toBe(73);
  });
});

describe("SlideShortlist", () => {
  it("renders the name, score and note", () => {
    const html = renderToStaticMarkup(
      <SlideShortlist
        candidates={[{ rank: 1, name: "Adiya Example", score: 73, note: "Led brand launches" }]}
      />,
    );
    expect(html).toContain("Adiya Example");
    expect(html).toContain(">73<");
    expect(html).toContain("Led brand launches");
    expect(html).not.toContain("Candidate 1");
  });

  it("renders a dash, not 0, when the score is null", () => {
    const html = renderToStaticMarkup(
      <SlideShortlist candidates={[{ rank: 1, name: "Paulo Reis", score: null, note: "n" }]} />,
    );
    expect(html).toContain(">—<");
    expect(html).not.toContain(">0<");
  });
});
