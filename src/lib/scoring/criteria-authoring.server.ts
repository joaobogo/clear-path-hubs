/**
 * Per-role scoring criteria authoring.
 *
 * A rubric version is the contract that says what a role is scored on. Drafts
 * are editable; published versions are immutable and are the only thing a score
 * run may reference. Publishing supersedes the previous active version and
 * writes an audit event, so "which criteria scored this candidate" always has a
 * single, provable answer.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const CRITERIA_AUDIT_ENTITY = "rubric_version";

export type { CriterionDraft, RubricVersionSummary } from "./criteria-model";
import {
  EDITABLE_STATUSES,
  PUBLISHED_STATUSES,
  normaliseWeights,
  validateForPublish,
  type CriterionDraft,
  type RubricVersionSummary,
} from "./criteria-model";

export { normaliseWeights, validateForPublish };

function readCriteria(row: Record<string, unknown>): CriterionDraft[] {
  const dims = row['dimensions'];
  const weights = (row['weights'] ?? {}) as Record<string, unknown>;
  if (!Array.isArray(dims)) return [];
  return dims.map((d) => {
    const item = (d ?? {}) as Record<string, unknown>;
    const key = String(item['key'] ?? item['label'] ?? "");
    return {
      key,
      label: String(item['label'] ?? key),
      evidence: String(item['evidence'] ?? ""),
      weight: Number(item['weight'] ?? weights[key] ?? 0),
      must_have: Boolean(item['must_have']),
    };
  });
}


export async function listRubricVersions(
  admin: Admin,
  positionId: string,
): Promise<{ position: { id: string; title: string; organization_id: string }; versions: RubricVersionSummary[] }> {
  const a = admin as unknown as { from: (t: string) => Any };

  const { data: position, error: posErr } = await a
    .from("positions")
    .select("id, title, organization_id")
    .eq("id", positionId)
    .maybeSingle();
  if (posErr) throw new Error(posErr.message);
  if (!position) throw new Error("Position not found");

  const { data: rows, error } = await a
    .from("rubric_versions")
    .select("*")
    .eq("position_id", positionId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = ((rows ?? []) as Any[]).map((r) => r.id as string);
  const runCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: runs } = await a
      .from("score_runs")
      .select("rubric_version_id")
      .in("rubric_version_id", ids);
    for (const r of (runs ?? []) as Any[]) {
      const id = r.rubric_version_id as string | null;
      if (!id) continue;
      runCounts.set(id, (runCounts.get(id) ?? 0) + 1);
    }
  }

  const versions: RubricVersionSummary[] = ((rows ?? []) as Any[]).map((r) => ({
    id: r.id as string,
    position_id: r.position_id as string,
    organization_id: r.organization_id as string,
    label: r.label as string,
    version_number: r.version_number as number,
    status: r.status as string,
    editable: EDITABLE_STATUSES.has(String(r.status)),
    criteria: readCriteria(r as Record<string, unknown>),
    created_at: r.created_at as string,
    approved_at: (r.approved_at as string | null) ?? null,
    superseded_at: (r.superseded_at as string | null) ?? null,
    scored_runs: runCounts.get(r.id as string) ?? 0,
  }));

  return {
    position: {
      id: position.id as string,
      title: position.title as string,
      organization_id: position.organization_id as string,
    },
    versions,
  };
}

export async function saveRubricDraft(
  admin: Admin,
  args: {
    positionId: string;
    versionId?: string | null;
    label: string;
    criteria: CriterionDraft[];
    actorUserId: string;
  },
): Promise<{ id: string; version_number: number }> {
  const a = admin as unknown as { from: (t: string) => Any };

  const { data: position, error: posErr } = await a
    .from("positions")
    .select("id, organization_id")
    .eq("id", args.positionId)
    .maybeSingle();
  if (posErr) throw new Error(posErr.message);
  if (!position) throw new Error("Position not found");

  const criteria = normaliseWeights(args.criteria);
  const weights = Object.fromEntries(criteria.map((c) => [c.key, c.weight]));

  if (args.versionId) {
    const { data: existing, error } = await a
      .from("rubric_versions")
      .select("id, status, version_number")
      .eq("id", args.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) throw new Error("Rubric version not found");
    if (!EDITABLE_STATUSES.has(String(existing.status))) {
      throw new Error("Published rubric versions are immutable — create a new draft instead.");
    }
    const { error: upErr } = await a
      .from("rubric_versions")
      .update({
        label: args.label,
        dimensions: criteria,
        weights,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.versionId);
    if (upErr) throw new Error(upErr.message);

    await writeAudit(a, {
      actorUserId: args.actorUserId,
      organizationId: position.organization_id as string,
      entityId: args.versionId,
      action: "rubric_version.draft_saved",
      after: { label: args.label, criteria },
    });
    return { id: args.versionId, version_number: existing.version_number as number };
  }

  const { data: last } = await a
    .from("rubric_versions")
    .select("version_number")
    .eq("position_id", args.positionId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = Number((last as { version_number?: number } | null)?.version_number ?? 0) + 1;

  const { data: created, error: insErr } = await a
    .from("rubric_versions")
    .insert({
      position_id: args.positionId,
      organization_id: position.organization_id,
      label: args.label,
      version_number: nextNumber,
      status: "draft",
      dimensions: criteria,
      weights,
      created_by: args.actorUserId,
      snapshot: { criteria },
    })
    .select("id, version_number")
    .single();
  if (insErr) throw new Error(insErr.message);

  await writeAudit(a, {
    actorUserId: args.actorUserId,
    organizationId: position.organization_id as string,
    entityId: created.id as string,
    action: "rubric_version.draft_created",
    after: { label: args.label, version_number: nextNumber, criteria },
  });
  return { id: created.id as string, version_number: created.version_number as number };
}

export async function publishRubricVersion(
  admin: Admin,
  args: { versionId: string; actorUserId: string },
): Promise<{ ok: true; version_number: number }> {
  const a = admin as unknown as { from: (t: string) => Any };

  const { data: version, error } = await a
    .from("rubric_versions")
    .select("*")
    .eq("id", args.versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!version) throw new Error("Rubric version not found");
  if (!EDITABLE_STATUSES.has(String(version.status))) {
    throw new Error("This version is already published.");
  }

  const criteria = normaliseWeights(readCriteria(version as Record<string, unknown>));
  const problems = validateForPublish(criteria);
  if (problems.length > 0) throw new Error(problems.join(" "));

  const now = new Date().toISOString();

  // Supersede the current published version for this position.
  await a
    .from("rubric_versions")
    .update({ status: "superseded", superseded_at: now })
    .eq("position_id", version.position_id)
    .in("status", PUBLISHED_STATUSES as unknown as string[]);

  const { error: upErr } = await a
    .from("rubric_versions")
    .update({
      status: "active",
      approved_at: now,
      approved_by: args.actorUserId,
      dimensions: criteria,
      weights: Object.fromEntries(criteria.map((c) => [c.key, c.weight])),
      snapshot: { criteria, published_at: now },
      updated_at: now,
    })
    .eq("id", args.versionId);
  if (upErr) throw new Error(upErr.message);

  await writeAudit(a, {
    actorUserId: args.actorUserId,
    organizationId: version.organization_id as string,
    entityId: args.versionId,
    action: "rubric_version.published",
    after: { version_number: version.version_number, criteria, published_at: now },
  });

  return { ok: true, version_number: version.version_number as number };
}

async function writeAudit(
  a: { from: (t: string) => Any },
  args: {
    actorUserId: string;
    organizationId: string;
    entityId: string;
    action: string;
    after: Record<string, unknown>;
  },
) {
  await a.from("audit_events").insert({
    actor_user_id: args.actorUserId,
    organization_id: args.organizationId,
    entity_type: CRITERIA_AUDIT_ENTITY,
    entity_id: args.entityId,
    action: args.action,
    after_state: args.after,
  });
}
