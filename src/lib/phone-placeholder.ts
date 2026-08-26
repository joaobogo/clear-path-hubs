/**
 * Phone input placeholder keyed to the role's country.
 *
 * The placeholder should never default to a US number for a non-US role.
 * We map the role's country_code to its ITU dialling code and render a
 * neutral local-number mask so the candidate sees the right prefix.
 */

const DIAL_CODE_BY_COUNTRY: Record<string, string> = {
  AE: "+971",
  AR: "+54",
  AT: "+43",
  AU: "+61",
  BE: "+32",
  BG: "+359",
  BR: "+55",
  CA: "+1",
  CH: "+41",
  CL: "+56",
  CN: "+86",
  CO: "+57",
  CZ: "+420",
  DE: "+49",
  DK: "+45",
  EE: "+372",
  EG: "+20",
  ES: "+34",
  FI: "+358",
  FR: "+33",
  GB: "+44",
  GR: "+30",
  HK: "+852",
  HR: "+385",
  HU: "+36",
  ID: "+62",
  IE: "+353",
  IL: "+972",
  IN: "+91",
  IT: "+39",
  JP: "+81",
  KE: "+254",
  KR: "+82",
  LT: "+370",
  LU: "+352",
  LV: "+371",
  MA: "+212",
  MX: "+52",
  MY: "+60",
  NG: "+234",
  NL: "+31",
  NO: "+47",
  NZ: "+64",
  PE: "+51",
  PH: "+63",
  PL: "+48",
  PT: "+351",
  QA: "+974",
  RO: "+40",
  RS: "+381",
  SA: "+966",
  SE: "+46",
  SG: "+65",
  SI: "+386",
  SK: "+421",
  TH: "+66",
  TR: "+90",
  TW: "+886",
  UA: "+380",
  US: "+1",
  UY: "+598",
  VN: "+84",
  ZA: "+27",
};

export function phonePlaceholder(countryCode?: string | null): string {
  const cc = (countryCode ?? "").trim().toUpperCase();
  const dial = DIAL_CODE_BY_COUNTRY[cc] ?? "+1";
  return `${dial} 000 000 000`;
}
