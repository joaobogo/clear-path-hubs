// Server-only helpers, schemas and constants for the client workspace service.
// The `*.functions.ts` wrappers must stay thin (imports + createServerFn only),
// so every helper, constant and query builder lives here.
// Removed createServerFn import to avoid circular dependency and manifest errors.
// Server functions must be declared in thin *.functions.ts wrappers.
import { briefField } from "@/lib/position-info-requests";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CLIENT_PERMISSIONS, type ClientPermission } from "@/lib/authz";
import { computeRoleLaunchState } from "@/lib/role-launch.server";
import { DECLINE_REASONS } from "@/lib/client-decision-reasons";
import {
  DEAL_BREAKER_REASON_CODES,
  normalizeDealBreakers,
} from "@/lib/client-deal-breakers";

import {
  CLIENT_CANDIDATE_SELECT,

  loadKpiRows,
  loadRoleStageDates,
  computeKpis,
  loadClientEvidenceItems,
  toClientCandidateDTO,
  TOP_FIT_LABELS,
  type MatchStage,
  type KpiRow,
} from "@/lib/client-kpi.server";
import {
  buildPipelineStatusLine,
  buildPipelineActionLabel,
  type PipelineStatusInput,
} from "@/lib/client-pipeline-language";
import { computeRoleProgress } from "@/lib/client-role-progress";
import { countLanes } from "@/lib/client-pipeline-lane";
import { computeClientRoleStatus } from "@/lib/client-role-status";
import { computeRoleRisk } from "@/lib/client-role-risk";
import { computeHiringHealth } from "@/lib/client-hiring-health";
import { buildQueue, type QueueItem } from "@/lib/client-decision-queue";
import { buildOfferRow } from "@/lib/client-offer-holder";
import { computeNextMilestone } from "@/lib/client-next-milestone";
import { buildRoleTimeline } from "@/lib/client-role-timeline";
import {
  assertWorkspaceAccess,
  assertWorkspaceAdmin,
  assertWorkspaceWrite,
  readWorkspaceAccess,
} from "@/lib/authz/workspace-access";
import { hydrateClientCandidateProfiles } from "@/lib/client-candidate-hydrate.server";
import {
  advanceGateError,
  stageNeedsAgreedBrief,
  evaluateAdvanceGate,
} from "@/lib/client/advance-gate";
import { assessFreshness, type Freshness } from "@/lib/scoring/score-freshness";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = any;

