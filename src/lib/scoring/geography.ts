/**
 * Places a market-experience requirement can name, and the words a CV uses
 * for them (owner, 29 Oct 2026: "market experience for ANY country").
 *
 * Only places. A country is recognised by its own name, its common
 * abbreviations (UK, USA, UAE, KSA, HK, PRC) and its major business cities.
 * Demonyms, nationalities and languages are deliberately NOT place names:
 * "Korean national", "Japanese citizen" and "speaks Mandarin" never name a
 * market. The one exception is the adjective directly in front of "market"
 * or "markets" ("the Korean market", "the German, French or Benelux
 * markets"), which is a reference to a place-market and nothing else.
 *
 * Abbreviations are matched case-sensitively ("US", never "us"); names that
 * are also ordinary words or first names (Jordan, Georgia, Turkey, Milan) are
 * matched only capitalised and never directly before another capitalised
 * word ("Jordan Smith" is a person).
 */

export type Region =
  | "Asia-Pacific"
  | "Middle East"
  | "Europe"
  | "North America"
  | "Latin America"
  | "Africa";

type CountryDef = {
  name: string;
  region: Region;
  /** Country names, matched case-insensitively. */
  names: string[];
  /** Abbreviations, matched case-sensitively. */
  abbr?: string[];
  /** Names that are also ordinary words or first names: capitalised, never before a capitalised word. */
  ambiguous?: string[];
  /** Major business cities, matched case-insensitively. */
  cities?: string[];
  /** Adjectival forms, recognised ONLY directly before "market(s)". */
  adjectives?: string[];
  /** Raw patterns for names that need a guard ("Korea" but not "North Korea"). */
  raw?: string[];
};

