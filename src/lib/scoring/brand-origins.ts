/**
 * Companies and brands by home country, for market-experience requirements.
 *
 * Marketing for a company or brand from a country is experience of that
 * market, wherever the marketer sat: a Dubai marketer running Nissan's GCC
 * launches or Mikimoto's UAE boutiques has worked with a Japanese principal,
 * its brand standards and its home team. The client's own wording says the
 * same ("working in-market or marketing brands from or into those markets").
 *
 * Only distinctive names are matched case-insensitively. Names that are also
 * common words or initials (LG, Kia, OPPO, TCL) must appear as written.
 * Country names must match scoring/geography.ts.
 */
import { countryForDemonym } from "./geography";

type BrandDef = { country: string; names: string[]; exact?: string[] };

const BRANDS: BrandDef[] = [
  {
    country: "Japan",
    names: [
      "Toyota", "Lexus", "Nissan", "Infiniti", "Honda", "Mazda", "Subaru", "Mitsubishi", "Suzuki", "Isuzu",
      "Yamaha", "Kawasaki", "Bridgestone", "Denso", "Komatsu",
      "Sony", "Panasonic", "Toshiba", "Hitachi", "Nikon", "Fujifilm", "Olympus", "Ricoh", "Epson", "Daikin",
      "Casio", "Seiko", "Grand Seiko", "Mikimoto", "Mikomoto", "Tasaki", "Shiseido", "Kanebo", "SK-II", "SK II",
      "Clé de Peau", "Cle de Peau", "Uniqlo", "Muji", "Daiso", "Onitsuka Tiger", "ASICS", "Mizuno",
      "Issey Miyake", "Comme des Garçons", "Comme des Garcons", "Nintendo", "Sanrio", "Bandai", "Rakuten",
      "SoftBank", "Takeda", "Kikkoman", "Ajinomoto", "Yakult", "Nissin", "Kirin", "Asahi", "Suntory",
      "Dentsu", "Hakuhodo", "Isetan", "Takashimaya", "Mitsukoshi", "AEON", "Japan Airlines", "Nomura",
      "Mizuho", "MUFG", "Makita", "Shimano", "Marugame", "Ippudo", "Yoshinoya", "Lawson",
    ],
    exact: ["Canon", "Kao", "JAL", "KOSÉ", "KOSE"],
  },
  {
    country: "South Korea",
    names: [
      "Samsung", "Hyundai", "SsangYong", "Daewoo", "Hanwha", "Doosan", "Lotte", "Shinsegae", "Amorepacific",
      "Amore Pacific", "Sulwhasoo", "Laneige", "Innisfree", "Etude House", "Missha", "COSRX", "Gentle Monster",
      "Paris Baguette", "Tous les Jours", "Bibigo", "Nongshim", "Binggrae", "Olive Young", "Coupang", "Naver",
      "Kakao", "HYBE", "SM Entertainment", "YG Entertainment", "JYP Entertainment", "Korean Air", "Asiana",
      "SK Telecom", "SK Group", "SK Hynix", "CJ CheilJedang", "CJ ENM", "CJ Group", "Hite Jinro",
    ],
    exact: ["LG", "Kia", "KIA"],
  },
  {
    country: "China",
    names: [
      "Huawei", "Xiaomi", "OnePlus", "Realme", "Lenovo", "Haier", "Hisense", "Midea", "BYD", "Geely", "Chery",
      "Jetour", "Changan", "Great Wall Motors", "Haval", "Hongqi", "XPeng", "Zeekr", "Lynk & Co", "Li Auto",
      "MG Motor", "SAIC", "Dongfeng", "Foton", "JAC Motors", "Omoda", "Exeed", "Bestune", "Alibaba",
      "AliExpress", "Tmall", "Taobao", "JD.com", "Tencent", "WeChat", "ByteDance", "TikTok", "Douyin",
      "Shein", "Temu", "Anta", "Li-Ning", "Li Ning", "Luckin", "Mixue", "Chagee", "Haidilao", "Tsingtao",
      "Moutai", "Pop Mart", "Miniso", "DJI", "Anker", "Transsion", "Tecno", "Infinix", "ZTE", "Air China",
      "China Southern", "China Eastern", "Bank of China", "ICBC", "Fosun", "Dalian Wanda", "Wanda Group",
    ],
    exact: ["OPPO", "Oppo", "Vivo", "vivo", "TCL", "GAC", "NIO", "Gree"],
  },
  {
    country: "Hong Kong",
    names: [
      "Cathay Pacific", "Shangri-La", "Mandarin Oriental", "Peninsula Hotels", "The Peninsula", "Swire",
      "Chow Tai Fook", "Chow Sang Sang", "Qeelin", "Queelin", "Goldlion", "Giordano", "Bossini", "Esprit",
      "Lee Kum Kee", "Jardine", "Dairy Farm", "A.S. Watson", "AS Watson", "Watsons", "Hutchison",
      "New World Development", "Sun Hung Kai", "Shanghai Tang", "Vitasoy", "Maxim's Caterers",
    ],
  },
  {
    country: "Singapore",
    names: [
      "Singapore Airlines", "CapitaLand", "Charles & Keith", "Charles and Keith", "TWG Tea", "Banyan Tree",
      "Raffles", "GrabFood", "GrabPay", "Grab Holdings", "Shopee", "Lazada", "Sea Limited", "Tiger Beer",
      "Tiger Balm", "Olam", "Wilmar", "BreadTalk", "Ya Kun", "Bengawan Solo", "Love, Bonito", "Love Bonito",
      "Singtel", "StarHub", "Mediacorp", "Temasek", "Marina Bay Sands", "Resorts World Sentosa", "Sentosa",
    ],
    exact: ["DBS", "OCBC", "UOB"],
  },
  {
    country: "Vietnam",
    names: [
      "Vingroup", "VinFast", "Vinhomes", "Vincom", "Vinpearl", "Vietjet", "Vietnam Airlines", "Trung Nguyen",
      "Highlands Coffee", "Masan", "Vinamilk", "Viettel", "Sun Group",
    ],
    exact: ["FPT"],
  },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BEFORE = "(?<![\\p{L}\\p{N}])";
const AFTER = "(?![\\p{L}\\p{N}])";

const COMPILED = BRANDS.map((b) => ({
  country: b.country,
  ci: new RegExp(`${BEFORE}(?:${[...b.names].sort((x, y) => y.length - x.length).map(esc).join("|")})${AFTER}`, "giu"),
  cs: b.exact?.length ? new RegExp(`${BEFORE}(?:${b.exact.map(esc).join("|")})${AFTER}`, "gu") : null,
}));

/** "Japanese brands", "a Korean automaker": an adjective naming the principal's home. */
const ORIGIN_PHRASE =
  /(?<![\p{L}\p{N}])((?:South\s+)?\p{Lu}[\p{L}-]+)\s+(brands?|compan(?:y|ies)|groups?|automakers?|car\s*makers?|OEMs?|manufacturers?|retailers?|principals?|conglomerates?|multinationals?|corporations?|firms?|clients?|labels?|houses?)(?![\p{L}])/gu;

export type BrandOrigin = { brand: string; country: string; index: number };

/** The companies and brands a line names, with their home countries. */
export function brandOriginsIn(text: string): BrandOrigin[] {
  const out: BrandOrigin[] = [];
  for (const c of COMPILED) {
    for (const re of [c.ci, c.cs]) {
      if (!re) continue;
      for (const m of text.matchAll(re)) out.push({ brand: m[0], country: c.country, index: m.index! });
    }
  }
  for (const m of text.matchAll(ORIGIN_PHRASE)) {
    const adj = m[1]!.replace(/\s+/g, " ");
    const country = countryForDemonym(adj)?.name ?? countryForDemonym(adj.replace(/^South /, ""))?.name;
    if (country) out.push({ brand: m[0], country, index: m.index! });
  }
  return out.sort((a, b) => a.index - b.index);
}
