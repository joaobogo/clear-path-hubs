/**
 * Availability requirements (v1.8.0).
 *
 * "Disponibilidade para se mudar para a Polônia", "Disponibilidade para
 * turnos de 12 horas, de dia e de noite", "Willing to relocate", "Able to
 * work night shifts": these ask what the candidate will do, not what they
 * have done. A CV cannot show it, so the keyword search found nothing and
 * the candidate's own "yes" counted as partial at most. On the Respekt
 * warehouse roles (17 Nov 2026), where every must-have is of this kind, a
 * candidate who said yes to everything could not pass about 60.
 *
 * For these rows the candidate's answer to the question asked for them is
 * the evidence: yes is met, no is not met, and a row nobody asked about is
 * unknown (confirm at screening), never missing for want of a CV line.
 * Requirements about experience ("Experiência em armazém", "3 years of…")
 * are not availability, whatever else they say.
 */

const AVAILABILITY = new RegExp(
  [
    // English
    String.raw`\bwilling(?:ness)?\s+to\b`,
    String.raw`\b(?:available|availability)\s+(?:to|for)\b`,
    String.raw`\bopen\s+to\s+(?:relocat\w*|work\w*|travel\w*|night|weekend|shift)`,
    String.raw`\b(?:prepared|happy|ready)\s+to\s+(?:relocate|work|travel|start|commute)\b`,
    String.raw`\b(?:able|ability)\s+to\s+(?:relocate|start|commute|travel|work\s+(?:night|weekend|rotating|shift|split|overtime|\d))`,
    String.raw`\bcan\s+(?:relocate|start|commute|work\s+(?:night|weekend|rotating|shift|\d))`,
    // Portuguese
    String.raw`\bdisponibilidade\s+(?:para|de|em)\b`,
    String.raw`\bdisposi[cç][aã]o\s+(?:para|de|em)\b`,
    String.raw`\bdispon[ií]vel\s+(?:para|a)\b`,
    String.raw`\bdispost[oa]s?\s+a\b`,
    String.raw`\baceit(?:a|ar|e)\s+(?:trabalhar|mudar|se\s+mudar|viajar|turnos?)\b`,
    // Spanish
    String.raw`\bdisponibilidad\s+(?:para|de)\b`,
    String.raw`\bdisposici[oó]n\s+(?:para|a)\b`,
    String.raw`\bdispuest[oa]s?\s+a\b`,
  ].join("|"),
  "i",
);

/** A requirement about what the candidate has done is not availability. */
const EXPERIENCE =
  /\b(?:experience[ds]?|experi[eê]ncia|experiencia|track\s+record|proven|background|years?|anos?|años?)\b/i;

export function isAvailabilityRequirement(text: string): boolean {
  const t = text.trim();
  if (!t || EXPERIENCE.test(t)) return false;
  return AVAILABILITY.test(t);
}
