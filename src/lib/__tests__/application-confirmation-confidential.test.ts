/**
 * The "application received" email names the client only when the role does.
 *
 * A candidate who applied to a confidential role (posting.confidentiality =
 * 'confidential') was told "your application for … at <real client>" the
 * moment they applied, although the job board had shown "Confidential
 * employer". The email now carries the same masked name, and the position
 * read selects posting.confidentiality alone, not the rest of intake_context.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendTemplateEmail } = vi.hoisted(() => ({
  sendTemplateEmail: vi.fn(async (..._args: unknown[]) => ({ sent: true as const })),
}));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail }));
vi.mock("@/lib/notification-email.server", () => ({
  classifyEmailError: () => ({ code: "provider_error", message: "error" }),
  isBlockedRecipientCode: () => false,
  isHeldEmailCode: () => false,
  isSandboxRecipient: async () => false,
  readEmailConfig: () => ({ configured: true, reason: null }),
}));

import { sendApplicationConfirmationEmail } from "@/lib/application-confirmation-email.server";

type Row = Record<string, unknown>;

const APP_ID = "6a1f2c3d-0000-4000-8000-000000000001";

function fakeAdmin(position: Row) {
  const selects: Record<string, string[]> = {};
  const rows: Record<string, Row> = {
    applications: {
      id: APP_ID,
      candidate_profile_id: "cp-1",
      position_id: "pos-1",
      confirmation_email_sent_at: null,
      confirmation_email_attempt_count: 0,
    },
    candidate_profiles: { full_name: "Adiya Vatsa", email: "adiya@example.org" },
    positions: position,
    organizations: { name: "Hughes Mushrooms" },
  };
  const admin = {
    from(table: string) {
      const q = {
        select(cols: string) {
          (selects[table] ??= []).push(cols);
          return q;
        },
        eq: () => q,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      return q;
    },
  };
  return { admin, selects };
}

function sentTemplateData(): Row {
  expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
  const [, , opts] = sendTemplateEmail.mock.calls[0] as [string, string, Row];
  return opts.templateData as Row;
}

beforeEach(() => sendTemplateEmail.mockClear());

describe("the application-received email", () => {
  it("says 'Confidential employer' for a confidential role", async () => {
    const { admin, selects } = fakeAdmin({
      title: "Mushroom Harvesting Manager",
      organization_id: "org-1",
      posting_confidentiality: "confidential",
    });
    const out = await sendApplicationConfirmationEmail(admin, APP_ID);
    expect(out).toMatchObject({ ok: true, status: "sent" });
    const data = sentTemplateData();
    expect(data.organizationName).toBe("Confidential employer");
    expect(JSON.stringify(data)).not.toContain("Hughes");
    // Only the one value is read, never the whole intake_context.
    expect(selects.positions).toEqual([
      "title,organization_id,posting_confidentiality:intake_context->posting->>confidentiality",
    ]);
  });

  it("names the client of a public role, as before", async () => {
    const { admin } = fakeAdmin({
      title: "Mushroom Harvesting Manager",
      organization_id: "org-1",
      posting_confidentiality: "public",
    });
    await sendApplicationConfirmationEmail(admin, APP_ID);
    expect(sentTemplateData()).toMatchObject({
      organizationName: "Hughes Mushrooms",
      positionTitle: "Mushroom Harvesting Manager",
      candidateFirstName: "Adiya",
    });
  });

  it("names the client when the role never set a confidentiality", async () => {
    const { admin } = fakeAdmin({
      title: "Mushroom Harvesting Manager",
      organization_id: "org-1",
      posting_confidentiality: null,
    });
    await sendApplicationConfirmationEmail(admin, APP_ID);
    expect(sentTemplateData().organizationName).toBe("Hughes Mushrooms");
  });
});
