/**
 * US states, for requirements that name an office ("Woodbridge, New Jersey")
 * and for the candidate's home ("Scotch Plains, NJ"). Data, not inference.
 */
export type UsState = { code: string; name: string };

const STATES: Array<[string, string]> = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["DC", "District of Columbia"],
];

const BY_NAME = new RegExp(
  `\\b(${STATES.map(([, n]) => n.replace(/\s+/g, "\\s+"))
    .sort((a, b) => b.length - a.length)
    .join("|")})\\b`,
  "gi",
);
/** "Scotch Plains, NJ", "NJ 07080", "Newark, NJ, USA": a code after a comma or before a ZIP. */
const BY_CODE = new RegExp(
  `,\\s*(${STATES.map(([c]) => c).join("|")})\\b(?!\\.[a-z])|\\b(${STATES.map(([c]) => c).join("|")})\\s+\\d{5}\\b`,
  "g",
);
const NAME_TO_CODE = new Map(STATES.map(([c, n]) => [n.toLowerCase(), c]));
const CODE_TO_NAME = new Map(STATES);

/** States named in full in a text, in order ("Woodbridge, New Jersey office"). */
export function usStatesIn(text: string): UsState[] {
  const out: UsState[] = [];
  for (const m of text.matchAll(BY_NAME)) {
    const name = m[1]!.replace(/\s+/g, " ").toLowerCase();
    const code = NAME_TO_CODE.get(name);
    if (code && !out.some((s) => s.code === code))
      out.push({ code, name: CODE_TO_NAME.get(code)! });
  }
  return out;
}

/**
 * The state a location line puts the person in: a full name, or a two-letter
 * code written the way addresses write it. "IN", "OR" and "ME" as ordinary
 * words never count: the code must follow a comma or precede a ZIP.
 */
export function homeStateOf(text: string | null | undefined): UsState | null {
  if (!text) return null;
  for (const m of text.matchAll(BY_CODE)) {
    const code = (m[1] ?? m[2])!;
    return { code, name: CODE_TO_NAME.get(code)! };
  }
  return usStatesIn(text)[0] ?? null;
}
