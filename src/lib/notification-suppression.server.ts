/**
 * Recipient suppression for notification email. SERVER ONLY.
 *
 * A suppressed address is blocked at send time by every path that sends
 * notification or lead-alert email. Suppression is the source of truth for
 * "do not contact this address again" and is never bypassed by a retry.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const TABLE = "notification_suppressions";

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** Active suppressed addresses out of the given list (lowercased). */
export async function suppressedAmong(admin: Admin, emails: string[]): Promise<Set<string>> {
  const wanted = [...new Set(emails.map(normalize).filter(Boolean))];
  if (wanted.length === 0) return new Set();
  const { data } = await admin
    .from(TABLE)
    .select("email")
    .is("released_at", null)
    .in("email", wanted);
  return new Set(((data ?? []) as Array<{ email: string }>).map((r) => normalize(r.email)));
}

export async function isSuppressed(admin: Admin, email: string | null | undefined) {
  if (!email) return false;
  const set = await suppressedAmong(admin, [email]);
  return set.has(normalize(email));
}

export async function suppressRecipient(
  admin: Admin,
  args: { email: string; reason: string; source?: string; actorUserId: string },
) {
  const email = normalize(args.email);
  const existing = await suppressedAmong(admin, [email]);
  if (existing.has(email)) return { ok: true, alreadySuppressed: true as const };
  const { error } = await admin.from(TABLE).insert({
    email,
    reason: args.reason,
    source: args.source ?? "manual",
    created_by: args.actorUserId,
  });
  if (error) throw new Error(error.message);
  return { ok: true, alreadySuppressed: false as const };
}

export async function releaseRecipient(
  admin: Admin,
  args: { email: string; actorUserId: string },
) {
  const email = normalize(args.email);
  const { error } = await admin
    .from(TABLE)
    .update({ released_at: new Date().toISOString(), released_by: args.actorUserId })
    .eq("email", email)
    .is("released_at", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export type UnsuppressResult = {
  email: string;
  /** Our own list. */
  local: "lifted" | "not_listed";
  /** The email provider's global list. */
  provider:
    | { state: "lifted"; detail: string }
    | { state: "not_blocked"; detail: string }
    | { state: "not_liftable"; detail: string }
    | { state: "unknown"; detail: string };
};

/**
 * The ONE unsuppress path. Both the admin delivery-failure action and the
 * recipient-facing "Email blocked" banner action go through here so the rules
 * can never diverge.
 *
 * Two lists exist and both must be cleared for email to flow again:
 *  * ours (`notification_suppressions`) — always liftable by staff.
 *  * the provider's global list — an unsubscribe is liftable; a hard bounce or
 *    spam complaint is enforced provider-side and cannot be lifted from app
 *    code. We report that plainly instead of pretending it worked.
 */
export async function unsuppressRecipient(
  admin: Admin,
  args: { email: string; actorUserId: string },
): Promise<UnsuppressResult> {
  const email = normalize(args.email);
  const listed = (await suppressedAmong(admin, [email])).has(email);
  if (listed) await releaseRecipient(admin, { email, actorUserId: args.actorUserId });

  const apiKey = process.env.LOVABLE_API_KEY;
  const domain =
    process.env.SENDER_DOMAIN ?? process.env.LOVABLE_EMAIL_DOMAIN ?? "notify.taasflow.com";

  let provider: UnsuppressResult["provider"] = {
    state: "unknown",
    detail: "The provider list could not be checked, so email may still be blocked.",
  };

  if (!apiKey) {
    provider = {
      state: "unknown",
      detail: "Email sending is not configured, so the provider list could not be checked.",
    };
  } else {
    try {
      const { EmailAPIError, getEmailUnsubscribe, setEmailUnsubscribe } = await import(
        "@lovable.dev/email-js"
      );
      const current = await getEmailUnsubscribe({ recipient: email, domain }, { apiKey });
      if (current.subscribed) {
        provider = {
          state: "not_blocked",
          detail:
            "The recipient is not unsubscribed at the provider. If sends still fail, the address is on the provider's bounce or complaint list, which only clears on its own.",
        };
      } else {
        await setEmailUnsubscribe({ recipient: email, domain, subscribed: true }, { apiKey });
        provider = {
          state: "lifted",
          detail: "The provider unsubscribe was lifted, so email can be sent again.",
        };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string } | null)?.code ?? null;
      provider =
        e instanceof EmailAPIErrorShape && code === "complaint_not_liftable"
          ? {
              state: "not_liftable",
              detail:
                "This address reported an earlier email as spam. That block is permanent and cannot be lifted.",
            }
          : code === "complaint_not_liftable"
            ? {
                state: "not_liftable",
                detail:
                  "This address reported an earlier email as spam. That block is permanent and cannot be lifted.",
              }
            : {
                state: "unknown",
                detail: `The provider list could not be updated: ${message.slice(0, 200)}`,
              };
    }
  }

  return { email, local: listed ? "lifted" : "not_listed", provider };
}

// Keeps the instanceof branch above readable without importing the SDK at
// module scope (it must stay server-side and lazily loaded).
class EmailAPIErrorShape extends Error {}

export async function listSuppressions(admin: Admin, limit = 100) {
  const { data } = await admin
    .from(TABLE)
    .select("id, email, reason, source, created_at")
    .is("released_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Array<{
    id: string;
    email: string;
    reason: string | null;
    source: string;
    created_at: string;
  }>;
}
