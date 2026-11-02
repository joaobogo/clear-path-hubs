/**
 * The admin candidate list and its CSV export filter, sort and band on the
 * PUBLISHED figure (intro-video bonus included, migration 0011), not on the
 * view's pre-bonus score / score_band. Adiya (67.5 run + Drive video) shows
 * "73 · strong"; she must be found under "strong", sort as 72.5 across pages,
 * and export as strong / strong_fit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((h) => {
      const fn = async (args: unknown) => h(args);
      (fn as unknown as { handler: unknown }).handler = h;
      return fn;
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/admin-ops.server", () => ({ requireStaff: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-test-scope.server", () => ({
  loadTestScope: vi.fn(async () => ({ includeTest: true, orgIds: [], positionIds: [] })),
}));

type Call = [string, ...unknown[]];
const viewCalls: Call[] = [];
let viewRows: Array<Record<string, unknown>> = [];
let videoRows: Array<Record<string, unknown>> = [];

function recordingChain(result: () => unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "select",
    "eq",
    "or",
    "in",
    "gte",
    "lte",
    "lt",
    "not",
    "order",
    "range",
    "limit",
  ]) {
    chain[m] = (...args: unknown[]) => {
      viewCalls.push([m, ...args]);
      return chain;
    };
  }
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(res, rej);
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "v_admin_candidate_index") {
        return recordingChain(() => ({ data: viewRows, count: viewRows.length, error: null }));
      }
      if (table === "candidate_matches") {
        return { select: () => ({ in: async () => ({ data: videoRows, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

import { searchCandidateIndex } from "../admin-candidates.functions";
import { runExportJob, withPublishedBand } from "../exports.server";
import { publishedBand, publishedScoreDisplay } from "../scoring/published-score";

const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view";

// Adiya as the view returns her once 0011 is applied: pre-bonus score and
// score_band unchanged, published_* carrying the bonus.
const adiya = {
  match_id: "b058712e-53c1-4072-9cf5-43c3d84b9801",
  position_id: "pos-1",
  score: 67.5,
  final_score: 67.5,
  score_band: "consider",
  fit_label: "worth_considering",
  published_score: 72.5,
  published_band: "strong",
  contact_released: false,
};

const runList = (data: Record<string, unknown>) =>
  (
    searchCandidateIndex as unknown as {
      handler: (a: unknown) => Promise<{ rows: Array<Record<string, unknown>>; total: number }>;
    }
  ).handler({ data, context: { userId: "staff-1" } });

beforeEach(() => {
  viewCalls.length = 0;
  viewRows = [adiya];
  videoRows = [{ id: adiya.match_id, intro_video_url: DRIVE }];
});

describe("admin candidate list on the published band and score", () => {
  it("filters the Score band on published_band, never the pre-bonus score_band", async () => {
    const res = await runList({ score_band: "strong" });
    expect(viewCalls).toContainEqual(["eq", "published_band", "strong"]);
    expect(viewCalls.some(([m, col]) => m === "eq" && col === "score_band")).toBe(false);
    // The row found under "strong" also displays as strong, 73.
    expect(publishedBand(res.rows[0])).toBe("strong");
    expect(publishedScoreDisplay(res.rows[0])).toBe(73);
  });

  it.each([
    ["score_desc", false],
    ["score_asc", true],
  ] as const)("sorts %s across pages on published_score", async (sort, ascending) => {
    await runList({ sort });
    const orders = viewCalls.filter(([m]) => m === "order");
    expect(orders[0]).toEqual(["order", "published_score", { ascending, nullsFirst: false }]);
    expect(orders.some(([, col]) => col === "score")).toBe(false);
  });

  it("still folds the bonus into the page rows for display", async () => {
    const res = await runList({});
    expect(res.rows[0]).toMatchObject({ final_score: 72.5, video_bonus_awarded: 5 });
  });
});

describe("admin CSV export on the published band", () => {
  function exportClient(filters: Record<string, unknown>) {
    const captured = { csv: "", select: "", eqs: [] as Array<[string, unknown]> };
    const view = () => {
      const chain: Record<string, unknown> = {};
      chain.eq = (col: string, v: unknown) => {
        captured.eqs.push([col, v]);
        return chain;
      };
      for (const m of ["gte", "lte", "not", "order"]) chain[m] = () => chain;
      chain.limit = async () => ({ data: viewRows, count: viewRows.length, error: null });
      return chain;
    };
    const client = {
      from: (table: string) => {
        if (table === "export_jobs") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "job-1",
                    requested_by: "user-1",
                    export_type: "admin_candidate_list",
                    scope_label: "x",
                    filters,
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "v_admin_candidate_index") {
          return {
            select: (cols: string) => {
              captured.select = cols;
              return view();
            },
          };
        }
        return { insert: async () => ({ error: null }) };
      },
      storage: {
        from: () => ({
          upload: async (_p: string, blob: Blob) => {
            captured.csv = await blob.text();
            return { error: null };
          },
        }),
      },
    };
    return { client, captured };
  }

  it("filters on published_band and writes the published band and its fit label", async () => {
    const { client, captured } = exportClient({ position_id: "pos-1", score_band: "strong" });
    const res = await runExportJob(client, "job-1", "user-1");
    expect(res.status).toBe("completed");
    expect(captured.eqs).toContainEqual(["published_band", "strong"]);
    expect(captured.eqs.some(([col]) => col === "score_band")).toBe(false);
    expect(captured.select.split(",")).toContain("published_band");

    const lines = captured.csv.split("\n");
    const cols = lines.find((l) => l.startsWith("match_id"))!.split(",");
    const row = lines.find((l) => l.startsWith(adiya.match_id))!.split(",");
    expect(row[cols.indexOf("score_band")]).toBe("strong");
    expect(row[cols.indexOf("fit_label")]).toBe("strong_fit");
  });

  it("derives the fit label from the published band, unscored included", () => {
    expect(
      withPublishedBand({ published_band: "consider", fit_label: "strong_fit" }),
    ).toMatchObject({
      score_band: "consider",
      fit_label: "worth_considering",
    });
    expect(withPublishedBand({ published_band: "unscored", fit_label: "not_a_fit" })).toMatchObject(
      {
        score_band: "unscored",
        fit_label: "unknown",
      },
    );
    expect(withPublishedBand({ published_band: null })).toMatchObject({
      score_band: "unscored",
      fit_label: "unknown",
    });
  });
});
