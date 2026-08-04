/**
 * Booking intake contract. Shared by the browser form and the server handler,
 * so validation cannot drift between the two.
 */
import { z } from "zod";

import {
  COMPANY_SIZES,
  CURRENT_PROCESSES,
  HEARD_ABOUT,
  HIRING_TIMELINES,
  HIRING_VOLUMES,
  OPEN_ROLE_COUNTS,
} from "@/config/booking";

const FREE_EMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  text(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

export const bookingIntakeSchema = z.object({
  firstName: text(80).min(1, "Enter your first name"),
  lastName: text(80).min(1, "Enter your last name"),
  email: text(255)
    .min(1, "Enter your work email")
    .email("Enter a valid email address")
    .transform((v) => v.toLowerCase()),
  phone: optional(40),
  companyName: text(160).min(1, "Enter your company name"),
  companyWebsite: optional(255),
  jobTitle: text(120).min(1, "Enter your job title"),
  companySize: z.enum(COMPANY_SIZES),
  openRoles: z.enum(OPEN_ROLE_COUNTS),
  hiringVolume: z.enum(HIRING_VOLUMES),
  rolesHiring: text(400).min(2, "Tell us which roles or departments"),
  hiringChallenge: text(1000).min(5, "Tell us the biggest problem to solve"),
  currentProcess: z.enum(CURRENT_PROCESSES),
  hiringTimeline: z.enum(HIRING_TIMELINES),
  heardAbout: z.enum(HEARD_ABOUT),
  additionalContext: optional(2000),
  /** Honeypot — must stay empty. */
  website: optional(200),
});

export type BookingIntake = z.infer<typeof bookingIntakeSchema>;
export type BookingIntakeDraft = Partial<Record<keyof BookingIntake, string>>;

export const BOOKING_STEPS = [
  { id: "you", title: "About you", fields: ["firstName", "lastName", "email", "phone", "jobTitle"] },
  {
    id: "company",
    title: "Your company",
    fields: ["companyName", "companyWebsite", "companySize"],
  },
  {
    id: "hiring",
    title: "Your hiring",
    fields: [
      "openRoles",
      "hiringVolume",
      "rolesHiring",
      "hiringTimeline",
      "currentProcess",
      "hiringChallenge",
      "heardAbout",
      "additionalContext",
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  fields: readonly (keyof BookingIntake)[];
}[];

/** Company domain from the website, else the work email when it isn't a free mailbox. */
export function deriveCompanyDomain(input: {
  companyWebsite?: string | null;
  email: string;
}): string | null {
  const site = (input.companyWebsite ?? "").trim();
  if (site) {
    try {
      const url = new URL(site.startsWith("http") ? site : `https://${site}`);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes(".")) return host;
    } catch {
      /* fall through to email */
    }
  }
  const domain = input.email.split("@")[1]?.toLowerCase().trim();
  if (!domain || !domain.includes(".") || FREE_EMAIL.has(domain)) return null;
  return domain;
}

export function isFreeMailbox(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return Boolean(domain && FREE_EMAIL.has(domain));
}

/**
 * Transparent 0–100 qualification score. Every point is traceable to an answer
 * the visitor gave — nothing is inferred or invented.
 */
export function qualificationScore(intake: BookingIntake): number {
  let score = 0;
  if (!isFreeMailbox(intake.email)) score += 20;

  score += { "1": 8, "2–3": 14, "4–9": 20, "10–24": 24, "25+": 26 }[intake.openRoles] ?? 0;

  score +=
    {
      "1–5 hires this year": 6,
      "6–15 hires this year": 12,
      "16–50 hires this year": 18,
      "50+ hires this year": 20,
      "Not sure yet": 4,
    }[intake.hiringVolume] ?? 0;

  score +=
    {
      Immediately: 20,
      "Within 30 days": 17,
      "This quarter": 12,
      "Next quarter": 7,
      "Exploring / no date yet": 2,
    }[intake.hiringTimeline] ?? 0;

  score +=
    {
      "1–10": 4,
      "11–50": 8,
      "51–200": 10,
      "201–500": 12,
      "501–1,000": 12,
      "1,000+": 14,
    }[intake.companySize] ?? 0;

  if (intake.hiringChallenge.length > 60) score += 4;
  return Math.min(100, score);
}

/** Readable Q&A map used for the CRM note and the internal summary. */
export function intakeAnswers(intake: BookingIntake): Record<string, string> {
  return {
    "Job title": intake.jobTitle,
    "Company size": intake.companySize,
    "Company website": intake.companyWebsite ?? "Not provided",
    "Open roles right now": intake.openRoles,
    "Expected hiring volume": intake.hiringVolume,
    "Roles or departments hiring": intake.rolesHiring,
    "Hiring timeline": intake.hiringTimeline,
    "Current recruiting process": intake.currentProcess,
    "Most urgent hiring challenge": intake.hiringChallenge,
    "How they heard about TaaSFlow": intake.heardAbout,
    ...(intake.additionalContext ? { "Additional context": intake.additionalContext } : {}),
  };
}
