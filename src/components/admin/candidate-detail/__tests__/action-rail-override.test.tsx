/**
 * The Manual override box in the candidate action rail. Overrides are retired:
 * the database refuses one that differs from its run, quoting the run's
 * pre-bonus figure. The box's failure now goes through explainApproveFailure,
 * so staff read why and what to do instead, and a hint under the box says
 * scores change by adjusting requirement verdicts in Review. The Reason field
 * stays: it attaches to the next review decision.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const toastError = vi.fn();
const buttons: Array<{ children?: ReactNode; onClick?: () => void }> = [];

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: (...a: unknown[]) => toastError(...a), success: vi.fn() }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(),
}));
vi.mock("@/components/ds", () => ({
  useConfirmAction: () => ({ confirm: vi.fn(), confirmDialog: null }),
}));
vi.mock("@/lib/processing.functions", () => ({
  advanceProcessing: vi.fn(),
  applyReviewDecision: vi.fn(),
  deleteCandidateMatch: vi.fn(),
  markOcrDone: vi.fn(),
  rescore: vi.fn(),
  retryParse: vi.fn(),
  retryHydration: vi.fn(),
  retryEnrichment: vi.fn(),
}));
vi.mock("@/lib/admin.functions", () => ({ setMatchClientVisibility: vi.fn() }));
vi.mock("@/components/ui/button", () => ({
  Button: (props: { children?: ReactNode; onClick?: () => void }) => {
    buttons.push(props);
    return <button type="button">{props.children}</button>;
  },
}));

import { ActionRail } from "@/components/admin/candidate-detail/action-rail";

// The exact text tg_score_decisions_override_matches_run raises.
const TRIGGER_MESSAGE =
  "score_override_retired: the published score is the score run's final score (67.50). To change it, adjust the requirement verdicts so staff and the client see the same number.";

const match = {
  id: "b058712e-53c1-4072-9cf5-43c3d84b9801",
  processing_state: "scored",
  admin_status: "approved",
  client_visibility: "visible",
  canonical_state: "published_to_client",
  current_score_run_id: "88af9d95-0000-0000-0000-000000000000",
  full_name: "Adiya Example",
};

function render(onRun = vi.fn(async () => {})) {
  buttons.length = 0;
  const html = renderToStaticMarkup(
    <ActionRail m={match} busy={null} onRun={onRun} onDone={async () => {}} onSetTab={() => {}} />,
  );
  return { html, onRun };
}

beforeEach(() => toastError.mockReset());

describe("Manual override box", () => {
  it("keeps the Reason field", () => {
    const { html } = render();
    expect(html).toContain('id="reason"');
    expect(html).toContain("Reason (attaches to the next review decision)");
  });

  it("says scores change by adjusting requirement verdicts in Review", () => {
    const { html } = render();
    expect(html).toContain(
      "Scores change by adjusting the requirement verdicts in Review, not by typing a number here.",
    );
  });

  it("explains the database's refusal instead of echoing the pre-bonus figure", async () => {
    const { onRun } = render();
    const save = buttons.find((b) => b.children === "Save");
    expect(save?.onClick).toBeTypeOf("function");
    save!.onClick!();

    expect(onRun).toHaveBeenCalledTimes(1);
    const [label, , opts] = onRun.mock.calls[0] as unknown as [
      string,
      unknown,
      { onError?: (e: Error) => void } | undefined,
    ];
    expect(label).toBe("override");
    expect(opts?.onError).toBeTypeOf("function");

    opts!.onError!(new Error(TRIGGER_MESSAGE));
    expect(toastError).toHaveBeenCalledTimes(1);
    const text = String(toastError.mock.calls[0]![0]);
    expect(text).toContain("Score overrides are retired");
    expect(text).toContain("Adjust the requirement verdicts");
    expect(text).not.toContain("67.5");
  });
});
