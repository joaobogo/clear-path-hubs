/**
 * Attio orchestration + durable queue. Server-only.
 *
 * Never logs the credential, and logs only non-identifying context
 * (submission id, form id, status).
 */
import {
  AttioError,
  addToList,
  assertCompany,
  assertPerson,
  createDeal,
  createNote,
  findOpenDealForPerson,
  listDealStages,
  listObjectAttributeSlugs,
  resolveDealOwnerEmail,
  listWorkspaceLists,
  updateDeal,
} from "./attio-client.server";
import {
  CRM_FORMS,
  CRM_PRODUCTION_DOMAIN,
  CRM_SOURCE_BRAND,
  CRM_SOURCE_WEBSITE,
  DEAL_FORM_TYPES,
  type CrmFormId,
  type CrossSellStatus,
  type LeadType,
  type ServiceInterest,
} from "./attio-config";

export type CrmSubmission = {
  submission_id: string;
  source_form_id: CrmFormId;
  submitted_at: string;
  source_page_url: string | null;
  source_page_title: string | null;
  landing_page: string | null;
  original_referrer: string | null;
  latest_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  linkedin: string | null;
  company_name: string | null;
  company_domain: string | null;
  answers: Record<string, string>;
  consent_status: string | null;
  consent_at: string | null;
  environment: "production" | "preview";
  /* --- FGV ecosystem attribution ------------------------------------- */
  conversion_page: string | null;
  first_touch_source: string | null;
  first_touch_medium: string | null;
  first_touch_campaign: string | null;
  last_touch_source: string | null;
  last_touch_medium: string | null;
  last_touch_campaign: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  msclkid: string | null;
  linkedin_click_id: string | null;
  fgv_journey_id: string | null;
  fgv_entry_brand: string | null;
  fgv_referrer: string | null;
  first_landing_timestamp: string | null;
  last_activity_timestamp: string | null;
  service_interest: ServiceInterest;
  secondary_service_interest: ServiceInterest | null;
  destination_brand: string;
  lead_type: LeadType | null;
  cross_sell_status: CrossSellStatus | null;
  is_test: boolean;
};

export type SyncIds = {
  personId: string | null;
  companyId: string | null;
  dealId: string | null;
  noteId: string | null;
};

/** Strip HTML/script and clamp length. */
export function sanitizeText(value: unknown, max = 2000): string {
  return (
    String(value ?? "")
      .replace(/<[^>]*>/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max)
  );
}

const SENSITIVE_KEY = /pass(word)?|token|secret|card|cvv|iban|ssn|api[_-]?key/i;

export function sanitizeAnswers(answers: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers ?? {})) {
    if (SENSITIVE_KEY.test(key)) continue;
    const clean = sanitizeText(value, 1000);
    if (clean) out[sanitizeText(key, 80)] = clean;
  }
  return out;
}

/**
 * Free / consumer mailbox providers: their domain is never a company domain,
 * so we must not create an Attio Company for "gmail.com".
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "qq.com",
  "163.com",
]);

export function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(cleaned)) return null;
  return FREE_EMAIL_DOMAINS.has(cleaned) ? null : cleaned;
}

/**
 * Company domain resolution: an explicit company website wins; otherwise fall
 * back to the work-email domain. Never guessed from a company *name*.
 */
export function resolveCompanyDomain(
  explicit: string | null | undefined,
  email: string,
): string | null {
  return normalizeDomain(explicit) ?? normalizeDomain(email.split("@")[1] ?? null);
}

