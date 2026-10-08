import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { input: {} } }) }));
vi.mock("@/lib/admin.functions", () => ({ setPositionStatus: vi.fn(), setPositionVisibility: vi.fn() }));
vi.mock("@/lib/requisition.functions", () => ({ getRequisitionQuality: vi.fn() }));
vi.mock("@/lib/requisition-schema", () => ({ assessJobQuality: () => ({ blocking: ["Missing requirements"] }) }));
vi.mock("@/components/ds/confirm-action", () => ({ useConfirmAction: () => ({ confirm: vi.fn(), confirmDialog: null }) }));

import { LifecycleBar } from "@/components/admin/position-detail/lifecycle-bar";

describe("platform admin role approval", () => {
  it("enables approval of an incomplete unpaid role for a verified admin", () => {
    const html = renderToStaticMarkup(<LifecycleBar
      position={{ id: "role", status: "under_review", payment_status: "unpaid" }}
      onDone={async () => {}} canOverrideApproval
    />);
    expect(html).toMatch(/<button(?![^>]* disabled=)[^>]*data-qa-action="position-approve"/);
  });

  it("keeps incomplete approval disabled without admin permission", () => {
    const html = renderToStaticMarkup(<LifecycleBar
      position={{ id: "role", status: "under_review", payment_status: "unpaid" }}
      onDone={async () => {}}
    />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-qa-action="position-approve"/);
  });

  it("keeps the caller identity on approval writes and retains activation gates", () => {
    const source = readFileSync(new URL("../admin.functions.ts", import.meta.url), "utf8");
    expect(source).toContain('data.action === "approve" ? context.supabase : s');
    expect(source).toContain('context.supabase.rpc("is_platform_admin"');
    expect(source).toContain('await assertPositionPublishable(s, data.id)');
  });
});