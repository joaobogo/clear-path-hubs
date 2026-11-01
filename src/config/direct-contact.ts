/**
 * Direct contact — the people a client, candidate or partner can reach.
 *
 * The owner asked (1 Nov 2026) that the website give an easy, direct way to
 * reach the founders, because the shared inboxes behind the site's forms and
 * generic addresses were not reliably monitored. Every public surface that
 * names an address or a "talk to us" route reads from here, so changing who
 * answers is a one-line edit.
 *
 * Client-safe: no server imports. Profiles are the owner-confirmed URLs.
 */

/** The one monitored inbox for clients, candidates and internal lead alerts. */
export const DIRECT_CONTACT_EMAIL = "john.kasprzak@flowgroupventures.com" as const;

export type DirectContact = {
  /** Name as the person signs. */
  name: string;
  /** Short role shown under the name. */
  role: string;
  linkedin: string;
  email?: string;
};

export const DIRECT_CONTACTS: readonly DirectContact[] = [
  {
    name: "John Kasprzak",
    role: "Chief Marketing Officer",
    linkedin: "https://www.linkedin.com/in/joaokasprzak/",
    email: DIRECT_CONTACT_EMAIL,
  },
  {
    name: "Christian Brøgger",
    role: "Chief Executive Officer",
    linkedin: "https://www.linkedin.com/in/christian-brogger/",
  },
] as const;

/** `mailto:` link for the direct inbox, with an optional subject line. */
export function directContactMailto(subject?: string): string {
  return subject
    ? `mailto:${DIRECT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${DIRECT_CONTACT_EMAIL}`;
}
