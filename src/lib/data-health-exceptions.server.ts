/**
 * Data health exception reads. Server-only: takes the service-role client from
 * the caller so counts are truthful across tenants, and reuses the shared
 * ranking so the list can never disagree with the actions.
 *
 * Read-only. Nothing in this module deletes rows.
 */
import {
  ageDays,
  rankExceptions,
  type DataHealthException,
  type DataHealthRepair,
} from "./data-health-exceptions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const MATCH_SELECT =
  "id, client_visibility, organization_id, position_id, candidate_profile_id, created_at, processing_state, is_test_record, " +
  "positions:position_id(id, title, organization_id, status), " +
  "candidate_profiles:candidate_profile_id(id, full_name)";

type OrgRow = { id: string; name: string | null; is_test_record: boolean | null };

function orgName(orgs: Map<string, OrgRow>, id: string | null): string | null {
  if (!id) return null;
  return orgs.get(id)?.name ?? null;
}

function isTestOrg(orgs: Map<string, OrgRow>, id: string | null): boolean {
  if (!id) return false;
  return orgs.get(id)?.is_test_record === true;
}

export type DataHealthExceptionsResult = {
  rows: DataHealthException[];
  totals: {
    all: number;
    client_visible: number;
    repairable: number;
  };
  include_test: boolean;
  generated_at: string;
};

