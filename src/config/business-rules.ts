/**
 * TaaSFlow — Canonical Business Rules
 * ====================================
 * SINGLE SOURCE OF TRUTH for every business-facing value across marketing,
 * dashboards, ROI, proposals, admin copy, and legal references.
 *
 * Rules:
 *   • Public pages, dashboards and server code MUST import values from this
 *     file (directly or via `useBusinessRules()` / `getBusinessRules()`).
 *   • Never hard-code a package price, delivery promise, retention window,
 *     scoring weight, response-time claim, CTA destination, or contact email
 *     in a component or route file.
 *   • Runtime overrides live in `public.business_rules_overrides` and are
 *     merged over these defaults by `getBusinessRules()`. Every change is
 *     appended to `public.business_rules_audit`.
 *
 * When conflicts existed prior to this file (48h vs one week vs 14 days;
 * "3 months access" vs "candidates forever"), we picked the canonical value
 * here and copy across the app resolves through this module.
 */

import { z } from "zod";
import {
  PRICE_PILOT_USD,
  PRICE_MULTI_USD,
  PRICE_SPRINT_USD,
  PRICE_SUB_BRONZE_USD,
  PRICE_SUB_SILVER_FROM_USD,
  PRICE_SUB_GOLD_FROM_USD,
  PRICE_SUB_BRONZE_DISPLAY,
  PRICE_SUB_SILVER_DISPLAY,
  PRICE_SUB_GOLD_DISPLAY,
  PRICE_SUB_ENTERPRISE_DISPLAY,
  SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL,
  PRICE_PILOT_DISPLAY,
  PRICE_MULTI_DISPLAY,
  PRICE_SPRINT_DISPLAY,
  PRICE_ENTERPRISE_DISPLAY,
  POSITION_BANDS,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const CTA_KEYS = [
  "start_intake",
  "book_a_call",
  "contact_sales",
  "browse_jobs",
  "sign_in",
] as const;
export type CtaKey = (typeof CTA_KEYS)[number];

export interface Cta {
  label: string;
  to: string;
  description: string;
}

export interface OneOffPackage {
  id: "pilot" | "multi" | "sprint" | "enterprise";
  name: string;
  eyebrow: string;
  minRoles: number;
  maxRoles: number | null;
  priceUsd: number | null;
  priceDisplay: string;
  cta: CtaKey;
  deliverables: string[];
}

export interface SubscriptionTier {
  id: "bronze" | "silver" | "gold" | "enterprise";
  name: string;
  priceUsdMonthly: number | null;
  priceDisplay: string;
  isCustom: boolean;
  minRolesPerMonth: number;
  maxRolesPerMonth: number | null;
  deliverables: string[];
  cta: CtaKey;
}

export interface ScoringDimension {
  id: string;
  label: string;
  /** Weight expressed as an integer percentage. All dimensions must sum to 100. */
  weight: number;
  description: string;
}

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
  tone: "excellent" | "strong" | "considered" | "gap";
}

// ---------------------------------------------------------------------------
// Canonical defaults
// ---------------------------------------------------------------------------

