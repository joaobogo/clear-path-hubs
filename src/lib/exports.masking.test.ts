/**
 * Guards the two promises the admin CSV export makes about what leaves the
 * building: the row cap is applied server-side and stated in the file, and
 * contact details are masked when the requester chose masking.
 *
 * A fake client stands in for Supabase so both branches are exercised without
 * depending on which live rows happen to have contact release.
 */
import { describe, expect, it } from "vitest";
import { EXPORT_ROW_CAP, runExportJob } from "./exports.server";

type Captured = { csv: string; limit: number | null; update: Record<string, unknown> };

function fakeClient(opts: {
  rows: Array<Record<string, unknown>>;
  count: number;
  filters: Record<string, unknown>;
}) {
  const captured: Captured = { csv: "", limit: null, update: {} };
  const job = {
    id: "job-1",
    requested_by: "user-1",
    export_type: "admin_candidate_list",
    scope_label: "Position: Test",
    filters: opts.filters,
  };

  const viewQuery = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["eq", "gte", "lte", "not", "order"]) {
      chain[m] = () => chain;
    }
    chain["limit"] = (n: number) => {
      captured.limit = n;
      return Promise.resolve({ data: opts.rows.slice(0, n), count: opts.count, error: null });
    };
    return chain;
  };

  const client = {
    from: (table: string) => {
      if (table === "export_jobs") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: job, error: null }) }) }),
          update: (patch: Record<string, unknown>) => {
            if (patch["status"] !== "running") Object.assign(captured.update, patch);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "audit_events") return { insert: async () => ({ error: null }) };
      if (table === "v_admin_candidate_index") return { select: () => viewQuery() };
      // organizations / positions / intake_submissions reads from the test-scope
      // helper: no test orgs in this fixture.
      return {
        select: () => {
          const q: Record<string, unknown> = {
            eq: () => q,
            in: () => q,
            or: () => q,
            not: () => q,
            ilike: () => q,
            order: () => q,
            limit: () => q,
            maybeSingle: async () => ({ data: null, error: null }),
            then: (res: (v: unknown) => unknown) => res({ data: [], error: null }),
          };
          return q;
        },
      };
    },
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: {
      from: () => ({
        upload: async (_path: string, blob: Blob) => {
          captured.csv = await blob.text();
          return { error: null };
        },
      }),
    },
  };

  return { client, captured };
}

const released = (i: number) => ({
  match_id: `m${i}`,
  full_name: `Candidate ${i}`,
  position_id: "pos-1",
  contact_released: true,
  email: `first.last${i}@example.com`,
  phone: `+1 415 555 01${String(i).padStart(2, "0")}`,
});

describe("admin CSV export", () => {
  it("masks contact details when the requester chose masking", async () => {
    const { client, captured } = fakeClient({
      rows: [released(1)],
      count: 1,
      filters: { position_id: "pos-1", include_contact: true, mask_contacts: true },
    });

    const res = await runExportJob(client, "job-1", "user-1");
    expect(res.status).toBe("completed");

    const lines = captured.csv.split("\n");
    const cols = lines.find((l) => l.startsWith("match_id"))!.split(",");
    const row = lines[lines.length - 1]!.split(",");
    expect(row[cols.indexOf("email")]).toBe("f***@example.com");
    expect(row[cols.indexOf("phone")]).toBe("••••01");
    expect(captured.csv).not.toContain("first.last1@example.com");
    expect(captured.csv).not.toContain("4155550101");
    expect(captured.csv).toContain("# Contact details: INCLUDED BUT MASKED");
    expect(captured.update["contact_included"]).toBe(true);
  });

  it("writes contact details in full only when masking is explicitly declined", async () => {
    const { client, captured } = fakeClient({
      rows: [released(2)],
      count: 1,
      filters: { position_id: "pos-1", include_contact: true, mask_contacts: false },
    });

    await runExportJob(client, "job-1", "user-1");
    expect(captured.csv).toContain("first.last2@example.com");
    expect(captured.csv).toContain("# Contact details: INCLUDED IN FULL");
  });

  it("caps rows server-side and says so in the file", async () => {
    const rows = Array.from({ length: EXPORT_ROW_CAP + 10 }, (_, i) => released(i));
    const { client, captured } = fakeClient({
      rows,
      count: EXPORT_ROW_CAP + 4321,
      filters: { position_id: "pos-1" },
    });

    const res = await runExportJob(client, "job-1", "user-1");
    expect(res.status).toBe("completed");
    expect(captured.limit).toBe(EXPORT_ROW_CAP);

    const dataRows = captured.csv.split("\n").filter((l) => l.startsWith("m"));
    expect(dataRows).toHaveLength(EXPORT_ROW_CAP);
    expect(captured.csv).toContain(`# Rows: ${EXPORT_ROW_CAP} (capped at ${EXPORT_ROW_CAP} of ${EXPORT_ROW_CAP + 4321})`);
    expect(captured.update["row_count"]).toBe(EXPORT_ROW_CAP);
  });

  it("refuses an unscoped export", async () => {
    const { client } = fakeClient({ rows: [], count: 0, filters: {} });
    const res = await runExportJob(client, "job-1", "user-1");
    expect(res.status).toBe("failed");
    expect(res.error).toMatch(/must name a position or a client/i);
  });
});
