/**
 * Shared frontend adapter — the ONLY way the browser talks to the CRM.
 * It posts sanitized form context to the server; the Attio credential never
 * leaves the server.
 */
import { CRM_FORMS, type CrmFormId } from "./attio-config";
import { getAttribution, getPageContext } from "./attribution";

export type CrmSubmitInput = {
  formId: CrmFormId;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  linkedin?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  /** Free-form question/answer pairs stored as an Attio note. */
  answers?: Record<string, unknown>;
  consentStatus?: string | null;
  /** Honeypot field value — must be empty for real humans. */
  honeypot?: string | null;
};

export type CrmSubmitResult =
  | { ok: true; queued: boolean; submissionId: string }
  | { ok: false; error: string; submissionId: string };

/**
 * Fire-and-report CRM capture. Never throws — callers keep their own
 * primary persistence as the source of truth.
 */
export async function submitToCrm(input: CrmSubmitInput): Promise<CrmSubmitResult> {
  const submissionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const form = CRM_FORMS[input.formId];
  const payload = {
    submission_id: submissionId,
    source_form_id: form.id,
    submitted_at: new Date().toISOString(),
    ...getPageContext(),
    ...getAttribution(),
    email: input.email,
    full_name: input.fullName ?? null,
    phone: input.phone ?? null,
    job_title: input.jobTitle ?? null,
    linkedin: input.linkedin ?? null,
    company_name: input.companyName ?? null,
    company_domain: input.companyDomain ?? null,
    answers: input.answers ?? {},
    consent_status: input.consentStatus ?? null,
    consent_at: input.consentStatus ? new Date().toISOString() : null,
    website: input.honeypot ?? "",
  };

  try {
    const res = await fetch("/api/public/submit-to-attio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Survives the navigation that often follows a successful submit
      // (e.g. intake -> confirmation), so the lead is never dropped in flight.
      keepalive: true,
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      queued?: boolean;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error ?? "crm_unavailable", submissionId };
    }
    return { ok: true, queued: Boolean(json.queued), submissionId };
  } catch {
    return { ok: false, error: "network_error", submissionId };
  }
}
