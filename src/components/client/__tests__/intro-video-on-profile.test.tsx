/**
 * A candidate's introduction video shows on her profile, from the link staff
 * stored, on both sides of the product: the admin attachment card and the
 * client's video panel play the host's embed in-page and offer the host's own
 * page as a link. The score breakdown shows the +5 the video earns with copy
 * that holds for any host (it used to say "Loom link on the application" next
 * to a staff-attached Google Drive video).
 *
 * Fixture: Adiya's stored link (match b058712e-…), a Google Drive file.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const queries: Array<{ queryKey: unknown[] }> = [];

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (opts: { queryKey: unknown[] }) => {
    queries.push(opts);
    return { data: undefined, isLoading: false, isPending: false, error: null };
  },
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));
vi.mock("@/lib/candidate-video.functions", () => ({
  setCandidateIntroVideo: vi.fn(),
  resolveIntroVideo: vi.fn(),
}));

import {
  IntroVideoCard,
  USE_REMOVE_TO_DETACH,
  introVideoQueryKeys,
  introVideoSaveRefusal,
} from "@/components/admin/candidate-detail/intro-video-card";
import { IntroVideoPanel } from "@/components/client/intro-video-panel";
import { ScoreBreakdown } from "@/components/client/candidate-detail/score-breakdown";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";

const ADIYA_MATCH = "b058712e-53c1-4072-9cf5-43c3d84b9801";
const ADIYA_STORED_LINK = "https://drive.google.com/file/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/view";
const EMBED = "https://drive.google.com/file/d/1JT1xz67uMWP4B-GoiDlLWeTSDdfEGg7-/preview";
const OPEN = ADIYA_STORED_LINK;

/** The client DTO built from a match row carrying Adiya's stored link. */
function adiyaDto() {
  return toClientCandidateDTO({
    id: ADIYA_MATCH,
    stage: "delivered",
    delivered_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    intro_video_url: ADIYA_STORED_LINK,
    candidate_profiles: {
      id: "22222222-2222-2222-2222-222222222222",
      full_name: "Adiya Example",
      experience: [{ title: "Marketing Manager", company: "Acme" }],
      skills: ["Brand"],
    },
    positions: {
      id: "33333333-3333-3333-3333-333333333333",
      title: "Group Marketing Manager",
      requirements: ["Brand marketing"],
      preferred_requirements: ["FMCG"],
    },
    score_runs: {
      score: 67.5,
      final_score: 67.5,
      fit_label: "worth_considering",
      result: {
        category_breakdown: { must_have: 0.7, preferred: 0.6, screening_alignment: 0.7 },
        strengths: ["Led brand launches in two markets"],
      },
    },
    application_answers: [],
    audit_events: [],
    evidence_items: [],
  });
}

function iframeSrc(html: string): string | null {
  return /<iframe[^>]*\ssrc="([^"]+)"/.exec(html)?.[1] ?? null;
}

function linkHrefs(html: string): string[] {
  return [...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1]!);
}

describe("admin IntroVideoCard with Adiya's stored Drive link", () => {
  const html = renderToStaticMarkup(
    <IntroVideoCard matchId={ADIYA_MATCH} currentUrl={ADIYA_STORED_LINK} />,
  );

  it("plays the Drive preview embed in-page", () => {
    expect(iframeSrc(html)).toBe(EMBED);
  });

  it("links to the file's /view page", () => {
    expect(linkHrefs(html)).toContain(OPEN);
    expect(html).toContain('target="_blank"');
  });

  it("pre-fills the field with the stored link and offers Remove", () => {
    expect(html).toContain(`value="${ADIYA_STORED_LINK}"`);
    expect(html).toContain(">Remove<");
  });
});

describe("saving the intro video", () => {
  it("refuses Save on an emptied field while a video is attached", () => {
    expect(introVideoSaveRefusal("", true, false)).toBe(USE_REMOVE_TO_DETACH);
    expect(introVideoSaveRefusal("   ", true, false)).toBe(USE_REMOVE_TO_DETACH);
    expect(USE_REMOVE_TO_DETACH).toBe("Use Remove to detach the video.");
  });

  it("lets Remove detach, and lets a link or an empty first save through", () => {
    expect(introVideoSaveRefusal("", true, true)).toBeNull();
    expect(introVideoSaveRefusal(ADIYA_STORED_LINK, true, false)).toBeNull();
    expect(introVideoSaveRefusal("", false, false)).toBeNull();
  });

  it("refreshes the workspace record, the Client preview and the player probe", () => {
    expect(introVideoQueryKeys(ADIYA_MATCH)).toEqual([
      ["admin-candidate", ADIYA_MATCH],
      ["client-preview", ADIYA_MATCH],
      ["intro-video", ADIYA_MATCH],
    ]);
  });
});

describe("client IntroVideoPanel with Adiya's stored Drive link", () => {
  const dto = adiyaDto();

  it("carries the link through the client DTO", () => {
    expect(dto.intro_video).toEqual({ url: OPEN, embed_url: EMBED });
  });

  queries.length = 0;
  const html = renderToStaticMarkup(
    <IntroVideoPanel
      matchId={dto.match_id}
      video={dto.intro_video}
      candidateName={dto.candidate.display_name}
    />,
  );

  it("plays the Drive preview embed in-page", () => {
    expect(iframeSrc(html)).toBe(EMBED);
  });

  it("links to the file's /view page in a new tab", () => {
    expect(linkHrefs(html)).toContain(OPEN);
    expect(html).toContain("Open the video in a new tab");
  });

  it("uses the probe key the admin card refreshes after a save", () => {
    const probeKey = queries.find((q) => q.queryKey[0] === "intro-video")?.queryKey;
    expect(probeKey).toEqual(["intro-video", ADIYA_MATCH]);
    expect(introVideoQueryKeys(ADIYA_MATCH)).toContainEqual(probeKey);
  });

  it("renders nothing without a video", () => {
    expect(
      renderToStaticMarkup(
        <IntroVideoPanel matchId={ADIYA_MATCH} video={null} candidateName="Adiya Example" />,
      ),
    ).toBe("");
  });
});

describe("client score breakdown for a candidate with a video", () => {
  const dto = adiyaDto();
  const html = renderToStaticMarkup(<ScoreBreakdown candidate={dto} />);

  it("publishes the run score plus the 5-point video bonus", () => {
    expect(dto.score).toBe(73); // 67.5 + 5 = 72.5, shown whole
    expect(dto.score_composition?.videoBonusPts).toBe(5);
  });

  it('shows "+5" on the video line with host-neutral copy', () => {
    expect(html).toContain("Video introduction");
    expect(html).toContain("Introduction video on the profile");
    expect(html).toContain("+5 pts");
    expect(html).not.toContain("Loom link on the application");
  });
});
