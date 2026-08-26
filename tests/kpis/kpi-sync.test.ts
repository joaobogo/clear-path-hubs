/**
 * Parity gate: every business figure agrees three ways.
 *
 * For one seeded workspace each figure is computed
 *   1. straight from the raw tables in SQL,
 *   2. by the single reader in `src/lib/kpis/`,
 *   3. by the database view, where one exists,
 * and any disagreement fails loudly. A reader that starts to narrow rows, or a
 * raw table that stops matching what the screens print, is caught here.
 *
 * Skipped when the process has no database access (no `PGHOST`).
 */
import { describe, expect, it } from "vitest";
import {
  createPsqlSupabase,
  hasDatabaseAccess,
  sqlCount,
  sqlJson,
} from "./psql-supabase";
import {
  countCandidatesInPlay,
  countConfirmedHiresForOrg,
  countInterviewsAwaitingTime,
  countInterviewsHeld,
  countOpenOffers,
  countOpenRolesForOrg,
  countRolesForOrg,
  countSeatsInUse,
  interviewWindow,
  loadVisibleMatches,
} from "@/lib/kpis/index.server";

const live = hasDatabaseAccess();

/** The workspace to prove against: override with KPI_SYNC_ORG_ID in CI. */
function resolveOrgId(): string | null {
  const fromEnv = process.env["KPI_SYNC_ORG_ID"];
  if (fromEnv) return fromEnv;
  const rows = sqlJson<{ id: string }>(
    `select o.id
       from public.organizations o
       join public.positions p on p.organization_id = o.id
      where o.name ilike '%Demo%'
      group by o.id
      order by count(p.id) desc
      limit 1`,
  );
  return rows[0]?.id ?? null;
}

describe.skipIf(!live)("business figures agree with the raw rows", () => {
  const supabase = createPsqlSupabase();
  const orgId = live ? resolveOrgId() : null;
  const org = `organization_id = '${orgId}'`;

  it("has a workspace to prove against", () => {
    expect(orgId).toBeTruthy();
  });

  it("confirmed hires", async () => {
    const raw = sqlCount(
      `select count(*) as n from public.hire_records
        where ${org} and status = 'hire_confirmed'`,
    );
    expect(await countConfirmedHiresForOrg(supabase, orgId!)).toBe(raw);
  });

  it("open roles and total roles", async () => {
    const excluded = "('draft','archived')";
    const testTitle =
      `(is_test_record is true or upper(coalesce(title,'')) like any (array['%BROWSER-TEST%','%GATE-%','%QA %','%QA-%','%TEST-%']))`;
    const open = sqlCount(
      `select count(*) as n from public.positions
        where ${org} and status in ('active','approved','paused') and not ${testTitle}`,
    );
    const total = sqlCount(
      `select count(*) as n from public.positions
        where ${org} and not ${testTitle}`,
    );
    expect(await countOpenRolesForOrg(supabase, orgId!)).toBe(open);
    const counts = await countRolesForOrg(supabase, orgId!);
    expect(counts.open).toBe(open);
    expect(counts.total).toBe(total);
    expect(total).toBeGreaterThanOrEqual(
      sqlCount(
        `select count(*) as n from public.positions
          where ${org} and status not in ${excluded} and not ${testTitle}`,
      ),
    );
  });

  it("interviews awaiting a time", async () => {
    const raw = sqlCount(
      `select count(distinct candidate_match_id) as n from public.interviews
        where ${org} and status in ('requested','scheduling')
          and candidate_match_id is not null`,
    );
    expect(await countInterviewsAwaitingTime(supabase, orgId!)).toBe(raw);
  });

  it("interviews held in the rolling window", async () => {
    const now = new Date();
    const w = interviewWindow(now);
    const raw = sqlCount(
      `select count(*) as n from public.interviews
        where ${org} and status <> 'cancelled' and cancelled_at is null
          and (
            (completed_at >= '${w.startIso}' and completed_at <= '${w.endIso}')
            or (scheduled_at >= '${w.startIso}' and scheduled_at <= '${w.endIso}'
                and scheduled_at <= '${now.toISOString()}')
          )`,
    );
    expect(await countInterviewsHeld(supabase, orgId!, w, now)).toBe(raw);
  });

  it("seats in use", async () => {
    const raw = sqlCount(
      `select count(*) as n from public.memberships
        where ${org} and role in ('client_admin','client_editor','client_viewer')
          and status in ('active','invited')`,
    );
    expect(await countSeatsInUse(supabase, orgId!)).toBe(raw);
  });

  it("candidates in play", async () => {
    const raw = sqlCount(
      `select count(*) as n from public.candidate_matches
        where ${org} and client_visibility = 'visible' and is_test_record = false
          and stage not in ('hired','not_moving_forward','archived')`,
    );
    expect(await countCandidatesInPlay(supabase, orgId!)).toBe(raw);
  });

  it("open offers", async () => {
    const raw = sqlCount(
      `select count(*) as n from public.candidate_matches m
        where m.${org.replace("organization_id", "organization_id")}
          and m.client_visibility = 'visible' and m.is_test_record = false
          and m.stage = 'offer'
          and not exists (
            select 1 from public.hire_records h
             where h.candidate_match_id = m.id and h.status = 'hire_confirmed'
          )`,
    );
    expect(await countOpenOffers(supabase, orgId!)).toBe(raw);
  });

  it("client-visible matches match the dashboard view", async () => {
    const viewCount = sqlCount(
      `select coalesce(visible_matches, 0) as n from public.client_dashboard_kpis
        where ${org}`,
    );
    const testRows = sqlCount(
      `select count(*) as n from public.candidate_matches
        where ${org} and client_visibility = 'visible' and is_test_record = true`,
    );
    const reader = (await loadVisibleMatches(supabase, orgId!)).length;
    // The view counts every visible row; the reader excludes test fixtures.
    expect(reader + testRows).toBe(viewCount);
  });
});
