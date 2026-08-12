/**
 * Multi-role intake: carrying the company profile forward.
 *
 * A client hiring three roles should type their company, contact, location
 * defaults, interview process and compensation philosophy once. This module is
 * the single definition of WHICH answers travel between roles and which ones
 * are role-specific and must start empty.
 *
 * It is pure and reads nothing: the API route and the server function feed it
 * rows, it returns the values to prefill plus the list of fields that were
 * prefilled, so the form can mark them honestly. Nothing here ever writes back
 * to the company profile — a carried value edited on role two is role two's
 * answer and nothing else's.
 */

export const CARRY_NOTICE = "From your company profile — edit if different for this role";

/** Answers that travel from one role to the next. */
export const CARRYABLE_FIELDS = [
  // Company and contact
  "companyName",
  "companyWebsite",
  "companyLinkedin",
  "firstName",
  "lastName",
  "contactTitle",
  "workEmail",
  "phone",
  "contactLinkedin",
  // Location defaults
  "location",
  "workModel",
  "onsiteDays",
  "remoteTimezones",
  "remoteAnywhereInCountry",
  "sponsorshipAvailable",
  "workAuthorization",
  "workAuthorizationNote",
  // Compensation philosophy (never the role's own numbers)
  "currency",
  "compensationPeriod",
  "bonusStructure",
  "equity",
  "compensationFlexible",
  // Interview process and decision makers
  "interviewProcess",
  "interviewStages",
  "targetDaysToOffer",
  "decisionMaker",
  "decisionMakerEmail",
] as const;

export type CarryableField = (typeof CARRYABLE_FIELDS)[number];

/**
 * Deliberately NOT carried: every role answers these for itself. Listed so the
 * rule is reviewable rather than implied by omission.
 */
export const ROLE_SPECIFIC_FIELDS = [
  "roleTitle",
  "team",
  "jobDescriptionText",
  "requirements",
  "dealBreakerList",
  "salaryMin",
  "salaryMax",
  "compensationNote",
  "compensationUndecided",
  "targetStartDate",
] as const;

export type CarrySource = {
  organization: {
    name?: string | null;
    website?: string | null;
    phone?: string | null;
  } | null;
  /** The most recent role for this company, used for the practical defaults. */
  position: {
    location?: string | null;
    work_model?: string | null;
    work_authorization?: unknown;
    compensation?: unknown;
    intake_context?: unknown;
  } | null;
  /** Only supplied on the authenticated path — never from a public endpoint. */
  contact?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

/** Everything carried is plain JSON so it crosses the wire unchanged. */
export type CarryStage = {
  name: string;
  ownerName: string;
  ownerEmail: string;
  format: string;
};

export type CarryValue = string | boolean | string[] | CarryStage[];

export type CarryForward = {
  companyName: string | null;
  /** Values to prefill, keyed by intake form field. */
  values: Partial<Record<CarryableField, CarryValue>>;
  /** The fields actually prefilled, so the form marks exactly those. */
  carried: CarryableField[];
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const EMPTY: CarryForward = { companyName: null, values: {}, carried: [] };

export function buildCarryForward(source: CarrySource | null | undefined): CarryForward {
  if (!source) return EMPTY;
  const values: Partial<Record<CarryableField, CarryValue>> = {};
  const put = (field: CarryableField, value: CarryValue | null | undefined) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (Array.isArray(value) && value.length === 0) return;
    if (value === false) return;
    values[field] = value;
  };

  const org = source.organization ?? {};
  put("companyName", str(org.name));
  put("companyWebsite", str(org.website));

  const contact = source.contact ?? null;
  if (contact) {
    const full = str(contact.fullName);
    if (full) {
      const [first, ...rest] = full.split(/\s+/);
      put("firstName", first);
      put("lastName", rest.join(" "));
    }
    put("workEmail", str(contact.email).toLowerCase());
    put("phone", str(contact.phone) || str(org.phone));
  }

  const pos = source.position ?? {};
  const ctx = obj(pos.intake_context);
  const auth = obj(pos.work_authorization);
  const comp = obj(pos.compensation);

  put("location", str(pos.location));
  const workModel = str(pos.work_model);
  if (workModel === "remote" || workModel === "hybrid" || workModel === "onsite") {
    put("workModel", workModel);
    if (workModel === "hybrid" && ctx["onsite_days"] != null) {
      put("onsiteDays", String(ctx["onsite_days"]));
    }
    if (workModel === "remote") {
      const zones = Array.isArray(ctx["remote_timezones"])
        ? (ctx["remote_timezones"] as unknown[]).filter((z): z is string => typeof z === "string")
        : [];
      put("remoteTimezones", zones);
      put("remoteAnywhereInCountry", ctx["remote_anywhere_in_country"] === true);
    }
  }

  const sponsorship = str(ctx["sponsorship_available"]);
  if (sponsorship === "yes" || sponsorship === "no") put("sponsorshipAvailable", sponsorship);
  else if (typeof auth["sponsorship_available"] === "boolean") {
    put("sponsorshipAvailable", auth["sponsorship_available"] ? "yes" : "no");
  }
  put("workAuthorization", str(auth["rule"]));
  put("workAuthorizationNote", str(auth["note"]));

  // Philosophy travels; the numbers do not. Role two prices itself.
  put("currency", str(comp["currency"]));
  put("compensationPeriod", str(comp["period"]));
  put("bonusStructure", str(comp["bonus"]));
  put("equity", str(comp["equity"]));
  put("compensationFlexible", comp["flexible"] === true);

  const stages = Array.isArray(ctx["interview_stages"])
    ? (ctx["interview_stages"] as unknown[])
        .map((s) => {
          const row = obj(s);
          return {
            name: str(row["name"]),
            ownerName: str(row["ownerName"] ?? row["owner_name"]),
            ownerEmail: str(row["ownerEmail"] ?? row["owner_email"]).toLowerCase(),
            format: str(row["format"]),
          };
        })
        .filter((s) => s.name.length > 0)
    : [];
  put("interviewStages", stages);
  put("interviewProcess", str(ctx["interview_process"]));
  if (ctx["target_days_to_offer"] != null) {
    put("targetDaysToOffer", String(ctx["target_days_to_offer"]));
  }
  put("decisionMaker", str(ctx["decision_maker"]));
  put("decisionMakerEmail", str(ctx["decision_maker_email"]));

  const carried = CARRYABLE_FIELDS.filter((f) => f in values);
  return {
    companyName: typeof values.companyName === "string" ? values.companyName : null,
    values,
    carried,
  };
}