export const traceId = () => `cl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ClientRole =
  | "client_admin"
  | "client_editor"
  | "client_viewer"
  | "platform_admin"
  | "operations";


// ─── Context resolution ─────────────────────────────────────────────────────

export async function resolveContext(supabase: AnyRow, userId: string, orgId?: string) {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select(
      "organization_id, role, status, permissions, organizations(id, name, industry, parent_organization_id, logo_url, brand_display_name, brand_primary_color, brand_accent_color)",
    )

    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const allClientMemberships = (memberships as AnyRow[]).filter((m) =>
    ["client_admin", "client_editor", "client_viewer"].includes(m.role),
  );
  // A membership row survives after its organization is archived, but the org
  // itself stops being readable (is_org_member() requires
  // organizations.archived_at IS NULL, and RLS applies that to this join and to
  // every downstream read). Selecting such a row as the active workspace made
  // healthy pages fail authorization and render "we couldn't load ..." cards.
  // Only memberships whose organization is actually readable are usable.
  const clientMemberships = allClientMemberships.filter((m) => m.organizations != null);
  const staffMemberships = (memberships as AnyRow[]).filter((m) =>
    ["platform_admin", "operations"].includes(m.role),
  );
  const isStaff = staffMemberships.length > 0;
  let active = clientMemberships.find((m) => m.organization_id === orgId);
  if (!active && !orgId) active = clientMemberships[0];
  // Staff can view any org they name.
  if (!active && isStaff && orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select(
        "id, name, industry, parent_organization_id, logo_url, brand_display_name, brand_primary_color, brand_accent_color",
      )
      .eq("id", orgId)
      .maybeSingle();
    if (org) {
      active = {
        organization_id: org.id,
        role: "client_admin" as const,
        // Staff impersonating an org context get the full client permission set.
        permissions: [...CLIENT_PERMISSIONS],
        organizations: org,
      };
    }
  }
  return { active, memberships: clientMemberships, isStaff };
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const brandingSchema = z.object({
  orgId: z.string().uuid(),
  logo_url: z.string().url().max(500).nullable(),
  brand_display_name: z.string().trim().min(1).max(120).nullable(),
  brand_primary_color: z.string().regex(HEX_COLOR).nullable(),
  brand_accent_color: z.string().regex(HEX_COLOR).nullable(),
});

/** Map canonical rows onto the client-language vocabulary. */
export function pipelineLanguageInput(rows: KpiRow[], status: string): PipelineStatusInput {
  const scheduled = rows.filter((r) => r.stage === "interview_process" && r.interview_scheduled);
  const nextInterviewAt =
    scheduled
      .map((r) => r.next_interview_at)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;
  // Stage-shaped figures come from the canonical lane derivation.
  const { counts } = countLanes(rows);
  return {
    status,
    awaitingReview: counts.delivered,
    shortlisted: counts.shortlisted,
    interviewsToConfirm: rows.filter((r) => r.interview_needs_confirmation).length,
    interviewsScheduled: scheduled.length,
    nextInterviewAt,
    offers: counts.offer,
    hires: counts.hired,
    totalCandidates: rows.length,
  };
}

export function nextMilestoneFor(rows: KpiRow[], status: string): string | null {
  if (status === "draft") return "Awaiting intake approval";
  if (status === "paused") return "Position paused";
  if (status === "closed" || status === "archived") return null;
  if (rows.some((r) => r.stage === "offer")) return "Offer response";
  if (rows.some((r) => r.stage === "interview_process"))
    return "Interview outcome";
  if (rows.some((r) => r.stage === "shortlisted")) return "Interview requests";
  if (rows.length > 0) return "Review new candidates";
  return "Awaiting first candidates";
}

export type CandidateFilter =
  | "all"
  | "new"
  | "top"
  | "shortlisted"
  | "interview"
  | "hired"
  | "not_moving_forward";

// Canonical transition matrix — mirrored by client kanban STAGE_GRAPH.
export const STAGE_GRAPH: Record<MatchStage, MatchStage[]> = {
  delivered: ["shortlisted", "interview_process", "not_moving_forward"],
  shortlisted: ["interview_process", "not_moving_forward"],
  interview_process: ["offer", "shortlisted", "not_moving_forward"],
  offer: ["hired", "not_moving_forward"],
  hired: [],
  not_moving_forward: ["shortlisted"],
};

/**
 * Reject if the caller is platform staff acting on an org where they hold no
 * active client-role membership AND no active interactive support session
 * exists for that org. Throws the typed `SUPPORT_VIEW_READ_ONLY` error the
 * spec requires; UI translates it to a friendly toast.
 */
export async function assertNotSupportViewReadOnly(supabase: AnyRow, userId: string, orgId: string) {
  const { data: isClientEditor } = await supabase.rpc("is_org_editor", {
    _user: userId,
    _org: orgId,
  });
  if (isClientEditor === true) return;
  const { data: isStaff } = await supabase.rpc("is_platform_staff", {
    _user: userId,
  });
  if (isStaff !== true) throw new Error("forbidden");
  // Staff — allow only when an interactive support session is currently open.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data: interactive, error } = await supabaseAdmin
    .from("support_sessions")
    .select("id, expires_at")
    .eq("actor_user_id", userId)
    .eq("organization_id", orgId)
    .eq("mode", "interactive")
    .is("ended_at", null)
    .gt("expires_at", now)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!interactive) {
    // Audit log accuracy: if we found a session but it was expired, mark it now.
    // The pg_cron job handles this eventually, but we ensure consistency on-read.
    await supabaseAdmin
      .from("support_sessions")
      .update({ ended_at: now, end_reason: "expired" })
      .eq("actor_user_id", userId)
      .eq("organization_id", orgId)
      .is("ended_at", null)
      .lt("expires_at", now);

    throw new Error("SUPPORT_VIEW_READ_ONLY");
  }
}

/**
 * Canonical write guard for the client workspace: organisation access and the
 * read-only `client_viewer` rule both come from `assertWorkspaceWrite`, then the
 * support-session rule is applied on top.
 */
export async function assertEditor(supabase: AnyRow, userId: string, orgId: string) {
  const access = await assertWorkspaceWrite(supabase, userId, orgId);
  await assertNotSupportViewReadOnly(supabase, userId, orgId);
  return access;
}

export async function loadMatch(supabase: AnyRow, orgId: string, matchId: string) {
  const { data, error } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, organization_id, position_id, application_id, candidate_profile_id, client_visibility",
    )
    .eq("id", matchId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("match_not_found");
  if (data.client_visibility !== "visible") throw new Error("match_not_visible");
  return data as AnyRow;
}

export async function writeAudit(
  supabase: AnyRow,
  opts: {
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id: string;
    before?: unknown;
    after?: unknown;
    trace_id: string;
  },
) {
  const { sanitizeInternalMarkers } = await import("./human-labels");

  const sanitizeState = (state: unknown) => {
    if (!state || typeof state !== "object") return state;
    const next = { ...state } as Record<string, unknown>;
    for (const [k, v] of Object.entries(next)) {
      if (typeof v === "string") next[k] = sanitizeInternalMarkers(v) ?? v;
    }
    return next;
  };

  await supabase.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id,
    before_state: (sanitizeState(opts.before) ?? null) as never,
    after_state: (sanitizeState(opts.after) ?? null) as never,
    trace_id: opts.trace_id,
  });
}

/** How long a client can take a decision back without asking anyone. */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

export const ACTION_TO_STAGE: Partial<Record<string, MatchStage>> = {
  shortlist: "shortlisted",
  request_interview: "interview_process",
  offer: "offer",
  not_moving_forward: "not_moving_forward",
  hire: "hired",
};

export type ClientActionKey =
  | "shortlist"
  | "request_interview"
  | "request_more_information"
  | "hold"
  | "request_contact_release"
  | "not_moving_forward"
  | "submit_feedback"
  | "offer"
  | "hire";

export const CLIENT_ACTION_KEYS = [
  "shortlist",
  "request_interview",
  "request_more_information",
  "hold",
  "request_contact_release",
  "not_moving_forward",
  "submit_feedback",
  "offer",
  "hire",
] as const;

// Actions that must carry a structured reason, so admins always know *why*.
export const REASON_REQUIRED: ReadonlySet<string> = new Set([
  "not_moving_forward",
  "request_more_information",
  "hold",
]);

export const CLIENT_DECLINE_CODES: ReadonlySet<string> = new Set([
  ...DECLINE_REASONS.map((r) => r.code),
  // The client's own stated deal-breakers are pickable reasons too, so the
  // rule they wrote at intake is the reason we record.
  ...DEAL_BREAKER_REASON_CODES,
]);

export async function assertOrgAdmin(supabase: AnyRow, userId: string, orgId: string): Promise<void> {
  await assertWorkspaceAdmin(supabase, userId, orgId);
}

export const clientMemberRoleZ = z.enum(["client_admin", "client_editor", "client_viewer"]);

export const notifPrefsShape = {
  candidate_delivered: true,
  interview_request: true,
  new_message: true,
  offer_update: true,
  hire_update: true,
  email_enabled: true,
  digest: "immediate" as "immediate" | "daily" | "weekly" | "off",
};

export const companyProfileZ = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((s) => {
      if (s === "") return null;
      if (/^https?:\/\//i.test(s)) return s;
      return `https://${s}`;
    })
    .nullable()
    .refine(
      (v) => v == null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v),
      "Website must start with http:// or https://",
    ),
  industry: z
    .string()
    .trim()
    .max(120)
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  headquarters: z
    .string()
    .trim()
    .max(200)
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  phone: z
    .string()
    .trim()
    .max(60)
    .transform((s) => (s === "" ? null : s))
    .nullable(),
});

export const notifPrefsZ = z.object({
  orgId: z.string().uuid(),
  candidate_delivered: z.boolean(),
  interview_request: z.boolean(),
  new_message: z.boolean(),
  offer_update: z.boolean(),
  hire_update: z.boolean(),
  email_enabled: z.boolean(),
  digest: z.enum(["immediate", "daily", "weekly", "off"]),
});

export const timezoneZ = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA timezone."),
});

export const confirmBlueprintSchema = z.object({
  orgId: z.string().uuid(),
  positionId: z.string().uuid(),
});