export const BUSINESS_RULES_DEFAULTS = {
  delivery: {
    /** Canonical first-shortlist promise. Resolves prior "48h / one week / 14 days" conflicts. */
    firstShortlistLabel: "First ranked shortlist in 5 days",
    firstShortlistShort: "in 5 days",
    turnaroundLabel: TURNAROUND_LABEL, // "5-day turnaround"
    recurringCadence: "Weekly refresh after go-live",
    recurringCadenceShort: "weekly",
    responseTime: "We reply to inbound within one business day",
  },
  retention: {
    /**
     * Reconciles "3 months access" vs "candidates forever":
     * - Platform access to the delivered shortlist workspace: 3 months included.
     * - Candidate records the client hired or shortlisted: owned by the client
     *   forever and searchable in the Talent Pool without additional fees.
     */
    workspaceAccessMonths: 3,
    workspaceAccessLabel: "3 months of workspace access included",
    ownershipLabel: "You keep every shortlisted candidate forever",
    talentPoolLabel: "Talent pool stays searchable forever",
  },
  packages: [
    {
      id: "pilot",
      name: "Pilot — Single Position",
      eyebrow: "1 active role",
      minRoles: POSITION_BANDS.pilot.min,
      maxRoles: POSITION_BANDS.pilot.max,
      priceUsd: PRICE_PILOT_USD,
      priceDisplay: PRICE_PILOT_DISPLAY,
      cta: "book_a_call",
      deliverables: [
        "First ranked shortlist in days",
        "Top 10 evidence-scored candidates",
        "Scoring rubric with fit notes",
        "3 months workspace access",
      ],
    },
    {
      id: "multi",
      name: "Multi Position",
      eyebrow: "2–5 active roles",
      minRoles: POSITION_BANDS.multi.min,
      maxRoles: POSITION_BANDS.multi.max,
      priceUsd: PRICE_MULTI_USD,
      priceDisplay: PRICE_MULTI_DISPLAY,
      cta: "book_a_call",
      deliverables: [
        "First ranked shortlist in days",
        "Top 10 per role, weekly refresh",
        "Shared intake context across roles",
        "3 months workspace access",
      ],
    },
    {
      id: "sprint",
      name: "Hiring Sprint",
      eyebrow: "6–10 active roles",
      minRoles: POSITION_BANDS.sprint.min,
      maxRoles: POSITION_BANDS.sprint.max,
      priceUsd: PRICE_SPRINT_USD,
      priceDisplay: PRICE_SPRINT_DISPLAY,
      cta: "book_a_call",
      deliverables: [
        "First ranked shortlist in days",
        "Parallel sourcing across roles",
        "Executive-portfolio dashboard",
        "3 months workspace access",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      eyebrow: "11+ roles / continuous hiring",
      minRoles: POSITION_BANDS.subscription.min,
      maxRoles: POSITION_BANDS.subscription.max,
      priceUsd: null,
      priceDisplay: PRICE_ENTERPRISE_DISPLAY,
      cta: "contact_sales",
      deliverables: [
        "Custom SLAs and dedicated agent capacity",
        "Multi-business-unit workspace",
        "Executive portfolio dashboard",
        "Full data ownership",
      ],
    },
  ] satisfies OneOffPackage[],
  subscriptions: [
    {
      id: "bronze",
      name: "Bronze",
      priceUsdMonthly: PRICE_SUB_BRONZE_USD,
      priceDisplay: PRICE_SUB_BRONZE_DISPLAY,
      isCustom: false,
      minRolesPerMonth: 1,
      maxRolesPerMonth: 3,
      cta: "book_a_call",
      deliverables: [
        "Up to 3 active roles per month",
        "Weekly ranked refresh",
        "3 months workspace access",
      ],
    },
    {
      id: "silver",
      name: "Silver",
      priceUsdMonthly: PRICE_SUB_SILVER_FROM_USD,
      priceDisplay: PRICE_SUB_SILVER_DISPLAY,
      isCustom: false,
      minRolesPerMonth: 4,
      maxRolesPerMonth: 8,
      cta: "book_a_call",
      deliverables: [
        "Up to 8 active roles per month",
        "Weekly ranked refresh",
        "Talent-pool memory across roles",
      ],
    },
    {
      id: "gold",
      name: "Gold",
      priceUsdMonthly: PRICE_SUB_GOLD_FROM_USD,
      priceDisplay: PRICE_SUB_GOLD_DISPLAY,
      isCustom: false,
      minRolesPerMonth: 9,
      maxRolesPerMonth: 20,
      cta: "book_a_call",
      deliverables: [
        "Up to 20 active roles per month",
        "Dedicated sourcing agent capacity",
        "Executive portfolio dashboard",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      priceUsdMonthly: null,
      priceDisplay: PRICE_SUB_ENTERPRISE_DISPLAY,
      isCustom: true,
      minRolesPerMonth: 21,
      maxRolesPerMonth: null,
      cta: "contact_sales",
      deliverables: [
        "Custom volume & SLAs",
        "Multi-BU workspace",
        "Dedicated success manager",
      ],
    },
  ] satisfies SubscriptionTier[],
  annualDiscountLabel: SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL,
  scoring: {
    dimensions: [
      { id: "must_haves", label: "Must-haves", weight: 40, description: "Non-negotiable requirements evidenced in the CV." },
      { id: "role_experience", label: "Role experience", weight: 25, description: "Directly comparable role-scope match." },
      { id: "domain_context", label: "Domain / industry", weight: 15, description: "Sector-specific context and vocabulary." },
      { id: "trajectory", label: "Trajectory", weight: 10, description: "Growth, ownership, tenure quality." },
      { id: "signals", label: "Signals & references", weight: 10, description: "Verifiable outcomes and references." },
    ] satisfies ScoringDimension[],
    bands: [
      { min: 85, max: 100, label: "Excellent fit", tone: "excellent" },
      { min: 70, max: 84, label: "Strong fit", tone: "strong" },
      { min: 55, max: 69, label: "Worth considering", tone: "considered" },
      { min: 0, max: 54, label: "Notable gaps", tone: "gap" },
    ] satisfies ScoreBand[],
  },
  ctas: {
    start_intake: { label: "Start client intake", to: "/intake", description: "Open the 5-step intake wizard." },
    book_a_call: { label: "Book a real call", to: "/contact", description: "30-minute discovery call with a human." },
    contact_sales: { label: "Contact sales", to: "/contact", description: "For enterprise / custom scope." },
    browse_jobs: { label: "Browse open jobs", to: "/jobs", description: "Public job board." },
    sign_in: { label: "Sign in", to: "/auth", description: "Existing users sign in to their workspace." },
  } satisfies Record<CtaKey, Cta>,
  contact: {
    salesEmail: "hello@taasflow.com",
    supportEmail: "support@taasflow.com",
    privacyEmail: "privacy@taasflow.com",
  },
  legal: {
    // These must match real routes in src/routes. There is no standalone DPA
    // page yet — data-processing terms live inside the privacy notice.
    privacyPolicyPath: "/privacy",
    termsPath: "/terms",
    dpaPath: "/privacy",
    companyLegalName: "TaaSFlow",
  },

} as const;

export type BusinessRules = typeof BUSINESS_RULES_DEFAULTS;

// ---------------------------------------------------------------------------
// Zod validation — runs on every server-side load, refusing invalid overrides.
// ---------------------------------------------------------------------------

const ctaKeySchema = z.enum(CTA_KEYS);

const packageSchema = z
  .object({
    id: z.enum(["pilot", "multi", "sprint", "enterprise"]),
    name: z.string().min(1),
    eyebrow: z.string().min(1),
    minRoles: z.number().int().positive(),
    maxRoles: z.number().int().positive().nullable(),
    priceUsd: z.number().int().nonnegative().nullable(),
    priceDisplay: z.string().min(1),
    cta: ctaKeySchema,
    deliverables: z.array(z.string().min(1)).min(1),
  })
  .refine(
    (p) => p.maxRoles === null || p.maxRoles >= p.minRoles,
    { message: "maxRoles must be null or ≥ minRoles" },
  );

const subscriptionSchema = z
  .object({
    id: z.enum(["bronze", "silver", "gold", "enterprise"]),
    name: z.string().min(1),
    priceUsdMonthly: z.number().int().nonnegative().nullable(),
    priceDisplay: z.string().min(1),
    isCustom: z.boolean(),
    minRolesPerMonth: z.number().int().positive(),
    maxRolesPerMonth: z.number().int().positive().nullable(),
    deliverables: z.array(z.string().min(1)).min(1),
    cta: ctaKeySchema,
  })
  .refine(
    (t) => t.maxRolesPerMonth === null || t.maxRolesPerMonth >= t.minRolesPerMonth,
    { message: "maxRolesPerMonth must be null or ≥ minRolesPerMonth" },
  )
  .refine(
    (t) => t.isCustom ? t.priceUsdMonthly === null : t.priceUsdMonthly !== null,
    { message: "Custom tiers must have null priceUsdMonthly; concrete tiers must have a number." },
  );

const scoringSchema = z
  .object({
    dimensions: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          weight: z.number().int().min(0).max(100),
          description: z.string().min(1),
        }),
      )
      .min(1),
    bands: z
      .array(
        z.object({
          min: z.number().int().min(0).max(100),
          max: z.number().int().min(0).max(100),
          label: z.string().min(1),
          tone: z.enum(["excellent", "strong", "considered", "gap"]),
        }),
      )
      .min(1),
  })
  .refine(
    (s) => s.dimensions.reduce((sum, d) => sum + d.weight, 0) === 100,
    { message: "Scoring dimension weights must sum to exactly 100." },
  )
  .refine(
    (s) => s.bands.every((b) => b.max >= b.min),
    { message: "Every score band max must be ≥ min." },
  );