function attributionValues(s: CrmSubmission) {
  const form = CRM_FORMS[s.source_form_id];
  return {
    lead_source: "Website",
    source_brand: CRM_SOURCE_BRAND,
    source_website: CRM_SOURCE_WEBSITE,
    source_form: form.name,
    source_form_id: form.id,
    form_type: form.type,
    source_environment: s.environment,
    source_page_url: s.source_page_url ?? undefined,
    landing_page: s.landing_page ?? undefined,
    original_referrer: s.original_referrer ?? undefined,
    utm_source: s.utm_source ?? undefined,
    utm_medium: s.utm_medium ?? undefined,
    utm_campaign: s.utm_campaign ?? undefined,
    utm_content: s.utm_content ?? undefined,
    utm_term: s.utm_term ?? undefined,
    submission_id: s.submission_id,
    submitted_at: s.submitted_at,
    latest_form_submission_at: s.submitted_at,
    source_domain: CRM_PRODUCTION_DOMAIN,
    conversion_page: s.conversion_page ?? undefined,
    first_touch_source: s.first_touch_source ?? undefined,
    first_touch_medium: s.first_touch_medium ?? undefined,
    first_touch_campaign: s.first_touch_campaign ?? undefined,
    last_touch_source: s.last_touch_source ?? undefined,
    last_touch_medium: s.last_touch_medium ?? undefined,
    last_touch_campaign: s.last_touch_campaign ?? undefined,
    gclid: s.gclid ?? undefined,
    gbraid: s.gbraid ?? undefined,
    wbraid: s.wbraid ?? undefined,
    msclkid: s.msclkid ?? undefined,
    linkedin_click_or_campaign_identifier: s.linkedin_click_id ?? undefined,
    fgv_journey_id: s.fgv_journey_id ?? undefined,
    fgv_entry_brand: s.fgv_entry_brand ?? undefined,
    fgv_referrer: s.fgv_referrer ?? undefined,
    first_landing_timestamp: s.first_landing_timestamp ?? undefined,
    last_activity_timestamp: s.last_activity_timestamp ?? undefined,
    primary_service_interest: s.service_interest,
    secondary_service_interest: s.secondary_service_interest ?? undefined,
    lead_type: s.lead_type ?? undefined,
    cross_sell_status: s.cross_sell_status ?? undefined,
    is_test: s.is_test ? true : undefined,
  };
}

const prune = (v: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null));

/**
 * Write values, falling back to core-only values when the workspace does not
 * have the optional source attributes configured (Attio replies 400).
 */
async function writeWithFallback(
  object: "people" | "companies" | "deals",
  write: (values: Record<string, unknown>) => Promise<string>,
  core: Record<string, unknown>,
  extra: Record<string, unknown>,
): Promise<string> {
  // Only send attribution attributes this workspace actually has. Without the
  // filter a single unconfigured custom attribute 400s the write and the
  // fallback below would discard *all* attribution, not just the missing one.
  const known = await listObjectAttributeSlugs(object);
  const supported = known
    ? Object.fromEntries(Object.entries(extra).filter(([k]) => known.has(k)))
    : extra;
  try {
    return await write(prune({ ...core, ...supported }));
  } catch (e) {
    if (e instanceof AttioError && e.status === 400) {
      return await write(prune(core));
    }
    throw e;
  }
}

function buildNote(s: CrmSubmission) {
  const form = CRM_FORMS[s.source_form_id];
  const lines = [
    `Contact: ${s.full_name ?? "—"} <${s.email}>`,
    s.job_title ? `Job title: ${s.job_title}` : null,
    s.phone ? `Phone: ${s.phone}` : null,
    s.linkedin ? `LinkedIn: ${s.linkedin}` : null,
    s.company_name || s.company_domain
      ? `Company: ${s.company_name ?? "—"}${s.company_domain ? ` (${s.company_domain})` : ""}`
      : null,
    "",
    `Source website: ${CRM_SOURCE_WEBSITE} (${CRM_PRODUCTION_DOMAIN})`,
    `Form: ${form.name} [${form.id}] · type: ${form.type}`,
    `Page: ${s.source_page_url ?? "—"}${s.source_page_title ? ` — ${s.source_page_title}` : ""}`,
    `Landing page: ${s.landing_page ?? "—"}`,
    `Original referrer: ${s.original_referrer ?? "—"}`,
    `Latest referrer: ${s.latest_referrer ?? "—"}`,
    `UTM: source=${s.utm_source ?? "—"} medium=${s.utm_medium ?? "—"} campaign=${s.utm_campaign ?? "—"} content=${s.utm_content ?? "—"} term=${s.utm_term ?? "—"}`,
    `Environment: ${s.environment}${s.is_test ? " (TEST)" : ""}`,
    `Service interest: ${s.service_interest}${s.secondary_service_interest ? ` (secondary: ${s.secondary_service_interest})` : ""}`,
    `Routed to: ${s.destination_brand}${s.cross_sell_status && s.cross_sell_status !== "None" ? ` — ${s.cross_sell_status}` : ""}`,
    `First touch: source=${s.first_touch_source ?? "—"} medium=${s.first_touch_medium ?? "—"} campaign=${s.first_touch_campaign ?? "—"}`,
    `Last touch: source=${s.last_touch_source ?? "—"} medium=${s.last_touch_medium ?? "—"} campaign=${s.last_touch_campaign ?? "—"}`,
    `Conversion page: ${s.conversion_page ?? "—"}`,
    `FGV journey: ${s.fgv_journey_id ?? "—"} · entry brand: ${s.fgv_entry_brand ?? "—"} · cross-brand referrer: ${s.fgv_referrer ?? "—"}`,
    "",
    "Form answers:",
    ...Object.entries(s.answers).map(([k, v]) => `- ${k}: ${v}`),
    "",
    `Consent: ${s.consent_status ?? "not captured"}${s.consent_at ? ` at ${s.consent_at}` : ""}`,
    `Submission ID: ${s.submission_id}`,
    `Submitted at: ${s.submitted_at}`,
  ].filter(Boolean);

  const date = new Date(s.submitted_at).toISOString().slice(0, 10);
  return {
    title: `Website submission | ${CRM_SOURCE_BRAND} | ${form.name} | ${date}`,
    content: lines.join("\n"),
  };
}

