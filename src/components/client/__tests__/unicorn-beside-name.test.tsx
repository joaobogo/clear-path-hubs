/**
 * The unicorn sits beside the name of every candidate whose published score is
 * 95 or more, on every client surface that lists candidates (owner request,
 * 12 Oct 2026). The Candidates list, its cards and the candidate page already
 * did this; the role board, the candidates board view (which renders the same
 * board), the comparison and talent memory now do too.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));

import { PipelineBoard } from "@/components/client/position-detail/pipeline-board";
import { KANBAN_COLUMNS } from "@/components/client/position-detail/constants";
import { MemoryCard } from "@/components/client/talent-memory/memory-list";
import type { TalentMemoryDTO } from "@/lib/talent-memory.functions";

const UNICORN = 'aria-label="Unicorn candidate"';

function match(id: string, name: string, score: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    stage: "shortlisted",
    candidate_profiles: { full_name: name },
    score_runs: { score, final_score: score, fit_label: null },
    ...extra,
  };
}

function board(matches: ReturnType<typeof match>[]) {
  return renderToStaticMarkup(
    <PipelineBoard
      matches={matches}
      byStage={Object.fromEntries(
        KANBAN_COLUMNS.map((c) => [c.key, c.key === "shortlisted" ? matches : []]),
      )}
      canEdit={false}
      dragOver={null}
      setDragOver={() => {}}
      movePending={false}
      attemptMove={() => {}}
    />,
  );
}

/** The text of the card that names this candidate, up to the next card. */
function cardFor(html: string, name: string): string {
  const start = html.indexOf(name);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, start + 400);
}

describe("role board", () => {
  it("puts the unicorn beside a 95+ candidate's name", () => {
    const html = board([match("m1", "Helena Carvalho", 96)]);
    expect(cardFor(html, "Helena Carvalho")).toContain(UNICORN);
  });

  it("counts exactly 95", () => {
    const html = board([match("m1", "Rui Costa", 95)]);
    expect(cardFor(html, "Rui Costa")).toContain(UNICORN);
  });

  it("leaves a 94 without one", () => {
    const html = board([match("m1", "Ana Lima", 94)]);
    expect(html).not.toContain(UNICORN);
  });

  it("never marks a score taken from an unreadable CV", () => {
    const html = board([match("m1", "Paulo Reis", 98, { processing_state: "ocr_required" })]);
    expect(html).not.toContain(UNICORN);
  });

  it("marks only the standout when both are on the board", () => {
    const html = board([match("m1", "Helena Carvalho", 97), match("m2", "Ana Lima", 80)]);
    expect(html.split(UNICORN).length - 1).toBe(1);
    expect(cardFor(html, "Helena Carvalho")).toContain(UNICORN);
  });
});

describe("talent memory", () => {
  function memory(score: number | null): TalentMemoryDTO {
    return {
      id: "t1",
      candidate_profile_id: "p1",
      score_snapshot: score,
      reason_category: "timing",
      skills_snapshot: [],
      candidate: { display_name: "Helena Carvalho", headline: null },
      created_at: "2026-09-01T00:00:00Z",
    } as unknown as TalentMemoryDTO;
  }

  it("marks a candidate kept with a 95+ score", () => {
    const html = renderToStaticMarkup(<MemoryCard memory={memory(96)} onOpen={() => {}} />);
    expect(html).toContain(UNICORN);
  });

  it("does not mark one kept below 95, or with no score", () => {
    expect(
      renderToStaticMarkup(<MemoryCard memory={memory(88)} onOpen={() => {}} />),
    ).not.toContain(UNICORN);
    expect(
      renderToStaticMarkup(<MemoryCard memory={memory(null)} onOpen={() => {}} />),
    ).not.toContain(UNICORN);
  });
});
