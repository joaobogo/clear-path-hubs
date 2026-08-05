/**
 * Per-section candidate profile editing.
 *
 * Each section validates and saves on its own, so a failure in one section can
 * never clear or overwrite another. The shapes here are shared by the form and
 * by the server function, so the two cannot drift.
 */

import { z } from "zod";

/* ---------- per-section value schemas ---------- */

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");

const jsonArray = (max: number) => z.array(z.any()).max(max).default([]);

export const contactValues = z.object({
  full_name: z.string().trim().min(1, "Enter your name.").max(200),
  phone: optionalText(50),
});

export const locationValues = z.object({
  location: optionalText(200),
  timezone: optionalText(80),
});

export const workAuthValues = z.object({
  work_authorization_note: optionalText(300),
  availability_note: optionalText(300),
  compensation_note: optionalText(300),
});

export const experienceValues = z.object({
  headline: optionalText(300),
  summary: optionalText(4000),
  years_experience: z.coerce
    .number()
    .int()
    .min(0)
    .max(80)
    .nullable()
    .optional()
    .default(null),
  experience: jsonArray(50),
  education: jsonArray(30),
  languages: jsonArray(30),
  certifications: jsonArray(50),
});

export const skillsValues = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).max(100).default([]),
});

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .default("")
  .refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), {
    message: "Enter a full URL starting with https://",
  });

export const linksValues = z.object({
  linkedin_url: optionalUrl,
  portfolio_url: optionalUrl,
});

/* ---------- the union sent to the server ---------- */

export const profileSectionPatchSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("contact"), values: contactValues }),
  z.object({ section: z.literal("location"), values: locationValues }),
  z.object({ section: z.literal("work_auth"), values: workAuthValues }),
  z.object({ section: z.literal("experience"), values: experienceValues }),
  z.object({ section: z.literal("skills"), values: skillsValues }),
  z.object({ section: z.literal("links"), values: linksValues }),
]);

export type ProfileSectionPatch = z.infer<typeof profileSectionPatchSchema>;
export type ProfileSectionId = ProfileSectionPatch["section"];

/* ---------- section metadata for the UI ---------- */

export type ProfileSectionMeta = {
  id: ProfileSectionId;
  title: string;
  /** Why keeping this current changes a real outcome. */
  hint: string;
  /** DOM ids of the fields inside this section (used for deep links). */
  fieldIds: readonly string[];
};

export const PROFILE_SECTIONS: readonly ProfileSectionMeta[] = [
  {
    id: "contact",
    title: "Contact",
    hint: "How we reach you to confirm interview times.",
    fieldIds: ["p-full-name", "p-phone"],
  },
  {
    id: "location",
    title: "Location and time zone",
    hint: "Roles are filtered by location, and interviews need your time zone.",
    fieldIds: ["p-location", "p-timezone"],
  },
  {
    id: "work_auth",
    title: "Work authorisation and availability",
    hint: "Employers filter on these before they read anything else.",
    fieldIds: ["p-work-auth", "p-availability", "p-comp"],
  },
  {
    id: "experience",
    title: "Experience",
    hint: "Hiring teams shortlist on relevant experience, not on a CV file alone.",
    fieldIds: [
      "p-headline",
      "p-summary",
      "p-years",
      "p-experience",
      "p-education",
      "p-languages",
      "p-certifications",
    ],
  },
  {
    id: "skills",
    title: "Skills",
    hint: "Skills are what we match roles against.",
    fieldIds: ["p-skills"],
  },
  {
    id: "links",
    title: "Links",
    hint: "A profile or portfolio link gives context a CV cannot.",
    fieldIds: ["p-linkedin", "p-portfolio"],
  },
];

/** Which section holds a given field id, for deep links from /me. */
export function sectionForField(fieldId: string): ProfileSectionId | null {
  const hit = PROFILE_SECTIONS.find((s) => s.fieldIds.includes(fieldId));
  return hit ? hit.id : null;
}
