/**
 * Generic geography matcher: country → common names + major cities, for every
 * country. Used for "experience in <market>" and "based in X" requirements.
 * Data is deliberately compact: ISO country names plus widely used aliases and
 * the main commercial cities. Matching is word-bounded and case-insensitive.
 */

type Entry = { names: string[]; cities: string[]; region?: string[] };

// prettier-ignore
const C: Record<string, Entry> = {
  AF:{names:["Afghanistan"],cities:["Kabul"]},AL:{names:["Albania"],cities:["Tirana"]},DZ:{names:["Algeria"],cities:["Algiers","Oran"]},AD:{names:["Andorra"],cities:[]},AO:{names:["Angola"],cities:["Luanda"]},AR:{names:["Argentina"],cities:["Buenos Aires","Cordoba","Rosario"]},AM:{names:["Armenia"],cities:["Yerevan"]},AU:{names:["Australia"],cities:["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra"]},AT:{names:["Austria"],cities:["Vienna","Graz","Salzburg"]},AZ:{names:["Azerbaijan"],cities:["Baku"]},
  BH:{names:["Bahrain"],cities:["Manama"],region:["GCC","Middle East","MENA"]},BD:{names:["Bangladesh"],cities:["Dhaka","Chittagong"]},BY:{names:["Belarus"],cities:["Minsk"]},BE:{names:["Belgium"],cities:["Brussels","Antwerp","Ghent"]},BJ:{names:["Benin"],cities:["Cotonou"]},BO:{names:["Bolivia"],cities:["La Paz","Santa Cruz"]},BA:{names:["Bosnia and Herzegovina","Bosnia"],cities:["Sarajevo"]},BW:{names:["Botswana"],cities:["Gaborone"]},BR:{names:["Brazil","Brasil"],cities:["Sao Paulo","São Paulo","Rio de Janeiro","Brasilia","Belo Horizonte","Curitiba","Porto Alegre"]},BN:{names:["Brunei"],cities:["Bandar Seri Begawan"]},BG:{names:["Bulgaria"],cities:["Sofia"]},
  KH:{names:["Cambodia"],cities:["Phnom Penh"]},CM:{names:["Cameroon"],cities:["Douala","Yaounde"]},CA:{names:["Canada"],cities:["Toronto","Vancouver","Montreal","Calgary","Ottawa"]},CL:{names:["Chile"],cities:["Santiago"]},CN:{names:["China","PRC","Mainland China"],cities:["Beijing","Shanghai","Shenzhen","Guangzhou","Chengdu","Hangzhou","Wuhan"]},CO:{names:["Colombia"],cities:["Bogota","Bogotá","Medellin","Medellín","Cali"]},CR:{names:["Costa Rica"],cities:["San Jose"]},HR:{names:["Croatia"],cities:["Zagreb"]},CU:{names:["Cuba"],cities:["Havana"]},CY:{names:["Cyprus"],cities:["Nicosia","Limassol"]},CZ:{names:["Czech Republic","Czechia"],cities:["Prague","Brno"]},
  DK:{names:["Denmark"],cities:["Copenhagen","Aarhus"]},DO:{names:["Dominican Republic"],cities:["Santo Domingo"]},EC:{names:["Ecuador"],cities:["Quito","Guayaquil"]},EG:{names:["Egypt"],cities:["Cairo","Alexandria","Giza"],region:["MENA","Middle East"]},SV:{names:["El Salvador"],cities:["San Salvador"]},EE:{names:["Estonia"],cities:["Tallinn"]},ET:{names:["Ethiopia"],cities:["Addis Ababa"]},FI:{names:["Finland"],cities:["Helsinki"]},FR:{names:["France"],cities:["Paris","Lyon","Marseille","Toulouse","Nice"]},
  GE:{names:["Georgia"],cities:["Tbilisi"]},DE:{names:["Germany","Deutschland"],cities:["Berlin","Munich","Hamburg","Frankfurt","Cologne","Dusseldorf","Düsseldorf","Stuttgart"]},GH:{names:["Ghana"],cities:["Accra","Kumasi"]},GR:{names:["Greece"],cities:["Athens","Thessaloniki"]},GT:{names:["Guatemala"],cities:["Guatemala City"]},HN:{names:["Honduras"],cities:["Tegucigalpa"]},HK:{names:["Hong Kong","HKSAR"],cities:["Kowloon"]},HU:{names:["Hungary"],cities:["Budapest"]},
  IS:{names:["Iceland"],cities:["Reykjavik"]},IN:{names:["India"],cities:["Mumbai","Delhi","New Delhi","Bangalore","Bengaluru","Chennai","Hyderabad","Kolkata","Pune","Gurgaon","Gurugram","Noida","Ahmedabad"]},ID:{names:["Indonesia"],cities:["Jakarta","Surabaya","Bali","Bandung"]},IR:{names:["Iran"],cities:["Tehran"]},IQ:{names:["Iraq"],cities:["Baghdad","Erbil"]},IE:{names:["Ireland"],cities:["Dublin","Cork","Galway"]},IL:{names:["Israel"],cities:["Tel Aviv","Jerusalem","Haifa"]},IT:{names:["Italy"],cities:["Rome","Milan","Naples","Turin","Florence"]},CI:{names:["Ivory Coast","Côte d'Ivoire","Cote d'Ivoire"],cities:["Abidjan"]},
  JM:{names:["Jamaica"],cities:["Kingston"]},JP:{names:["Japan"],cities:["Tokyo","Osaka","Kyoto","Yokohama","Nagoya","Fukuoka","Sapporo"]},JO:{names:["Jordan"],cities:["Amman"],region:["MENA","Middle East","Levant"]},KZ:{names:["Kazakhstan"],cities:["Almaty","Astana"]},KE:{names:["Kenya"],cities:["Nairobi","Mombasa"]},KR:{names:["South Korea","Korea","Republic of Korea","ROK"],cities:["Seoul","Busan","Incheon","Daegu"]},KW:{names:["Kuwait"],cities:["Kuwait City"],region:["GCC","Middle East","MENA"]},
  LA:{names:["Laos"],cities:["Vientiane"]},LV:{names:["Latvia"],cities:["Riga"]},LB:{names:["Lebanon"],cities:["Beirut"],region:["MENA","Middle East","Levant"]},LY:{names:["Libya"],cities:["Tripoli"]},LT:{names:["Lithuania"],cities:["Vilnius"]},LU:{names:["Luxembourg"],cities:[]},MO:{names:["Macau","Macao"],cities:[]},MY:{names:["Malaysia"],cities:["Kuala Lumpur","Penang","Johor Bahru"]},MV:{names:["Maldives"],cities:["Male"]},MT:{names:["Malta"],cities:["Valletta"]},MU:{names:["Mauritius"],cities:["Port Louis"]},MX:{names:["Mexico"],cities:["Mexico City","Guadalajara","Monterrey"]},MA:{names:["Morocco"],cities:["Casablanca","Rabat","Marrakech"]},MM:{names:["Myanmar","Burma"],cities:["Yangon"]},
  NP:{names:["Nepal"],cities:["Kathmandu"]},NL:{names:["Netherlands","Holland"],cities:["Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven"]},NZ:{names:["New Zealand"],cities:["Auckland","Wellington","Christchurch"]},NG:{names:["Nigeria"],cities:["Lagos","Abuja"]},NO:{names:["Norway"],cities:["Oslo","Bergen"]},OM:{names:["Oman"],cities:["Muscat"],region:["GCC","Middle East","MENA"]},PK:{names:["Pakistan"],cities:["Karachi","Lahore","Islamabad"]},PA:{names:["Panama"],cities:["Panama City"]},PY:{names:["Paraguay"],cities:["Asuncion"]},PE:{names:["Peru"],cities:["Lima"]},PH:{names:["Philippines"],cities:["Manila","Cebu","Makati","Quezon City"]},PL:{names:["Poland"],cities:["Warsaw","Krakow","Kraków","Wroclaw","Gdansk"]},PT:{names:["Portugal"],cities:["Lisbon","Porto"]},PR:{names:["Puerto Rico"],cities:["San Juan"]},
  QA:{names:["Qatar"],cities:["Doha"],region:["GCC","Middle East","MENA"]},RO:{names:["Romania"],cities:["Bucharest","Cluj"]},RU:{names:["Russia","Russian Federation"],cities:["Moscow","Saint Petersburg","St Petersburg"]},RW:{names:["Rwanda"],cities:["Kigali"]},SA:{names:["Saudi Arabia","KSA"],cities:["Riyadh","Jeddah","Dammam","Mecca","Medina","Khobar"],region:["GCC","Middle East","MENA"]},SN:{names:["Senegal"],cities:["Dakar"]},RS:{names:["Serbia"],cities:["Belgrade"]},SG:{names:["Singapore"],cities:[]},SK:{names:["Slovakia"],cities:["Bratislava"]},SI:{names:["Slovenia"],cities:["Ljubljana"]},ZA:{names:["South Africa"],cities:["Johannesburg","Cape Town","Durban","Pretoria"]},ES:{names:["Spain","España"],cities:["Madrid","Barcelona","Valencia","Seville","Malaga"]},LK:{names:["Sri Lanka"],cities:["Colombo","Kandy"]},SD:{names:["Sudan"],cities:["Khartoum"]},SE:{names:["Sweden"],cities:["Stockholm","Gothenburg","Malmo"]},CH:{names:["Switzerland"],cities:["Zurich","Zürich","Geneva","Basel","Bern","Lausanne"]},SY:{names:["Syria"],cities:["Damascus"]},
  TW:{names:["Taiwan"],cities:["Taipei","Kaohsiung"]},TZ:{names:["Tanzania"],cities:["Dar es Salaam"]},TH:{names:["Thailand"],cities:["Bangkok","Phuket","Chiang Mai"]},TN:{names:["Tunisia"],cities:["Tunis"]},TR:{names:["Turkey","Türkiye","Turkiye"],cities:["Istanbul","Ankara","Izmir"]},UG:{names:["Uganda"],cities:["Kampala"]},UA:{names:["Ukraine"],cities:["Kyiv","Kiev","Lviv","Kharkiv"]},AE:{names:["United Arab Emirates","UAE","Emirates"],cities:["Dubai","Abu Dhabi","Sharjah","Ajman","Ras Al Khaimah","Al Ain"],region:["GCC","Middle East","MENA"]},GB:{names:["United Kingdom","UK","Great Britain","Britain","England","Scotland","Wales","Northern Ireland"],cities:["London","Manchester","Birmingham","Leeds","Glasgow","Edinburgh","Bristol","Liverpool","Belfast","York","Hull"]},US:{names:["United States","USA","U.S.","US","America"],cities:["New York","Los Angeles","Chicago","San Francisco","Boston","Seattle","Miami","Dallas","Houston","Atlanta","Washington DC"]},UY:{names:["Uruguay"],cities:["Montevideo"]},UZ:{names:["Uzbekistan"],cities:["Tashkent"]},VE:{names:["Venezuela"],cities:["Caracas"]},VN:{names:["Vietnam","Viet Nam"],cities:["Hanoi","Ho Chi Minh City","Saigon","Da Nang"]},YE:{names:["Yemen"],cities:["Sanaa"]},ZM:{names:["Zambia"],cities:["Lusaka"]},ZW:{names:["Zimbabwe"],cities:["Harare"]},
};

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function wordRe(term: string, flags = "i") {
  // Short all-caps codes (UK, US, UAE, KSA) must match case-sensitively.
  const cs = /^[A-Z.]{2,4}$/.test(term);
  return new RegExp(`(?<![A-Za-z])${esc(term)}(?![A-Za-z])`, cs ? "" : flags);
}