function pickListId(lists: { id: string; name: string; api_slug: string }[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const hit = lists.find((l) => pattern.test(l.name) || pattern.test(l.api_slug));
    if (hit) return hit.id;
  }
  return null;
}

/**
 * Attio's `name` attribute on People is a structured personal-name value and
 * requires first_name, last_name AND full_name — sending full_name alone is
 * rejected with a 400 validation_type error.
 */
export function personNameValue(fullName: string | null) {
  const cleaned = (fullName ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  const parts = cleaned.split(" ");
  const first = parts[0];
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return [{ first_name: first, last_name: last, full_name: cleaned }];
}

/** Push one validated submission into Attio. Throws on failure. */
export async function syncSubmissionToAttio(s: CrmSubmission): Promise<SyncIds> {
  const form = CRM_FORMS[s.source_form_id];
  const attribution = attributionValues(s);

  const personId = await writeWithFallback(
    "people",
    assertPerson,
    {
      email_addresses: [s.email],
      name: personNameValue(s.full_name),
      phone_numbers: s.phone ? [s.phone] : undefined,
      job_title: s.job_title ?? undefined,
      linkedin: s.linkedin ?? undefined,
    },
    attribution,
  );

  let companyId: string | null = null;
  if (s.company_domain) {
    companyId = await writeWithFallback(
      "companies",
      assertCompany,
      { domains: [s.company_domain], name: s.company_name ?? undefined },
      attribution,
    );
    // Link person → company (ignored when the workspace renamed the attribute).
    try {
      await assertPerson({ email_addresses: [s.email], company: companyId });
    } catch {
      /* non-critical */
    }
  }

  const lists = await listWorkspaceLists();

  let dealId: string | null = null;
  if (DEAL_FORM_TYPES.includes(form.type)) {
    const [stages, ownerEmail] = await Promise.all([listDealStages(), resolveDealOwnerEmail()]);
    const stage = stages.find((x) => /new lead|new inbound|inbound|lead|new/i.test(x.title));
    const displayName = s.company_name || s.full_name || s.email;
    // Reuse an existing open Deal for this Person before creating a new one.
    const existingDealId = await findOpenDealForPerson(personId);
    try {
      if (existingDealId) {
        dealId = await writeWithFallback(
          "deals",
          (values) => updateDeal(existingDealId, values),
          { associated_company: companyId ?? undefined },
          attribution,
        );
      } else {
        dealId = await writeWithFallback(
          "deals",
          createDeal,
          {
            name: `${CRM_SOURCE_BRAND} | ${form.name} | ${displayName}`,
            stage: stage ? stage.title : undefined,
            owner: ownerEmail ?? undefined,
            associated_people: [personId],
            associated_company: companyId ?? undefined,
          },
          attribution,
        );
      }
    } catch (e) {
      if (!(e instanceof AttioError) || e.status !== 400) throw e;
      dealId = existingDealId; // workspace has no writable deals object
    }
  }

  // List routing — reuse existing lists only.
  const routes: { listId: string | null; object: "people" | "deals"; id: string | null }[] = [];
  if (form.type === "newsletter") {
    routes.push({
      listId: pickListId(lists, [/newsletter/i, /marketing/i, /subscrib/i]),
      object: "people",
      id: personId,
    });
  } else if (form.type === "partnership") {
    routes.push({
      listId: pickListId(lists, [/partner/i]),
      object: "people",
      id: personId,
    });
  } else {
    routes.push({
      listId: pickListId(lists, [/inbound/i, /website/i, /lead/i]),
      object: "people",
      id: personId,
    });
  }
  for (const route of routes) {
    if (!route.listId || !route.id) continue;
    try {
      await addToList(route.listId, route.object, route.id);
    } catch {
      /* already an entry, or list not writable — non-critical */
    }
  }

  const note = buildNote(s);
  // The note always lands on the Person record: it is the one record that
  // always exists, and it keeps the contact timeline complete.
  const noteId = await createNote({
    parentObject: "people",
    parentRecordId: personId,
    title: note.title,
    content: note.content,
  });

  return { personId, companyId, dealId, noteId };
}
