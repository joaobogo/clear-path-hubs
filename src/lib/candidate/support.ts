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

/**
 * The message a candidate support request becomes in the ops thread.
 *
 * The category and the reference travel in the body *and* in the structured
 * context, so ops can both read it and filter on it without asking the
 * candidate to repeat themselves.
 */
export function buildSupportMessage(input: {
  userId: string;
  category: string;
  body: string;
  reference?: string | null;
}) {
  const ref = input.reference?.trim() ? input.reference.trim() : null;
  const header = `Support request — ${supportCategoryLabel(input.category)}${
    ref ? ` (ref ${ref})` : ""
  }`;
  return {
    // A candidate has no organisation, so their own id is their ops thread.
    thread_id: input.userId,
    sender_user_id: input.userId,
    conversation_id: null,
    body: `${header}\n\n${input.body.trim()}`,
    recipient_context: {
      audience: "taasflow_ops" as const,
      from: "candidate" as const,
      kind: "support_request" as const,
      category: input.category,
      reference: ref,
    },
  };
}