export async function loadDataHealthExceptions(
  admin: Any,
  opts: { includeTest?: boolean; limit?: number } = {},
): Promise<DataHealthExceptionsResult> {
  const includeTest = opts.includeTest ?? false;
  const limit = opts.limit ?? 200;

  const { data: orgRows } = await admin
    .from("organizations")
    .select("id, name, is_test_record")
    .limit(2000);
  const orgs = new Map<string, OrgRow>(
    ((orgRows ?? []) as OrgRow[]).map((o) => [o.id, o]),
  );

  const out: DataHealthException[] = [];

  // ── 1. Unresolved scoring orphans ─────────────────────────────────────────
  const { data: orphans } = await admin
    .from("scoring_orphans")
    .select(
      "id, candidate_match_id, score_run_id, organization_id, reason, detected_at",
    )
    .is("resolved_at", null)
    .order("detected_at", { ascending: true })
    .limit(300);

  const orphanMatchIds = ((orphans ?? []) as Any[])
    .map((o) => o.candidate_match_id as string | null)
    .filter((v): v is string => !!v);

  const orphanMatches = new Map<string, Any>();
  if (orphanMatchIds.length > 0) {
    const { data: om } = await admin
      .from("candidate_matches")
      .select(MATCH_SELECT)
      .in("id", orphanMatchIds);
    for (const m of (om ?? []) as Any[]) orphanMatches.set(m.id as string, m);
  }

  for (const o of (orphans ?? []) as Any[]) {
    const m = o.candidate_match_id ? orphanMatches.get(o.candidate_match_id) : null;
    const organization_id = (o.organization_id ?? m?.organization_id ?? null) as string | null;
    out.push({
      key: `scoring_orphan:${o.id}`,
      kind: "scoring_orphan",
      record_id: o.id as string,
      record_label: `Orphan ${String(o.id).slice(0, 8)}`,
      candidate_match_id: (o.candidate_match_id ?? null) as string | null,
      candidate_name: (m?.candidate_profiles?.full_name ?? null) as string | null,
      position_id: (m?.position_id ?? null) as string | null,
      position_title: (m?.positions?.title ?? null) as string | null,
      organization_id,
      client_name: orgName(orgs, organization_id),
      client_visible: m?.client_visibility === "visible",
      detected_at: o.detected_at as string,
      age_days: ageDays(o.detected_at as string),
      detail: String(o.reason ?? "unresolved scoring identity"),
      repair: "acknowledge_orphan",
      is_test_record: m?.is_test_record === true || isTestOrg(orgs, organization_id),
    });
  }

  // ── 2. Broken matches: no position, no candidate, tenant mismatch ─────────
  const { data: matches } = await admin
    .from("candidate_matches")
    .select(MATCH_SELECT)
    .order("created_at", { ascending: false })
    .limit(1500);

  const matchRows = (matches ?? []) as Any[];

  for (const m of matchRows) {
    const pos = m.positions ?? null;
    const cp = m.candidate_profiles ?? null;
    const base = {
      candidate_match_id: m.id as string,
      candidate_name: (cp?.full_name ?? null) as string | null,
      position_id: (m.position_id ?? null) as string | null,
      position_title: (pos?.title ?? null) as string | null,
      client_visible: m.client_visibility === "visible",
      detected_at: m.created_at as string,
      age_days: ageDays(m.created_at as string),
      record_id: m.id as string,
      record_label: (cp?.full_name as string) ?? `Match ${String(m.id).slice(0, 8)}`,
    };

    if (!pos) {
      const organization_id = (m.organization_id ?? null) as string | null;
      out.push({
        ...base,
        key: `match_without_position:${m.id}`,
        kind: "match_without_position",
        organization_id,
        client_name: orgName(orgs, organization_id),
        detail: `Position ${String(m.position_id ?? "").slice(0, 8)} does not resolve.`,
        repair: "none",
        is_test_record: m.is_test_record === true || isTestOrg(orgs, organization_id),
      });
      continue;
    }

    if (!cp) {
      const organization_id = (m.organization_id ?? null) as string | null;
      out.push({
        ...base,
        key: `match_without_candidate:${m.id}`,
        kind: "match_without_candidate",
        organization_id,
        client_name: orgName(orgs, organization_id),
        detail: "Candidate profile does not resolve.",
        repair: "none",
        is_test_record: m.is_test_record === true || isTestOrg(orgs, organization_id),
      });
    }

    if (pos.organization_id && m.organization_id && pos.organization_id !== m.organization_id) {
      out.push({
        ...base,
        key: `match_org_mismatch:${m.id}`,
        kind: "match_org_mismatch",
        organization_id: pos.organization_id as string,
        client_name: orgName(orgs, pos.organization_id as string),
        detail: `Match sits under ${orgName(orgs, m.organization_id) ?? "another client"} while the position belongs to ${orgName(orgs, pos.organization_id) ?? "a different client"}.`,
        repair: "realign_match_org",
        is_test_record:
          m.is_test_record === true ||
          isTestOrg(orgs, m.organization_id) ||
          isTestOrg(orgs, pos.organization_id),
      });
    }
  }

  // ── 3. CV problems on those matches ───────────────────────────────────────
  const profileIds = Array.from(
    new Set(
      matchRows
        .map((m) => m.candidate_profile_id as string | null)
        .filter((v): v is string => !!v),
    ),
  );

  const filesByProfile = new Map<string, Any[]>();
  for (let i = 0; i < profileIds.length; i += 200) {
    const chunk = profileIds.slice(i, i + 200);
    const { data: files } = await admin
      .from("files")
      .select("id, candidate_profile_id, filename, file_status, parse_state, parse_error, created_at")
      .in("candidate_profile_id", chunk)
      .limit(2000);
    for (const f of (files ?? []) as Any[]) {
      const key = f.candidate_profile_id as string;
      const list = filesByProfile.get(key) ?? [];
      list.push(f);
      filesByProfile.set(key, list);
    }
  }

  for (const m of matchRows) {
    const cpId = m.candidate_profile_id as string | null;
    if (!cpId) continue;
    const files = filesByProfile.get(cpId) ?? [];
    const organization_id = (m.organization_id ?? null) as string | null;
    const shared = {
      candidate_match_id: m.id as string,
      candidate_name: (m.candidate_profiles?.full_name ?? null) as string | null,
      position_id: (m.position_id ?? null) as string | null,
      position_title: (m.positions?.title ?? null) as string | null,
      organization_id,
      client_name: orgName(orgs, organization_id),
      client_visible: m.client_visibility === "visible",
      is_test_record: m.is_test_record === true || isTestOrg(orgs, organization_id),
    };

    if (files.length === 0) {
      out.push({
        ...shared,
        key: `match_missing_cv:${m.id}`,
        kind: "match_missing_cv",
        record_id: m.id as string,
        record_label: (m.candidate_profiles?.full_name as string) ?? `Match ${String(m.id).slice(0, 8)}`,
        detected_at: m.created_at as string,
        age_days: ageDays(m.created_at as string),
        detail: "No CV file is attached to this candidate.",
        repair: "none",
      });
      continue;
    }

    const usable = files.find(
      (f) => f.file_status === "ready" && f.parse_state !== "failed",
    );
    if (usable) continue;

    const broken = files[0];
    out.push({
      ...shared,
      key: `file_unreadable:${broken.id}`,
      kind: "file_unreadable",
      record_id: broken.id as string,
      record_label: (broken.filename as string) ?? "CV file",
      detected_at: (broken.created_at as string) ?? (m.created_at as string),
      age_days: ageDays((broken.created_at as string) ?? (m.created_at as string)),
      detail:
        (broken.parse_error as string) ??
        `File status ${broken.file_status}, parse state ${broken.parse_state}.`,
      repair: "retry_parse",
    });
  }

  const filtered = includeTest ? out : out.filter((r) => !r.is_test_record);
  const ranked = rankExceptions(filtered);
  const repairable: DataHealthRepair[] = [
    "acknowledge_orphan",
    "realign_match_org",
    "retry_parse",
  ];

  return {
    rows: ranked.slice(0, limit),
    totals: {
      all: ranked.length,
      client_visible: ranked.filter((r) => r.client_visible).length,
      repairable: ranked.filter((r) => repairable.includes(r.repair)).length,
    },
    include_test: includeTest,
    generated_at: new Date().toISOString(),
  };
}

/** Recomputes a single exception so a repair can never act on stale input. */
export async function findException(
  admin: Any,
  key: string,
): Promise<DataHealthException | null> {
  const res = await loadDataHealthExceptions(admin, { includeTest: true, limit: 5000 });
  return res.rows.find((r) => r.key === key) ?? null;
}