/** ISO codes of every country named (by name or city) in a piece of text. */
export function countriesIn(text: string): string[] {
  const out: string[] = [];
  for (const [code, e] of Object.entries(C)) {
    if ([...e.names, ...e.cities].some((t) => wordRe(t).test(text))) out.push(code);
  }
  return out;
}

/** All surface terms (names + cities) for a country. */
export function termsFor(code: string): string[] {
  const e = C[code];
  return e ? [...e.names, ...e.cities] : [];
}

export function isMarketExperienceRequirement(text: string): boolean {
  return (
    /\b(?:experience|exposure|background|track record|worked|working|knowledge)\b/i.test(text) &&
    /\b(?:in|across|within|of)\b/i.test(text) &&
    countriesIn(text).length > 0
  );
}

const TRAINING = /\b(?:university|college|school|degree|bachelor|master|mba|diploma|course|certificat|studied|exchange|internship|training|graduat)/i;

export type GeoVerdict = { status: "met" | "partial" | "missing"; country?: string; snippet?: string };

/**
 * Met when a listed country/city appears on a CV line that reads as work
 * (job location, market scope, brand market); partial when it only appears on
 * an education/training line.
 */
export function evaluateMarketExperience(requirement: string, cv: string): GeoVerdict {
  const wanted = countriesIn(requirement);
  if (wanted.length === 0) return { status: "missing" };
  const lines = cv.split(/\n+|(?<=[.;])\s+/).map((l) => l.trim()).filter(Boolean);
  let partial: GeoVerdict | null = null;
  for (const line of lines) {
    for (const code of wanted) {
      if (!termsFor(code).some((t) => wordRe(t).test(line))) continue;
      if (TRAINING.test(line)) {
        partial ??= { status: "partial", country: code, snippet: line.slice(0, 220) };
      } else {
        return { status: "met", country: code, snippet: line.slice(0, 220) };
      }
    }
  }
  return partial ?? { status: "missing" };
}
