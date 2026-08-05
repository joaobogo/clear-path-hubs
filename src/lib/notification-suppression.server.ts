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
