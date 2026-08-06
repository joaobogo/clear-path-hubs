/** Support request categories offered to candidates, in the order shown. */
export const SUPPORT_CATEGORIES = [
  { key: "cv_upload", label: "My CV will not upload" },
  { key: "status_unclear", label: "I do not understand my status" },
  { key: "interview", label: "Something about an interview time" },
  { key: "wrong_details", label: "My details are wrong" },
  { key: "privacy", label: "Privacy, consent or my data" },
  { key: "accommodation", label: "An adjustment I need in the process" },
  { key: "other", label: "Something else" },
] as const;

export type SupportCategoryKey = (typeof SUPPORT_CATEGORIES)[number]["key"];

export const SUPPORT_BODY_MAX = 2000;

export function supportCategoryLabel(key: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.key === key)?.label ?? "Something else";
}

/** What we promise on screen after a support request lands. */
export const SUPPORT_RESPONSE_PROMISE =
  "A person reads every request. We reply by email, and in your messages, within one working day.";