const COUNTRIES: CountryDef[] = [
  // ── Asia-Pacific ─────────────────────────────────────────────────────────
  {
    name: "South Korea",
    region: "Asia-Pacific",
    names: ["South Korea", "Republic of Korea"],
    raw: ["(?<!north[\\s-])korea"],
    cities: ["Seoul", "Busan", "Incheon", "Pangyo"],
    adjectives: ["South Korean", "Korean"],
  },
  {
    name: "Japan",
    region: "Asia-Pacific",
    names: ["Japan"],
    cities: ["Tokyo", "Osaka", "Yokohama", "Kyoto", "Nagoya", "Fukuoka", "Sapporo", "Kobe"],
    adjectives: ["Japanese"],
  },
  { name: "Singapore", region: "Asia-Pacific", names: ["Singapore"], adjectives: ["Singaporean"] },
  {
    name: "Hong Kong",
    region: "Asia-Pacific",
    names: ["Hong Kong", "HK SAR", "HKSAR"],
    abbr: ["HK"],
    cities: ["Kowloon"],
  },
  {
    name: "China",
    region: "Asia-Pacific",
    names: ["China", "Mainland China", "People's Republic of China"],
    abbr: ["PRC"],
    cities: ["Shanghai", "Beijing", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou", "Suzhou", "Wuhan", "Tianjin"],
    adjectives: ["Chinese"],
  },
  {
    name: "Vietnam",
    region: "Asia-Pacific",
    names: ["Vietnam", "Viet Nam"],
    abbr: ["HCMC"],
    cities: ["Hanoi", "Ho Chi Minh City", "Ho Chi Minh", "Saigon", "Da Nang"],
    adjectives: ["Vietnamese"],
  },
  { name: "Taiwan", region: "Asia-Pacific", names: ["Taiwan"], cities: ["Taipei", "Hsinchu"], adjectives: ["Taiwanese"] },
  { name: "Thailand", region: "Asia-Pacific", names: ["Thailand"], cities: ["Bangkok"], adjectives: ["Thai"] },
  { name: "Malaysia", region: "Asia-Pacific", names: ["Malaysia"], cities: ["Kuala Lumpur", "Penang"], adjectives: ["Malaysian"] },
  { name: "Indonesia", region: "Asia-Pacific", names: ["Indonesia"], cities: ["Jakarta", "Surabaya"], adjectives: ["Indonesian"] },
  { name: "Philippines", region: "Asia-Pacific", names: ["Philippines"], cities: ["Manila", "Makati", "Cebu", "Taguig"], adjectives: ["Philippine", "Filipino"] },
  {
    name: "India",
    region: "Asia-Pacific",
    names: ["India"],
    cities: ["Mumbai", "Delhi", "New Delhi", "Bangalore", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Gurgaon", "Gurugram", "Noida", "Ahmedabad"],
    adjectives: ["Indian"],
  },
  { name: "Pakistan", region: "Asia-Pacific", names: ["Pakistan"], cities: ["Karachi", "Lahore", "Islamabad"], adjectives: ["Pakistani"] },
  { name: "Bangladesh", region: "Asia-Pacific", names: ["Bangladesh"], cities: ["Dhaka", "Chittagong"], adjectives: ["Bangladeshi"] },
  { name: "Sri Lanka", region: "Asia-Pacific", names: ["Sri Lanka"], cities: ["Colombo"], adjectives: ["Sri Lankan"] },
  { name: "Nepal", region: "Asia-Pacific", names: ["Nepal"], cities: ["Kathmandu"], adjectives: ["Nepalese", "Nepali"] },
  { name: "Cambodia", region: "Asia-Pacific", names: ["Cambodia"], cities: ["Phnom Penh"], adjectives: ["Cambodian"] },
  { name: "Myanmar", region: "Asia-Pacific", names: ["Myanmar", "Burma"], cities: ["Yangon"] },
  { name: "Macau", region: "Asia-Pacific", names: ["Macau", "Macao"] },
  { name: "Brunei", region: "Asia-Pacific", names: ["Brunei"] },
  {
    name: "Australia",
    region: "Asia-Pacific",
    names: ["Australia"],
    cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"],
    adjectives: ["Australian"],
  },
  { name: "New Zealand", region: "Asia-Pacific", names: ["New Zealand"], abbr: ["NZ"], cities: ["Auckland"] },
  { name: "Kazakhstan", region: "Asia-Pacific", names: ["Kazakhstan"], cities: ["Almaty", "Astana"] },
  { name: "Uzbekistan", region: "Asia-Pacific", names: ["Uzbekistan"], cities: ["Tashkent"] },

  // ── Middle East and North Africa ─────────────────────────────────────────
  {
    name: "United Arab Emirates",
    region: "Middle East",
    names: ["United Arab Emirates"],
    abbr: ["UAE", "U.A.E."],
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Al Ain"],
    adjectives: ["UAE", "Emirati"],
  },
  {
    name: "Saudi Arabia",
    region: "Middle East",
    names: ["Saudi Arabia", "Kingdom of Saudi Arabia"],
    abbr: ["KSA"],
    cities: ["Riyadh", "Jeddah", "Dammam", "Khobar", "Al Khobar", "NEOM"],
    adjectives: ["Saudi"],
  },
  { name: "Qatar", region: "Middle East", names: ["Qatar"], cities: ["Doha"], adjectives: ["Qatari"] },
  { name: "Kuwait", region: "Middle East", names: ["Kuwait"], adjectives: ["Kuwaiti"] },
  { name: "Oman", region: "Middle East", names: ["Oman", "Sultanate of Oman"], cities: ["Muscat"], adjectives: ["Omani"] },
  { name: "Bahrain", region: "Middle East", names: ["Bahrain"], cities: ["Manama"], adjectives: ["Bahraini"] },
  { name: "Egypt", region: "Middle East", names: ["Egypt"], cities: ["Cairo"], adjectives: ["Egyptian"] },
  { name: "Jordan", region: "Middle East", names: [], ambiguous: ["Jordan"], cities: ["Amman"], adjectives: ["Jordanian"] },
  { name: "Lebanon", region: "Middle East", names: ["Lebanon"], cities: ["Beirut"], adjectives: ["Lebanese"] },
  { name: "Israel", region: "Middle East", names: [], ambiguous: ["Israel"], cities: ["Tel Aviv"], adjectives: ["Israeli"] },
  { name: "Turkey", region: "Middle East", names: ["Türkiye", "Turkiye"], ambiguous: ["Turkey"], cities: ["Istanbul", "Ankara", "Izmir"], adjectives: ["Turkish"] },
  { name: "Iraq", region: "Middle East", names: ["Iraq"], cities: ["Baghdad", "Erbil"], adjectives: ["Iraqi"] },
  { name: "Iran", region: "Middle East", names: ["Iran"], cities: ["Tehran"], adjectives: ["Iranian"] },
  { name: "Morocco", region: "Africa", names: ["Morocco"], cities: ["Casablanca", "Rabat", "Marrakech", "Tangier"], adjectives: ["Moroccan"] },
  { name: "Tunisia", region: "Africa", names: ["Tunisia"], cities: ["Tunis"], adjectives: ["Tunisian"] },
  { name: "Algeria", region: "Africa", names: ["Algeria"], cities: ["Algiers"], adjectives: ["Algerian"] },

  // ── Sub-Saharan Africa ───────────────────────────────────────────────────
  { name: "Nigeria", region: "Africa", names: ["Nigeria"], cities: ["Lagos", "Abuja"], adjectives: ["Nigerian"] },
  { name: "Kenya", region: "Africa", names: ["Kenya"], cities: ["Nairobi", "Mombasa"], adjectives: ["Kenyan"] },
  {
    name: "South Africa",
    region: "Africa",
    names: ["South Africa"],
    cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Sandton"],
    adjectives: ["South African"],
  },
  { name: "Ghana", region: "Africa", names: ["Ghana"], cities: ["Accra"], adjectives: ["Ghanaian"] },
  { name: "Ethiopia", region: "Africa", names: ["Ethiopia"], cities: ["Addis Ababa"], adjectives: ["Ethiopian"] },
  { name: "Tanzania", region: "Africa", names: ["Tanzania"], cities: ["Dar es Salaam"], adjectives: ["Tanzanian"] },
  { name: "Uganda", region: "Africa", names: ["Uganda"], cities: ["Kampala"], adjectives: ["Ugandan"] },
  { name: "Rwanda", region: "Africa", names: ["Rwanda"], cities: ["Kigali"], adjectives: ["Rwandan"] },
  { name: "Senegal", region: "Africa", names: ["Senegal"], cities: ["Dakar"], adjectives: ["Senegalese"] },
  { name: "Côte d'Ivoire", region: "Africa", names: ["Côte d'Ivoire", "Cote d'Ivoire", "Ivory Coast"], cities: ["Abidjan"] },
  { name: "Zambia", region: "Africa", names: ["Zambia"], cities: ["Lusaka"], adjectives: ["Zambian"] },
  { name: "Zimbabwe", region: "Africa", names: ["Zimbabwe"], cities: ["Harare"], adjectives: ["Zimbabwean"] },
  { name: "Angola", region: "Africa", names: ["Angola"], cities: ["Luanda"], adjectives: ["Angolan"] },
  { name: "Mozambique", region: "Africa", names: ["Mozambique"], cities: ["Maputo"] },
  { name: "Botswana", region: "Africa", names: ["Botswana"], cities: ["Gaborone"] },
  { name: "Mauritius", region: "Africa", names: ["Mauritius"], cities: ["Port Louis"] },
  { name: "Cameroon", region: "Africa", names: ["Cameroon"], cities: ["Douala", "Yaoundé", "Yaounde"] },

  // ── Europe ───────────────────────────────────────────────────────────────
  {
    name: "United Kingdom",
    region: "Europe",
    names: ["United Kingdom", "Great Britain", "Britain", "England", "Scotland", "Wales", "Northern Ireland"],
    abbr: ["UK", "U.K."],
    cities: ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow", "Leeds", "Bristol", "Belfast", "Liverpool"],
    adjectives: ["UK", "British", "English", "Scottish", "Welsh"],
  },
  { name: "Ireland", region: "Europe", names: ["Ireland", "Republic of Ireland"], cities: ["Dublin"], adjectives: ["Irish"] },
  {
    name: "Germany",
    region: "Europe",
    names: ["Germany"],
    cities: ["Berlin", "Munich", "München", "Frankfurt", "Hamburg", "Düsseldorf", "Dusseldorf", "Cologne", "Köln", "Stuttgart"],
    adjectives: ["German"],
  },
  { name: "France", region: "Europe", names: ["France"], cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Lille", "Bordeaux"], adjectives: ["French"] },
  { name: "Italy", region: "Europe", names: ["Italy"], ambiguous: ["Milan"], cities: ["Milano", "Rome", "Turin", "Torino", "Bologna"], adjectives: ["Italian"] },
  { name: "Spain", region: "Europe", names: ["Spain"], cities: ["Madrid", "Barcelona", "Seville", "Bilbao", "Málaga", "Malaga"], adjectives: ["Spanish"] },
  { name: "Portugal", region: "Europe", names: ["Portugal"], cities: ["Lisbon", "Lisboa", "Porto"], adjectives: ["Portuguese"] },
  {
    name: "Netherlands",
    region: "Europe",
    names: ["Netherlands", "The Netherlands"],
    ambiguous: ["Holland"],
    cities: ["Amsterdam", "Rotterdam", "The Hague", "Eindhoven", "Utrecht"],
    adjectives: ["Dutch"],
  },
  { name: "Belgium", region: "Europe", names: ["Belgium"], cities: ["Brussels", "Antwerp"], adjectives: ["Belgian"] },
  { name: "Luxembourg", region: "Europe", names: ["Luxembourg"] },
  { name: "Switzerland", region: "Europe", names: ["Switzerland"], cities: ["Zurich", "Zürich", "Geneva", "Basel", "Lausanne", "Zug"], adjectives: ["Swiss"] },
  { name: "Austria", region: "Europe", names: ["Austria"], cities: ["Vienna", "Wien"], adjectives: ["Austrian"] },
  { name: "Sweden", region: "Europe", names: ["Sweden"], cities: ["Stockholm", "Gothenburg", "Malmö", "Malmo"], adjectives: ["Swedish"] },
  { name: "Norway", region: "Europe", names: ["Norway"], cities: ["Oslo", "Bergen", "Stavanger"], adjectives: ["Norwegian"] },
  { name: "Denmark", region: "Europe", names: ["Denmark"], cities: ["Copenhagen", "Aarhus"], adjectives: ["Danish"] },
  { name: "Finland", region: "Europe", names: ["Finland"], cities: ["Helsinki"], adjectives: ["Finnish"] },
  { name: "Iceland", region: "Europe", names: ["Iceland"], cities: ["Reykjavik"], adjectives: ["Icelandic"] },
  { name: "Poland", region: "Europe", names: ["Poland"], cities: ["Warsaw", "Krakow", "Kraków", "Wroclaw", "Wrocław", "Gdansk", "Gdańsk"], adjectives: ["Polish"] },
  { name: "Czech Republic", region: "Europe", names: ["Czech Republic", "Czechia"], cities: ["Prague", "Brno"], adjectives: ["Czech"] },
  { name: "Hungary", region: "Europe", names: ["Hungary"], cities: ["Budapest"], adjectives: ["Hungarian"] },
  { name: "Romania", region: "Europe", names: ["Romania"], cities: ["Bucharest", "Cluj-Napoca", "Cluj"], adjectives: ["Romanian"] },
  { name: "Bulgaria", region: "Europe", names: ["Bulgaria"], adjectives: ["Bulgarian"] },
  { name: "Greece", region: "Europe", names: ["Greece"], cities: ["Athens", "Thessaloniki"], adjectives: ["Greek"] },
  { name: "Croatia", region: "Europe", names: ["Croatia"], cities: ["Zagreb"], adjectives: ["Croatian"] },
  { name: "Serbia", region: "Europe", names: ["Serbia"], cities: ["Belgrade"], adjectives: ["Serbian"] },
  { name: "Slovakia", region: "Europe", names: ["Slovakia"], cities: ["Bratislava"], adjectives: ["Slovak"] },
  { name: "Slovenia", region: "Europe", names: ["Slovenia"], cities: ["Ljubljana"], adjectives: ["Slovenian"] },
  { name: "Ukraine", region: "Europe", names: ["Ukraine"], cities: ["Kyiv", "Kiev", "Lviv", "Kharkiv"], adjectives: ["Ukrainian"] },
  { name: "Russia", region: "Europe", names: ["Russia", "Russian Federation"], cities: ["Moscow", "St Petersburg", "St. Petersburg", "Saint Petersburg"], adjectives: ["Russian"] },
  { name: "Estonia", region: "Europe", names: ["Estonia"], cities: ["Tallinn"], adjectives: ["Estonian"] },
  { name: "Latvia", region: "Europe", names: ["Latvia"], cities: ["Riga"], adjectives: ["Latvian"] },
  { name: "Lithuania", region: "Europe", names: ["Lithuania"], cities: ["Vilnius"], adjectives: ["Lithuanian"] },
  { name: "Cyprus", region: "Europe", names: ["Cyprus"], cities: ["Nicosia", "Limassol"], adjectives: ["Cypriot"] },
  { name: "Malta", region: "Europe", names: ["Malta"], cities: ["Valletta"], adjectives: ["Maltese"] },

  // ── North America ────────────────────────────────────────────────────────
  {
    name: "United States",
    region: "North America",
    names: ["United States", "United States of America"],
    abbr: ["US", "USA", "U.S.", "U.S.A."],
    cities: ["New York", "NYC", "San Francisco", "Los Angeles", "Chicago", "Boston", "Seattle", "Miami", "Atlanta", "Houston", "Washington DC", "Washington D.C.", "Silicon Valley", "Denver", "Philadelphia"],
    adjectives: ["US", "American", "U.S."],
  },
  { name: "Canada", region: "North America", names: ["Canada"], cities: ["Toronto", "Vancouver", "Montreal", "Montréal", "Calgary", "Ottawa"], adjectives: ["Canadian"] },
  { name: "Mexico", region: "Latin America", names: ["México"], raw: ["(?<!new\\s)mexico"], cities: ["Mexico City", "Monterrey", "Guadalajara"], adjectives: ["Mexican"] },

  // ── Latin America ────────────────────────────────────────────────────────
  { name: "Brazil", region: "Latin America", names: ["Brazil", "Brasil"], cities: ["São Paulo", "Sao Paulo", "Rio de Janeiro", "Brasília", "Brasilia", "Belo Horizonte", "Curitiba"], adjectives: ["Brazilian"] },
  { name: "Argentina", region: "Latin America", names: ["Argentina"], cities: ["Buenos Aires"], adjectives: ["Argentine", "Argentinian"] },
  { name: "Chile", region: "Latin America", names: ["Chile"], cities: ["Santiago de Chile"], adjectives: ["Chilean"] },
  { name: "Colombia", region: "Latin America", names: ["Colombia"], cities: ["Bogotá", "Bogota", "Medellín", "Medellin"], adjectives: ["Colombian"] },
  { name: "Peru", region: "Latin America", names: ["Peru", "Perú"], adjectives: ["Peruvian"] },
  { name: "Ecuador", region: "Latin America", names: ["Ecuador"], cities: ["Quito", "Guayaquil"], adjectives: ["Ecuadorian"] },
  { name: "Uruguay", region: "Latin America", names: ["Uruguay"], cities: ["Montevideo"], adjectives: ["Uruguayan"] },
  { name: "Costa Rica", region: "Latin America", names: ["Costa Rica"], adjectives: ["Costa Rican"] },
  { name: "Panama", region: "Latin America", names: ["Panama", "Panamá"], adjectives: ["Panamanian"] },
  { name: "Dominican Republic", region: "Latin America", names: ["Dominican Republic"], cities: ["Santo Domingo"] },
  { name: "Venezuela", region: "Latin America", names: ["Venezuela"], cities: ["Caracas"], adjectives: ["Venezuelan"] },
  { name: "Guatemala", region: "Latin America", names: ["Guatemala"] },
  { name: "Puerto Rico", region: "Latin America", names: ["Puerto Rico"] },
];

/** Groups a requirement can name instead of listing the countries. */
const GROUPS: Array<{ name: string; pattern: string; members: string[] }> = [
  {
    name: "GCC",
    pattern: "GCC|Gulf\\s+Cooperation\\s+Council|Gulf\\s+states",
    members: ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain"],
  },
  { name: "Benelux", pattern: "Benelux", members: ["Belgium", "Netherlands", "Luxembourg"] },
  {
    name: "Nordics",
    pattern: "Nordics?|Nordic\\s+countries|Scandinavia(?:n\\s+countries)?",
    members: ["Sweden", "Norway", "Denmark", "Finland", "Iceland"],
  },
  { name: "DACH", pattern: "DACH", members: ["Germany", "Austria", "Switzerland"] },
  { name: "ANZ", pattern: "ANZ|Australia\\s+and\\s+New\\s+Zealand", members: ["Australia", "New Zealand"] },
];

/** Broad regions: a CV that names only these is a question for screening, not evidence. */
export const REGION_TERMS: Record<Region, RegExp> = {
  "Asia-Pacific":
    /\b(asia[\s-]?pacific|apac|south[\s-]?east\s+asia|east\s+asia|far\s+east|asean|greater\s+china|south\s+asia)\b/i,
  "Middle East": /\b(middle\s+east|mena|meta\s+region|gcc|gulf\s+region|the\s+gulf|levant)\b/i,
  Europe: /\b(europe|emea|european\s+union|nordics?|scandinavia|benelux|dach|cee\s+region|central\s+and\s+eastern\s+europe)\b/i,
  "North America": /\b(north\s+america|north\s+american\s+markets?)\b/i,
  "Latin America": /\b(latin\s+america|latam|south\s+america|central\s+america|caribbean)\b/i,
  Africa: /\b(africa|sub[\s-]saharan|ssa\s+region|east\s+africa|west\s+africa)\b/i,
};

const LETTER_BEFORE = "(?<![\\p{L}\\p{N}])";
const LETTER_AFTER = "(?![\\p{L}\\p{N}])";

/** A name as a pattern: specials escaped, any run of spaces or hyphens matches. */
function namePattern(name: string): string {
  return name
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/'/g, "['’]")
    .replace(/\s+/g, "[\\s-]+");
}

const alt = (xs: string[]) => xs.map(namePattern).join("|");

/** Separators inside a list of markets: "German, French or Benelux markets". */
const LIST_SEP = "(?:\\s*,\\s*(?:and\\s+|or\\s+|&\\s*)?|\\s*\\/\\s*|\\s+(?:and|or|&)\\s+)(?:the\\s+)?";
const LIST_ITEM = "[\\p{L}.'’-]+(?:\\s+[\\p{L}.'’-]+)?";
/** An adjective counts only when "market(s)" closes the list it sits in. */
const MARKET_TAIL = `(?=(?:${LIST_SEP}${LIST_ITEM})*\\s+markets?${LETTER_AFTER})`;

export type Place = {
  /** The country's (or group's) display name. */
  name: string;
  region: Region | null;
  /** True when the text names this place. */
  test(text: string): boolean;
  /** Offsets of every mention, for "what comes just before it" checks. */
  indexes(text: string): number[];
  /** True when the country itself is named (not only one of its cities). */
  namedAsCountry(text: string): boolean;
};

function compile(def: CountryDef): Place {
  const insensitive: string[] = [];
  const country: string[] = [];
  if (def.names.length) country.push(alt(def.names));
  if (def.raw?.length) country.push(...def.raw);
  if (def.cities?.length) insensitive.push(alt(def.cities));
  const countryCi = country.length ? `${LETTER_BEFORE}(?:${country.join("|")})${LETTER_AFTER}` : null;
  const citiesCi = insensitive.length ? `${LETTER_BEFORE}(?:${insensitive.join("|")})${LETTER_AFTER}` : null;

  const sensitive: string[] = [];
  if (def.abbr?.length) sensitive.push(`${LETTER_BEFORE}(?:${alt(def.abbr)})(?![\\p{L}\\p{N}]|\\$)`);
  if (def.ambiguous?.length) {
    const forms = def.ambiguous.flatMap((n) => [n, n.toUpperCase()]);
    sensitive.push(`${LETTER_BEFORE}(?:${alt(forms)})${LETTER_AFTER}(?!\\s+\\p{Lu}\\p{Ll})`);
  }
  // Adjectives only before "market(s)": capitalised, as written in English.
  if (def.adjectives?.length) sensitive.push(`${LETTER_BEFORE}(?:${alt(def.adjectives)})${MARKET_TAIL}`);

  const ci = [countryCi, citiesCi].filter(Boolean).join("|");
  const reCi = ci ? new RegExp(ci, "iu") : null;
  const reCs = sensitive.length ? new RegExp(sensitive.join("|"), "u") : null;
  const countryOnlyCi = countryCi ? new RegExp(countryCi, "iu") : null;
  const countryOnlyCs = def.abbr?.length || def.ambiguous?.length || def.adjectives?.length ? reCs : null;

  return {
    name: def.name,
    region: def.region,
    test: (text) => Boolean(reCi?.test(text) || reCs?.test(text)),
    indexes: (text) => {
      const out: number[] = [];
      for (const re of [reCi, reCs]) {
        if (!re) continue;
        for (const m of text.matchAll(new RegExp(re.source, re.flags + "g"))) out.push(m.index!);
      }
      return out.sort((a, b) => a - b);
    },
    namedAsCountry: (text) => Boolean(countryOnlyCi?.test(text) || countryOnlyCs?.test(text)),
  };
}

const PLACES: Place[] = COUNTRIES.map(compile);
const BY_NAME = new Map(PLACES.map((p) => [p.name, p]));

function compileGroup(g: (typeof GROUPS)[number]): Place {
  const re = new RegExp(`${LETTER_BEFORE}(?:${g.pattern})${LETTER_AFTER}`, "u");
  return {
    name: g.name,
    region: null,
    test: (text) => re.test(text),
    indexes: (text) => [...text.matchAll(new RegExp(re.source, "gu"))].map((m) => m.index!),
    namedAsCountry: (text) => re.test(text),
  };
}

const GROUP_PLACES = GROUPS.map((g) => ({ group: g, place: compileGroup(g) }));

/** Every country in the dictionary, for tests and coverage checks. */
export function allCountries(): Place[] {
  return PLACES;
}

/** The country entry for a display name ("United Kingdom"), or undefined. */
export function countryByName(name: string): Place | undefined {
  return BY_NAME.get(name);
}

/**
 * The places a piece of text names: countries (by name, abbreviation, city or
 * an adjective before "market(s)"), plus any group it names ("GCC") together
 * with the group's member countries.
 */
export function placesIn(text: string): Place[] {
  const found = new Map<string, Place>();
  for (const p of PLACES) if (p.test(text)) found.set(p.name, p);
  for (const { group, place } of GROUP_PLACES) {
    if (!place.test(text)) continue;
    found.set(place.name, place);
    for (const member of group.members) {
      const m = BY_NAME.get(member);
      if (m) found.set(m.name, m);
    }
  }
  return [...found.values()];
}

/** The broad regions the named places sit in, for the "region only" fallback. */
export function regionsOf(places: Place[]): Region[] {
  return [...new Set(places.map((p) => p.region).filter((r): r is Region => r !== null))];
}

/**
 * For rewriting only, never for matching: the country a demonym or an
 * abbreviation refers to ("Korean" -> South Korea, "British" -> United
 * Kingdom), with the wording a rewrite uses for its market ("the South Korean
 * market") and for working there ("work in the UK"). A requirement that
 * states a nationality is rewritten as a market or work-authorisation
 * requirement; the nationality itself is never read as a place.
 */
export function countryForDemonym(
  word: string,
): { name: string; marketAdjective: string; workIn: string } | null {
  const w = word.trim().toLowerCase().replace(/\./g, "");
  if (!w) return null;
  for (const def of COUNTRIES) {
    const forms = [...(def.adjectives ?? []), ...(def.abbr ?? [])].map((x) => x.toLowerCase().replace(/\./g, ""));
    if (!forms.includes(w)) continue;
    const short = def.abbr?.find((a) => /^[A-Z]{2,3}$/.test(a) && ["UK", "US", "UAE"].includes(a));
    const workIn = short
      ? `the ${short}`
      : /^(united|netherlands|philippines|czech|dominican)/i.test(def.name)
        ? `the ${def.name}`
        : def.name;
    return { name: def.name, marketAdjective: def.adjectives?.[0] ?? def.name, workIn };
  }
  return null;
}

/** Every adjectival form in the dictionary ("Korean", "British"), for the protected-attribute detector. */
export function demonymWords(): string[] {
  return [...new Set(COUNTRIES.flatMap((d) => d.adjectives ?? []))];
}
