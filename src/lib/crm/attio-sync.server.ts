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
  listDealStages,
  listWorkspaceLists,
} from "./attio-client.server";
import {
  CRM_FORMS,
  CRM_PRODUCTION_DOMAIN,
  CRM_SOURCE_BRAND,
  CRM_SOURCE_WEBSITE,
  DEAL_FORM_TYPES,
  type CrmFormId,
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
  answers: Record<string, unknown>;
  consent_status: string | null;
  consent_at: string | null;
  environment: "production" | "preview";
};

export type SyncIds = {
  personId: string | null;
  companyId: string | null;
  dealId: string | null;
  noteId: string | null;
};

/** Strip HTML/script and clamp length. */
export function sanitizeText(value: unknown, max = 2000): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
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

function attributionValues(s: CrmSubmission) {
  const form = CRM_FORMS[s.source_form_id];
  return {
    lead_source: "Website",
    source_brand: CRM_SOURCE_BRAND,
    source_website: CRM_SOURCE_WEBSITE,
    source_form: form.name,
    form_type: form.type,
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
  };
}

const prune = (v: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null));

/**
 * Write values, falling back to core-only values when the workspace does not
 * have the optional source attributes configured (Attio replies 400).
 */
async function writeWithFallback(
  write: (values: Record<string, unknown>) => Promise<string>,
  core: Record<string, unknown>,
  extra: Record<string, unknown>,
): Promise<string> {
  try {
    return await write(prune({ ...core, ...extra }));
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
    `Environment: ${s.environment}`,
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

function pickListId(
  lists: { id: string; name: string; api_slug: string }[],
  patterns: RegExp[],
) {
  for (const pattern of patterns) {
    const hit = lists.find((l) => pattern.test(l.name) || pattern.test(l.api_slug));
    if (hit) return hit.id;
  }
  return null;
}

/** Push one validated submission into Attio. Throws on failure. */
export async function syncSubmissionToAttio(s: CrmSubmission): Promise<SyncIds> {
  const form = CRM_FORMS[s.source_form_id];
  const attribution = attributionValues(s);

  const personId = await writeWithFallback(
    assertPerson,
    {
      email_addresses: [s.email],
      name: s.full_name ? [{ full_name: s.full_name }] : undefined,
      phone_numbers: s.phone ? [s.phone] : undefined,
      job_title: s.job_title ?? undefined,
      linkedin: s.linkedin ?? undefined,
    },
    attribution,
  );

  let companyId: string | null = null;
  if (s.company_domain) {
    companyId = await writeWithFallback(
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
    const stages = await listDealStages();
    const stage = stages.find((x) => /new lead|new inbound|inbound|lead|new/i.test(x.title));
    const displayName = s.company_name || s.full_name || s.email;
    try {
      dealId = await writeWithFallback(
        createDeal,
        {
          name: `${CRM_SOURCE_BRAND} | ${form.name} | ${displayName}`,
          stage: stage ? stage.title : undefined,
          associated_people: [personId],
          associated_company: companyId ?? undefined,
        },
        attribution,
      );
    } catch (e) {
      if (!(e instanceof AttioError) || e.status !== 400) throw e;
      dealId = null; // workspace has no deals object configured
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
  const noteId = await createNote({
    parentObject: dealId ? "deals" : "people",
    parentRecordId: dealId ?? personId,
    title: note.title,
    content: note.content,
  });

  return { personId, companyId, dealId, noteId };
}
