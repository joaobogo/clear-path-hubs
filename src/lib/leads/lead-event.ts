/**
 * The unified lead event.
 *
 * Every lead-producing surface on the website (intake, express onboarding,
 * discovery-call booking, marketing inquiry, contact form, candidate
 * application) emits this one shape. Nothing else may invent its own
 * notification payload — that fragmentation is what this module removes.
 *
 * Pure: no I/O, safe to import anywhere.
 */
import {
  LEAD_TYPE_DEFAULT_LINK,
  LEAD_TYPE_PRIORITY,
  type LeadPriority,
  type LeadType,
} from "@/config/lead-notifications";

export type LeadEventInput = {
  leadType: LeadType;
  /** Stable id of the originating record — drives idempotency. */
  sourceId: string;
  /** Which form/surface produced it, e.g. "public_contact_form". */
  source: string;
  /** Path the visitor was on, when known. */
  sourcePage?: string | null;
  fullName?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null
  /** Free-text the person wrote (message, role summary, notes). */
  message?: string | null;
  /** Extra label/value rows shown in Teams and email, in order. */
  facts?: Array<{ label: string; value: unknown }>;
  /** Table + id of the permanent record, for traceability. */
  recordTable?: string | null;
  recordId?: string | null;
  organizationId?: string | null;
  positionId?: string | null;
  /** Deep link for staff. Defaults per lead type. */
  linkPath?: string | null;
  /** Raise urgency above the lead type's baseline. */
  priority?: LeadPriority | null;
  ownerEmail?: string | null;
  /** Whether the CRM adapter already has (or will get) this lead. */
  crmStatus?: "synced" | "queued" | "failed" | "not_applicable" | null;
  crmDetail?: string | null;
  /** Campaign attribution, flattened for reporting. */
  attribution?: Record<string, unknown> | null;
};

export type NormalizedLeadEvent = {
  idempotencyKey: string;
  leadType: LeadType;
  source: string;
  sourcePage: string | null;
  priority: LeadPriority;
  fullName: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  message: string | null;
  facts: Array<{ label: string; value: string }>;
  recordTable: string | null;
  recordId: string | null;
  organizationId: string | null;
  positionId: string | null;
  linkPath: string;
  ownerEmail: string | null;
  crmStatus: "synced" | "queued" | "failed" | "not_applicable";
  crmDetail: string | null;
  attribution: Record<string, unknown> | null;
};

const PRIORITY_RANK: Record<LeadPriority, number> = { standard: 0, high: 1, urgent: 2 };

function clean(value: unknown, max = 2000): string | null {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text.slice(0, max) : null;
}

/** Highest of the type baseline and any explicit override. */
export function resolveLeadPriority(
  leadType: LeadType,
  requested?: LeadPriority | null,
): LeadPriority {
  const base = LEAD_TYPE_PRIORITY[leadType];
  if (!requested) return base;
  return PRIORITY_RANK[requested] > PRIORITY_RANK[base] ? requested : base;
}

export function normalizeLeadEvent(input: LeadEventInput): NormalizedLeadEvent {
  return {
    idempotencyKey: `${input.leadType}:${input.sourceId}`.slice(0, 200),
    leadType: input.leadType,
    source: clean(input.source, 80) ?? input.leadType,
    sourcePage: clean(input.sourcePage, 500),
    priority: resolveLeadPriority(input.leadType, input.priority ?? null),
    fullName: clean(input.fullName, 200),
    email: clean(input.email, 320)?.toLowerCase() ?? null,
    company: clean(input.company, 200),
    phone: clean(input.phone, 60),
    message: clean(input.message, 4000),
    facts: (input.facts ?? [])
      .map((f) => ({ label: clean(f.label, 80) ?? "", value: clean(f.value, 1000) ?? "" }))
      .filter((f) => f.label.length > 0 && f.value.length > 0),
    recordTable: clean(input.recordTable, 80),
    recordId: clean(input.recordId, 120),
    organizationId: input.organizationId ?? null,
    positionId: input.positionId ?? null,
    linkPath: clean(input.linkPath, 300) ?? LEAD_TYPE_DEFAULT_LINK[input.leadType],
    ownerEmail: clean(input.ownerEmail, 320)?.toLowerCase() ?? null,
    crmStatus: input.crmStatus ?? "not_applicable",
    crmDetail: clean(input.crmDetail, 500),
    attribution: input.attribution ?? null,
  };
}