export const businessRulesSchema = z
  .object({
    delivery: z.object({
      firstShortlistLabel: z.string().min(1),
      firstShortlistShort: z.string().min(1),
      turnaroundLabel: z.string().min(1),
      recurringCadence: z.string().min(1),
      recurringCadenceShort: z.string().min(1),
      responseTime: z.string().min(1),
    }),
    retention: z.object({
      workspaceAccessMonths: z.number().int().positive(),
      workspaceAccessLabel: z.string().min(1),
      ownershipLabel: z.string().min(1),
      talentPoolLabel: z.string().min(1),
    }),
    packages: z.array(packageSchema).min(1),
    subscriptions: z.array(subscriptionSchema).min(1),
    annualDiscountLabel: z.string().min(1),
    scoring: scoringSchema,
    ctas: z.record(ctaKeySchema, z.object({
      label: z.string().min(1),
      to: z.string().min(1).startsWith("/"),
      description: z.string().min(1),
    })),
    contact: z.object({
      salesEmail: z.string().email(),
      supportEmail: z.string().email(),
      privacyEmail: z.string().email(),
    }),
    legal: z.object({
      privacyPolicyPath: z.string().startsWith("/"),
      termsPath: z.string().startsWith("/"),
      dpaPath: z.string().startsWith("/"),
      companyLegalName: z.string().min(1),
    }),
  })
  .superRefine((rules, ctx) => {
    // No overlapping package role bands.
    const pkgs = [...rules.packages].sort((a, b) => a.minRoles - b.minRoles);
    for (let i = 1; i < pkgs.length; i += 1) {
      const prev = pkgs[i - 1];
      const cur = pkgs[i];
      const prevMax = prev.maxRoles ?? Number.POSITIVE_INFINITY;
      if (cur.minRoles <= prevMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Package role ranges overlap: "${prev.id}" and "${cur.id}".`,
        });
      }
    }
    // No overlapping subscription volume bands.
    const subs = [...rules.subscriptions].sort((a, b) => a.minRolesPerMonth - b.minRolesPerMonth);
    for (let i = 1; i < subs.length; i += 1) {
      const prev = subs[i - 1];
      const cur = subs[i];
      const prevMax = prev.maxRolesPerMonth ?? Number.POSITIVE_INFINITY;
      if (cur.minRolesPerMonth <= prevMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Subscription tier ranges overlap: "${prev.id}" and "${cur.id}".`,
        });
      }
    }
    // Every CTA key must be defined.
    for (const key of CTA_KEYS) {
      if (!rules.ctas[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing CTA destination for "${key}".`,
        });
      }
    }
  });

/** Validate a candidate rules object. Throws if invalid. */
export function validateBusinessRules(rules: unknown): BusinessRules {
  return businessRulesSchema.parse(rules) as unknown as BusinessRules;
}

// Guard: validate defaults at import time so a bad edit here fails fast.
validateBusinessRules(BUSINESS_RULES_DEFAULTS);

// ---------------------------------------------------------------------------
// Merge helper — used by the server function that resolves overrides.
// ---------------------------------------------------------------------------

/**
 * Applies a partial override object over defaults using shallow-per-section merge.
 * Sections we treat as arrays (packages, subscriptions, scoring.dimensions,
 * scoring.bands) are replaced wholesale when present in the override.
 */
export function mergeBusinessRules(
  overrides: Partial<Record<keyof BusinessRules, unknown>>,
): BusinessRules {
  const defaults = BUSINESS_RULES_DEFAULTS as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined || value === null) continue;
    const defaultValue = defaults[key];
    if (Array.isArray(value) || Array.isArray(defaultValue)) {
      merged[key] = value;
    } else if (typeof value === "object" && typeof defaultValue === "object") {
      merged[key] = { ...(defaultValue as object), ...(value as object) };
    } else {
      merged[key] = value;
    }
  }
  return validateBusinessRules(merged);
}

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export function getCta(rules: BusinessRules, key: CtaKey): Cta {
  return rules.ctas[key];
}

export function scoreBandFor(rules: BusinessRules, score: number): ScoreBand {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    rules.scoring.bands.find((b) => clamped >= b.min && clamped <= b.max) ??
    rules.scoring.bands[rules.scoring.bands.length - 1]
  );
}
