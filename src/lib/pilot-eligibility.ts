/**
 * Pilot eligibility — canonical rules.
 *
 * The introductory pilot runs ONCE per company. Not once per account, not once
 * per email address: a company that has already had a pilot cannot get a second
 * one by signing up again with a new address or a new workspace.
 *
 * The only exception is a genuinely separate hiring entity under the same
 * brand — a second location, a franchise, a subsidiary — and that exception is
 * granted by TaaSFlow staff, never claimed by the person filling in the form.
 */

/** Public, verbatim statement of the rule. Used on client-facing surfaces. */
export const PILOT_ONE_PER_COMPANY =
  "One pilot per company, for one position. Separate locations, franchises and subsidiaries can be reviewed for their own pilot — ask us first.";

/** Short version for checkboxes and fine print. */
export const PILOT_ONE_PER_COMPANY_SHORT = "One pilot per company, once, for one position.";

export type PilotExceptionKind = "multi_location" | "franchise" | "subsidiary" | "other";

export const PILOT_EXCEPTION_KINDS: { value: PilotExceptionKind; label: string }[] = [
  { value: "multi_location", label: "Separate location" },
  { value: "franchise", label: "Franchise" },
  { value: "subsidiary", label: "Subsidiary or separate legal entity" },
  { value: "other", label: "Other (explain)" },
];

export function exceptionKindLabel(kind: string | null | undefined): string {
  return PILOT_EXCEPTION_KINDS.find((k) => k.value === kind)?.label ?? "Exception";
}

/** Why a pilot was refused. Every value maps to one plain-English line. */
export type PilotBlockReason =
  | "pilot_already_used"
  | "same_company_domain"
  | "same_company_name"
  | "same_contact_domain";

export function blockReasonLine(reason: PilotBlockReason | string | null): string {
  switch (reason) {
    case "pilot_already_used":
      return "This workspace has already used its pilot.";
    case "same_company_domain":
      return "Another workspace with the same company website already used the pilot.";
    case "same_company_name":
      return "Another workspace with the same company name already used the pilot.";
    case "same_contact_domain":
      return "Another workspace using the same work-email domain already used the pilot.";
    default:
      return "The pilot has already been used for this company.";
  }
}

/** What the client is told when they are not eligible for a second pilot. */
export const PILOT_INELIGIBLE_CLIENT_MESSAGE =
  "Your role is set up and your workspace is ready. The introductory pilot has already been used for your company, so this role runs on a plan. If this is a separate location, franchise or subsidiary, tell us and we will review it for its own pilot.";

// ── Company fingerprints ───────────────────────────────────────────────────
// Matching is deliberately conservative: a hit must be something a person
// cannot change casually. Free-mail domains never count as a company domain.

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
  "live.com",
  "me.com",
  "msn.com",
  "gmx.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
]);

export function isFreeEmailDomain(domain: string | null | undefined): boolean {
  return Boolean(domain && FREE_EMAIL_DOMAINS.has(domain.toLowerCase()));
}

/** Legal-suffix noise removed so "Acme Ltd." and "ACME" are one company. */
const COMPANY_SUFFIXES = [
  "inc",
  "llc",
  "ltd",
  "limited",
  "plc",
  "gmbh",
  "bv",
  "nv",
  "sa",
  "sas",
  "srl",
  "spa",
  "ab",
  "as",
  "oy",
  "pty",
  "corp",
  "corporation",
  "company",
  "co",
  "holdings",
  "group",
  "sarl",
  "ug",
  "kg",
  "ag",
];

export function normalizeCompanyName(name: string | null | undefined): string {
  const base = (name ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!base) return "";
  const words = base.split(" ").filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.includes(words[words.length - 1]!)) words.pop();
  return words.join(" ");
}

/** Registrable host from a website or a bare domain. Never a free-mail host. */
export function normalizeDomain(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;
  let host = raw;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    host = raw.replace(/^https?:\/\//, "").split("/")[0] ?? raw;
  }
  host = host.replace(/^www\./, "").trim();
  if (!host.includes(".") || /\s/.test(host)) return null;
  if (isFreeEmailDomain(host)) return null;
  return host;
}

export function emailDomainOf(email: string | null | undefined): string | null {
  const at = (email ?? "").lastIndexOf("@");
  if (at === -1) return null;
  const domain = email!.slice(at + 1).trim().toLowerCase();
  return domain.includes(".") ? domain : null;
}

export type PilotFingerprint = {
  companyName: string;
  companyNameNormalized: string;
  /** Company website host, when it is a real corporate host. */
  companyDomain: string | null;
  /** Work-email domain, corporate only — free-mail is ignored for matching. */
  emailDomain: string | null;
  contactEmail: string | null;
};

export function pilotFingerprint(input: {
  companyName: string;
  companyWebsite?: string | null;
  workEmail?: string | null;
}): PilotFingerprint {
  const rawEmailDomain = emailDomainOf(input.workEmail);
  return {
    companyName: input.companyName.trim(),
    companyNameNormalized: normalizeCompanyName(input.companyName),
    companyDomain: normalizeDomain(input.companyWebsite) ?? normalizeDomain(rawEmailDomain),
    emailDomain: isFreeEmailDomain(rawEmailDomain) ? null : rawEmailDomain,
    contactEmail: (input.workEmail ?? "").trim().toLowerCase() || null,
  };
}

export type PilotEligibility =
  | { eligible: true; reason: null; matchedClaimId: null }
  | { eligible: false; reason: PilotBlockReason; matchedClaimId: string | null };
