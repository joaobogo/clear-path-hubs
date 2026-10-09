/**
 * The instant, deterministic read of a job description.
 *
 * Runs in the browser with no network, in a few milliseconds, the moment text
 * lands in the intake. The model read (src/routes/api/public/jd-requirements)
 * is slower and smarter; this one makes sure the form is never empty while it
 * works, and never empty if it fails.
 *
 * PRECISION OVER RECALL. A wrong field is worse than an empty one: the client
 * has to notice it, and a client who stops trusting the pre-fill stops reading
 * it. So every field here is taken only from a place a description states it
 * plainly — a labelled line ("Location: Lisbon"), a headline token, a salary
 * written with a currency, a short stock phrase ("this is a fully remote
 * role"). Never from the shape of a sentence. When two readings disagree the
 * answer is nothing.
 *
 * Bounded by construction: header fields are read from the first lines, the
 * salary scan is anchored on currency tokens and looks at a fixed window around
 * each (so no regex can backtrack across the document), and every loop has a
 * ceiling. 50k characters of adversarial input finish in single-digit
 * milliseconds.
 *
 * Languages: English, Brazilian Portuguese and Spanish labels and phrases.
 */
import {
  MAX_MUST_HAVES,
  MAX_REQUIREMENT_CHARS,
  MIN_REQUIREMENT_CHARS,
  normalizeRequirementKey,
} from "@/lib/express-intake-schema";
import type {
  BlueprintConfidence,
  BlueprintRequirement,
  BlueprintSeniority,
  JdBlueprint,
} from "@/lib/jd-blueprint";

export type QuickReadResult = {
  blueprint: JdBlueprint;
  requirements: BlueprintRequirement[];
};

export type QuickReadOptions = {
  /** "Today", for rejecting start dates in the past. Tests pin it. */
  now?: Date;
};

/* ------------------------------------------------------------------ limits */

/** Nothing beyond this is scanned; the server refuses more than 30k anyway. */
const MAX_SCAN_CHARS = 120_000;
const MAX_LINES = 1_800;
const MAX_LINE_CHARS = 2_000;
/** Header fields (title, location, team, ...) are read from the top of the text. */
const HEADER_LINES = 120;
/** Labelled detail lines can sit lower, in a "Job details" block. */
const LABEL_LINES = 420;
const MAX_CURRENCY_ANCHORS = 200;
const MAX_REQUIREMENTS = 12;

/* ------------------------------------------------------------ normalisation */

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—",
  bull: "•", middot: "·", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: "…",
  euro: "€", pound: "£", yen: "¥", copy: "©", reg: "®", trade: "™",
  eacute: "é", egrave: "è", agrave: "à", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú",
  atilde: "ã", otilde: "õ", ccedil: "ç", ntilde: "ñ", ecirc: "ê", ocirc: "ô", acirc: "â",
  uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
};

function decodeEntities(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, g: string) => {
    if (g[0] === "#") {
      const code = g[1] === "x" || g[1] === "X" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    }
    return ENTITIES[g.toLowerCase()] ?? m;
  });
}

/**
 * Brings pasted, uploaded or scraped text to one predictable shape: LF line
 * endings, plain spaces, no invisible characters, no HTML. Idempotent.
 */
export function normalizeJdText(raw: string): string {
  let s = String(raw ?? "").slice(0, MAX_SCAN_CHARS);
  if (/<\/?(?:p|div|li|ul|ol|br|h[1-6]|span|strong|b|em|a|table|tr|td)\b[^>]{0,200}>/i.test(s)) {
    s = s
      .replace(/<\/(?:p|div|li|h[1-6]|tr|ul|ol|table)\s*>|<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]{0,200}>/gi, "\n• ")
      .replace(/<[^>]{1,300}>/g, " ");
  }
  s = decodeEntities(s);
  return (
    s
      .replace(/\r\n?|\u2028|\u2029|\u000b|\u000c|\u0085/g, "\n")
      .replace(/[\u200b-\u200d\u2060\ufeff\u00ad\u200e\u200f]/g, "")
      .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\t]/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000e-\u001f\u007f]/g, " ")
      .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
      .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
      // Two-column PDF text: a wide gap is a column break, not a space.
      .replace(/(\S) {3,}(?=\S)/g, "$1\n")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Lower-case, accent-free, hyphens as spaces: the form words are compared in. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-‐-―−]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BULLET_RE = /^(?:[•●▪■◦○‣⁃∙·►▶✓✔➢➤◆◇→▸]\s*|[-–—*+](?=\s)\s*|\d{1,2}[.)](?=\s)\s*|\(?[a-z][.)](?=\s)\s*)/;

type Ln = {
  /** Cleaned text: no bullet, heading marks, emphasis or leading emoji. */
  t: string;
  bullet: boolean;
  md: boolean;
  blank: boolean;
  pin: boolean;
};

function prepLine(rawIn: string): Ln {
  let raw = rawIn.slice(0, MAX_LINE_CHARS).trim();
  if (!raw) return { t: "", bullet: false, md: false, blank: true, pin: false };
  let pin = false;
  const emoji = /^[\p{Extended_Pictographic}\uFE0F\u200d]+\s*/u.exec(raw);
  if (emoji) {
    pin = /^[📍📌🌍🌎🌏🗺]/u.test(raw);
    raw = raw.slice(emoji[0].length);
  }
  let md = false;
  const h = /^#{1,6}\s*/.exec(raw);
  if (h) {
    md = true;
    raw = raw.slice(h[0].length);
  }
  raw = raw.replace(/^>+\s*/, "");
  let bullet = false;
  if (!md) {
    const b = BULLET_RE.exec(raw);
    if (b && raw.length > b[0].length) {
      bullet = true;
      raw = raw.slice(b[0].length);
    }
  }
  const t = raw
    .replace(/\[([^\]]{1,200})\]\([^)]{1,500}\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/^[*_\s]+|[*_\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { t, bullet, md, blank: t.length === 0, pin };
}

/* ------------------------------------------------------------------ labels */

type Field =
  | "title" | "titleWeak" | "team" | "location" | "attr" | "seniority" | "start" | "comp";

const LABELS: Record<Field, string[]> = {
  title: [
    "job title", "position title", "role title", "job role", "vacancy title", "titulo da vaga", "titulo do cargo",
    "nome da vaga", "cargo", "vaga", "titulo del puesto", "titulo del cargo", "puesto", "nombre del puesto",
    "denominacion del puesto", "vacante", "titulo",
  ],
  titleWeak: [
    "title", "position", "role", "job", "opening", "job opening", "open position", "vacancy", "hiring",
    "we are hiring", "we re hiring", "now hiring", "currently hiring", "posicao", "funcao", "oportunidade",
    "posicion",
  ],
  team: [
    "team", "department", "dept", "function", "business unit", "group", "division", "equipe", "time", "area",
    "departamento", "setor", "equipo", "unidad", "area funcional", "squad", "practice",
  ],
  location: [
    "location", "job location", "work location", "office", "office location", "based in", "city", "place of work",
    "workplace", "location of work", "localizacao", "local", "local de trabalho", "localidade", "cidade",
    "ubicacion", "lugar de trabajo", "ciudad", "sede", "lugar", "regiao",
  ],
  attr: [
    "work model", "work arrangement", "workplace type", "work type", "remote policy", "remote status",
    "working model", "work style", "work setup", "work mode", "job type", "employment type", "contract type",
    "type of employment", "type", "schedule", "work schedule", "hours", "employment", "contract", "engagement",
    "tipo de contrato", "regime de contratacao", "tipo de contratacao", "contratacao", "vinculo", "regime",
    "regime de trabalho", "modalidade", "modalidade de trabalho", "modalidade de contratacao",
    "modelo de trabalho", "formato", "jornada", "carga horaria", "tipo de empleo", "tipo de contratacion",
    "tipo de jornada", "modalidad", "modelo de trabajo", "tipo de trabajo", "contrato", "tipo de vaga",
  ],
  seniority: [
    "seniority", "level", "experience level", "career level", "job level", "seniority level", "nivel",
    "senioridade", "nivel de experiencia", "nivel de senioridade", "nivel profesional",
  ],
  start: [
    "start date", "starting date", "expected start", "expected start date", "target start", "target start date",
    "desired start date", "preferred start date", "anticipated start date", "start", "joining date",
    "date of joining", "data de inicio", "inicio", "previsao de inicio", "fecha de inicio", "inicio previsto",
    "fecha de incorporacion", "incorporacion",
  ],
  comp: [
    "salary", "salary range", "pay", "pay range", "compensation", "base salary", "annual salary", "hourly rate",
    "rate", "pay rate", "remuneration", "salario", "faixa salarial", "remuneracao", "bolsa", "sueldo",
    "salario", "rango salarial", "remuneracion",
  ],
};

const LABEL_FIELD = new Map<string, Field>();
for (const f of Object.keys(LABELS) as Field[]) for (const l of LABELS[f]) LABEL_FIELD.set(l, f);

/** "Job Title :", "Location - London", "Local: São Paulo". Colon, or a spaced dash. */
const LABEL_SPLIT = /^([^:：]{2,40}?)\s*[:：]\s*(.*)$|^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,30}?)\s+[-–—]\s+(.+)$/;

function splitLabel(t: string): { field: Field; value: string } | null {
  const m = LABEL_SPLIT.exec(t);
  if (!m) return null;
  const label = m[1] ?? m[3];
  const value = (m[1] !== undefined ? m[2] : m[4]) ?? "";
  if (!label) return null;
  const field = LABEL_FIELD.get(fold(label).replace(/[^a-z0-9 ]/g, "").trim());
  if (!field) return null;
  return { field, value: value.trim() };
}

/* ------------------------------------------------------------- role nouns */

const ROLE_NOUNS = new Set(
  (
    "engineer developer programmer architect designer manager director head lead analyst scientist accountant controller auditor " +
    "nurse physician doctor therapist technician operator associate assistant coordinator specialist consultant advisor adviser " +
    "administrator officer executive representative agent recruiter buyer planner supervisor foreman driver picker packer handler " +
    "clerk cashier chef cook waiter waitress server bartender barista host hostess receptionist teacher instructor lecturer professor " +
    "researcher writer editor marketer strategist counsel lawyer paralegal attorney mechanic electrician plumber welder carpenter " +
    "cleaner janitor guard pharmacist dentist surgeon midwife caregiver sales ceo cto cfo coo cmo cio cpo president partner intern " +
    "trainee apprentice vp founder owner tester qa sre devops generalist technologist admin bookkeeper underwriter actuary " +
    "treasurer economist statistician copywriter producer journalist translator interpreter pilot paramedic radiographer sonographer " +
    "phlebotomist hygienist optometrist veterinarian groundskeeper housekeeper porter concierge steward stewardess sommelier " +
    "merchandiser stocker loader forklift fabricator machinist inspector estimator surveyor superintendent labourer laborer " +
    "warehouseman warehousewoman dispatcher courier delivery trader broker underwriter practitioner housekeeping " +
    "engenheiro engenheira desenvolvedor desenvolvedora analista gerente coordenador coordenadora diretor diretora assistente auxiliar " +
    "tecnico tecnica enfermeiro enfermeira medico medica motorista vendedor vendedora contador contadora atendente recepcionista " +
    "cozinheiro cozinheira estagiario estagiaria consultor consultora especialista advogado advogada programador programadora lider " +
    "arquiteto arquiteta professor professora representante comprador almoxarife conferente separador operador operadora supervisora " +
    "gestor gestora encarregado encarregada garcom garconete caixa padeiro eletricista mecanico soldador pedreiro faxineiro porteiro " +
    "ingeniero ingeniera desarrollador desarrolladora coordinador asistente conductor ejecutivo ejecutiva abogado abogada arquitecto " +
    "arquitecta profesor profesora camarero camarera cocinero cocinera operario operaria mozo almacenero jefe jefa responsable encargado " +
    "encargada vendedor cajero cajera recepcionista enfermero enfermera medico tecnico auxiliar administrativo administrativa"
  ).split(/\s+/),
);

function hasRoleNoun(s: string): boolean {
  for (const w of fold(s).split(/[^a-z0-9]+/)) {
    if (!w) continue;
    if (ROLE_NOUNS.has(w)) return true;
    if (w.length > 3 && w.endsWith("s") && ROLE_NOUNS.has(w.slice(0, -1))) return true;
  }
  return false;
}

/* ------------------------------------------------------------------- title */

const GENDER_SUFFIX = /\s*[([]\s*(?:[mfwdxhgn]\s*\/\s*){1,3}[mfwdxhgn]\s*[)\]]|\s*[([]\s*all genders\s*[)\]]|\s*[([]\s*gn\s*[)\]]/gi;
const REF_SUFFIX = /\s*[([]\s*(?:req|job|ref|id|vaga|cod|code)\b[^)\]]{0,30}[)\]]\s*$/i;
const COMPANY_SUFFIX = /\b(?:inc|llc|ltd|limited|gmbh|corp|corporation|co|plc|ltda|sa|s a|ag|bv|pty|group|holdings|solutions|technologies|labs)\.?$/i;
const NOT_A_TITLE =
  /\b(?:about\s+us|about\s+the|who\s+we\s+are|we\s+are|we're|we\s+is|our\s+(?:mission|company|team)|job\s+description|overview|summary|company|apply|salary|benefits|is\s+hiring|are\s+hiring|looking\s+for|seeking|join\s+us|careers?\s+at|sobre\s+nos|estamos|buscamos|sobre\s+la|buscamos|procuramos)\b/i;
const ACRONYMS = new Map<string, string>([
  ["it", "IT"], ["qa", "QA"], ["hr", "HR"], ["ux", "UX"], ["ui", "UI"], ["ceo", "CEO"], ["cto", "CTO"], ["cfo", "CFO"],
  ["coo", "COO"], ["cmo", "CMO"], ["cio", "CIO"], ["vp", "VP"], ["sre", "SRE"], ["devops", "DevOps"], ["ios", "iOS"],
  ["sql", "SQL"], ["api", "API"], ["aws", "AWS"], ["erp", "ERP"], ["crm", "CRM"], ["seo", "SEO"], ["pr", "PR"],
  ["rn", "RN"], ["lpn", "LPN"], ["cna", "CNA"], ["ii", "II"], ["iii", "III"], ["iv", "IV"], ["sap", "SAP"],
  ["b2b", "B2B"], ["b2c", "B2C"], ["ml", "ML"], ["ai", "AI"], ["bi", "BI"], ["pm", "PM"], ["gm", "GM"], ["us", "US"],
  ["uk", "UK"], ["emea", "EMEA"], ["rh", "RH"], ["ti", "TI"], ["sdr", "SDR"], ["bdr", "BDR"], ["cpa", "CPA"],
]);
const SMALL = new Set(["of", "and", "the", "in", "for", "de", "da", "do", "del", "la", "el", "y", "e", "&", "at", "a", "as", "on", "to"]);

/** Short words that are ordinary words, not acronyms, in an all-caps title. */
const COMMON_SHORT = new Set(
  "of and the for de da do dos das del la las los el y e at a as on to in new sr jr web app bar day law tax art sea air car pet kid spa gym lab bus van oil gas red big top key end hub ops com em no na ao por sub fit".split(" "),
);

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w, i) => {
      const lower = w.toLowerCase();
      const bare = lower.replace(/[^a-z0-9]/g, "");
      const ac = ACRONYMS.get(bare);
      if (ac) return w.replace(/[A-Za-z0-9]+/, ac);
      if (i > 0 && SMALL.has(lower)) return lower;
      // "UTI", "ICU", "RH": a short all-caps word that is not a common word stays an acronym.
      if (bare.length >= 2 && bare.length <= 3 && /^[a-z]+$/.test(bare) && !COMMON_SHORT.has(bare)) return w;
      return lower.replace(/(^|[-/])([a-zà-ÿ])/g, (_m, p: string, c: string) => p + c.toUpperCase());
    })
    .join(" ");
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

/** Capitalised-word shape, used to vet a value that came from a weak label. */
function looksNamelike(s: string): boolean {
  const words = s.split(" ");
  if (words.length > 5) return false;
  for (const w of words) {
    if (!w) return false;
    if (SMALL.has(w.toLowerCase()) && w.toLowerCase() !== "to") continue;
    if (!/^[A-ZÀ-Þ0-9(]/.test(w)) return false;
  }
  return true;
}

const NON_TITLE_VALUES = /^(?:full[- ]?time|part[- ]?time|remote|hybrid|on[- ]?site|contract|permanent|temporary|freelance|internship|tbd|tba|n\/?a|none|various|multiple|open)$/i;

/** Cuts a trailing company/location/gender marker off a title; null if nothing usable is left. */
function cleanTitle(valueIn: string): string | null {
  let v = valueIn
    .replace(GENDER_SUFFIX, "")
    .replace(REF_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
  // "Senior Accountant at Acme", "Senior Accountant | Acme", "Accountant - Acme Ltd"
  const cut = / (?:at|@|\|) (?=\S)/.exec(v);
  if (cut && cut.index > 2) {
    const before = v.slice(0, cut.index);
    const after = v.slice(cut.index + cut[0].length);
    if (hasRoleNoun(before) && !hasRoleNoun(after) && !/^(?:the|a|an)\b/i.test(after)) v = before.trim();
  }
  const dash = /^(.{3,}?) [-–—] (.+)$/.exec(v);
  if (dash && hasRoleNoun(dash[1]!) && COMPANY_SUFFIX.test(dash[2]!.trim())) v = dash[1]!.trim();
  // "Warehouse Operative - Part Time", "Barista (Full-time)": the contract is not the title.
  v = v.replace(
    /\s*(?:[-–—|]\s*|[([]\s*)(?:full[- ]?time|part[- ]?time|contract|temporary|temp|permanent|freelance|internship|remote|hybrid|on[- ]?site|fixed[- ]term)\s*[)\]]?\s*$/i,
    "",
  );
  v = v.replace(/[\s,;:|\-–—]+$/g, "").replace(/^[\s,;:|\-–—]+/g, "").trim();
  if (v.length < 3 || v.length > 90) return null;
  if (!/[A-Za-zÀ-ÿ]/.test(v)) return null;
  if (/[.!?;]$/.test(v)) return null;
  if (/https?:\/\/|@\w+\.\w+|www\./i.test(v)) return null;
  if (v.split(" ").length > 11) return null;
  if (NON_TITLE_VALUES.test(v)) return null;
  if (NOT_A_TITLE.test(v)) return null;
  if (/^(?:you|we|our|this|these|the role|your|they|it|if|as a|as an|join|apply)\b/i.test(v)) return null;
  if (/\b(?:will|must|should|can|are|is|have|has)\b/i.test(v)) return null;
  if (isAllCaps(v)) v = titleCase(v);
  return v;
}

/* --------------------------------------------------------------- work model */

type WorkModel = "remote" | "hybrid" | "onsite";

const WM_PATTERNS: Array<[WorkModel, RegExp]> = [
  ["remote", /\b(?:remote|remoto|remota|teletrabalho|teletrabajo|home ?office|work from home|wfh|telecommut\w*|distributed)\b/],
  ["hybrid", /\b(?:hybrid|hibrido|hibrida|semi ?presencial)\b/],
  ["onsite", /\b(?:on ?site|in (?:the )?office|in person|office based|presencial|presenciales|en oficina)\b/],
];

/** What a SHORT value (a label's value, a headline token) says about the work model. */
function workModelsIn(valueFolded: string): Set<WorkModel> {
  const out = new Set<WorkModel>();
  // "3 days in the office" explains a hybrid role; it does not make it on-site.
  const v = valueFolded.replace(/\b(?:\d+|one|two|three|four|um|dois|tres|quatro|uno|dos|cuatro)\s*(?:x\s*)?(?:days?|dias)\b[^.;)]{0,30}?\b(?:office|site|escritorio|oficina)\b/g, " ");
  for (const [wm, re] of WM_PATTERNS) if (re.test(v)) out.add(wm);
  return out;
}

/** Stock phrases that state the work model of THIS role in running text. */
const WM_PROSE: Array<[WorkModel, RegExp]> = [
  ["remote", /\b(?:fully|100%|completely|entirely|totally|100 percent) remote\b(?! first)/g],
  ["remote", /\bremote (?:position|role|job|opportunity|contract|basis)\b/g],
  ["remote", /\b(?:this|the) (?:position |role |job )?is (?:a )?(?:remote|work from home)\b/g],
  ["remote", /\b(?:100%|totalmente) remot[oa]\b/g],
  ["remote", /\b(?:vaga|trabalho|posicao|modelo|regime|modalidade|formato) (?:de trabalho )?remot[oa]\b/g],
  ["remote", /\bmodalidad remot[ao]\b|\bteletrabajo\b/g],
  ["hybrid", /\bhybrid (?:work|working|role|position|model|schedule|setup|arrangement|opportunity|environment|policy)\b/g],
  ["hybrid", /\b(?:this|the) (?:position |role |job )?is (?:a )?hybrid\b/g],
  ["hybrid", /\b[1-4] days? (?:a|per|each|every) week (?:in|at|on) (?:the |our )?(?:office|site)\b/g],
  ["hybrid", /\b(?:in|at) the office [1-4] days (?:a|per|each) week\b/g],
  ["hybrid", /\b(?:vaga|trabalho|regime|modelo|modalidade|formato|esquema) hibrid[oa]\b|\bmodalidad hibrid[ao]\b|\bhibrid[oa] \(?[1-4]/g],
  ["onsite", /\b(?:this|the) (?:position |role |job )?is (?:an? )?(?:fully |100% )?(?:on ?site|in office|in person)\b/g],
  ["onsite", /\b(?:on ?site|in office|in person) (?:role|position|job|only|required|attendance)\b/g],
  ["onsite", /\b(?:100%|totalmente) presencial\b/g],
  ["onsite", /\b(?:vaga|trabalho|regime|modalidade|formato|posicao) presencial\b/g],
];
const NEGATION_BEFORE = /\b(?:not|non|no|nao|sin|never)\s+(?:a\s+|an\s+)?$/;

function proseWorkModels(flatFolded: string): Set<WorkModel> {
  const out = new Set<WorkModel>();
  for (const [wm, re] of WM_PROSE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(flatFolded)) && guard++ < 20) {
      const before = flatFolded.slice(Math.max(0, m.index - 14), m.index);
      if (NEGATION_BEFORE.test(before)) continue;
      out.add(wm);
      break;
    }
  }
  return out;
}

/* --------------------------------------------------------- employment type */

type Emp = "full_time" | "part_time" | "contract" | "temporary" | "internship";

const EMP_PATTERNS: Array<[Emp, RegExp]> = [
  ["full_time", /\b(?:full ?time|fulltime|clt|tempo integral|tiempo completo|jornada completa|jornada integral|periodo integral)\b/],
  ["part_time", /\b(?:part ?time|parttime|meio periodo|medio tiempo|tiempo parcial|periodo parcial|jornada parcial)\b/],
  ["contract", /\b(?:contract|contractor|contracting|freelance|freelancer|fixed term|pj|pessoa juridica|prestador de servicos?|autonomo)\b/],
  ["temporary", /\b(?:temporary|temp|seasonal|temporario|temporaria|temporal|sazonal)\b/],
  ["internship", /\b(?:internship|intern|estagio|estagiario|estagiaria|pasantia|pasante|practicas|trainee program)\b/],
];
const PERMANENT_CONTRACT = /\b(?:permanent|open ended|indefinite|indefinido|permanente|unlimited) (?:employment )?contract\b|\bcontrato (?:indefinido|permanente|por tiempo indefinido)\b|\bcontract(?:ing)? (?:and )?benefits\b/g;

function employmentIn(valueFolded: string): Set<Emp> {
  const v = valueFolded.replace(PERMANENT_CONTRACT, " ");
  const out = new Set<Emp>();
  for (const [e, re] of EMP_PATTERNS) if (re.test(v)) out.add(e);
  return out;
}

function resolveEmployment(kinds: Set<Emp>): Emp | null {
  const nonTime = [...kinds].filter((k) => k === "contract" || k === "temporary" || k === "internship");
  if (nonTime.length === 1) return nonTime[0]!;
  if (nonTime.length > 1) return null;
  const time = [...kinds];
  return time.length === 1 ? time[0]! : null;
}

const EMP_PROSE: Array<[Emp, RegExp]> = [
  ["full_time", /\b(?:this|the) (?:position |role |job )?is (?:a )?full ?time\b/g],
  ["full_time", /\bfull ?time (?:position|role|job|opportunity|basis|permanent|employee position|employment)\b/g],
  ["full_time", /\b(?:seeking|hiring|looking for|recruiting|needs?|for) (?:an? )?full ?time\b/g],
  ["full_time", /\b(?:vaga|regime|contratacao|jornada|periodo|trabalho) (?:em |de )?(?:tempo integral|clt)\b|\bregime clt\b|\bcontratacao clt\b/g],
  ["part_time", /\b(?:this|the) (?:position |role |job )?is (?:a )?part ?time\b/g],
  ["part_time", /\bpart ?time (?:position|role|job|opportunity|basis|hours|employment)\b/g],
  ["part_time", /\b(?:seeking|hiring|looking for|recruiting|needs?|for) (?:an? )?part ?time\b/g],
  ["part_time", /\b(?:vaga|regime|contratacao|jornada|periodo|trabalho) (?:em |de )?(?:meio periodo|tempo parcial)\b/g],
  ["contract", /\b(?:\d+|six|twelve|three|nine|eighteen|twenty four) months? (?:fixed term )?contract\b/g],
  ["contract", /\bcontract (?:position|role|job|opportunity|basis|to hire|engagement|assignment)\b/g],
  ["contract", /\b(?:this|the) (?:position |role |job )?is (?:a )?(?:contract|freelance|fixed term)\b/g],
  ["contract", /\bfreelance (?:position|role|project|basis|opportunity)\b|\bfixed term (?:contract|position|role)\b|\b(?:contratacao|regime|modelo|vaga) pj\b|\bcontratacao como pj\b/g],
  ["temporary", /\btemporary (?:position|role|job|assignment|contract|opportunity)\b|\bseasonal (?:position|role|job)\b|\b(?:vaga|contrato) temporari[oa]\b/g],
  ["internship", /\b(?:this|the) (?:position |role |job )?is (?:an? )?internship\b|\binternship (?:position|role|program|opportunity)\b|\b(?:vaga|programa|contrato) de estagio\b|\bvaga de estagio\b/g],
];

function proseEmployment(flatFolded: string): Set<Emp> {
  const out = new Set<Emp>();
  const v = flatFolded.replace(PERMANENT_CONTRACT, " ");
  for (const [e, re] of EMP_PROSE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(v)) && guard++ < 20) {
      const before = v.slice(Math.max(0, m.index - 14), m.index);
      if (NEGATION_BEFORE.test(before)) continue;
      out.add(e);
      break;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- location */

const WM_TOKEN_ONLY =
  /^(?:fully |100% |100 percent |totally |totalmente |100% )?(?:remote|remoto|remota|hybrid|hibrido|hibrida|on ?site|in office|in person|presencial|home ?office|teletrabalho|teletrabajo|work from home)(?: (?:work|working|role|position|model|only|first|friendly|eligible))?$/;
const PLACE_REJECT = /\b(?:you|we|our|will|must|are|is|be|with|your|candidate|candidates|should|can|work|working|office days?|days?|week|per|required|ability|willing|travel|open)\b/;

/**
 * Pulls the PLACE out of a location value and the work model it names. "Hybrid —
 * London" is place London and model hybrid; "Remote" is no place at all.
 */
function readLocation(value: string): { place?: string; models: Set<WorkModel>; ambiguous: boolean } {
  const models = new Set<WorkModel>();
  let ambiguous = false;
  let v = value.replace(/\s+/g, " ").trim();
  // Parentheticals that talk about the work model or office days are not places.
  v = v.replace(/\(([^)]{0,60})\)/g, (_m, inner: string) => {
    const f = fold(inner);
    const found = workModelsIn(f);
    if (found.size || /\bdays?\b|\bdias\b|\bdias\b/.test(f)) {
      found.forEach((x) => models.add(x));
      return " ";
    }
    return ` (${inner}) `;
  });
  if (/\s\/\s|\bor\b|\bou\b|\bo\b|\be\/ou\b/i.test(v) && workModelsIn(fold(v)).size > 0) ambiguous = true;
  const parts = v
    .split(/\s*(?:\||;|\s[-–—]\s|\s\/\s|,\s|:\s)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const keep: string[] = [];
  for (const p0 of parts) {
    let p = p0;
    // "Remote (US)", "Hybrid (London)": the model, then the place.
    const inner = /^([^()]{2,30}?)\s*\(([^()]{2,60})\)$/.exec(p);
    if (inner && WM_TOKEN_ONLY.test(fold(inner[1]!))) {
      workModelsIn(fold(inner[1]!)).forEach((x) => models.add(x));
      p = inner[2]!.trim();
    }
    const f = fold(p);
    if (WM_TOKEN_ONLY.test(f)) {
      workModelsIn(f).forEach((x) => models.add(x));
      continue;
    }
    keep.push(p);
  }
  let place = keep.join(", ").replace(/\s+/g, " ").replace(/[\s,;:|\-–—]+$/g, "").replace(/^[\s,;:|\-–—]+/g, "").trim();
  if (
    place.length < 2 ||
    place.length > 80 ||
    place.split(" ").length > 9 ||
    !/[A-Za-zÀ-ÿ]/.test(place) ||
    /[.!?]\s/.test(place) ||
    /[.!?]$/.test(place) ||
    PLACE_REJECT.test(fold(place)) ||
    /https?:|@/.test(place) ||
    /\d{3,}/.test(place.replace(/\b\d{4,5}(?:-\d{3,4})?\b/g, "")) ||
    NON_TITLE_VALUES.test(place)
  ) {
    return { models, ambiguous };
  }
  return { place, models, ambiguous };
}

/* --------------------------------------------------------------- seniority */

const SENIORITY_RANK: BlueprintSeniority[] = ["intern", "junior", "mid", "senior", "lead", "principal", "director", "executive"];

function seniorityFromWords(textFolded: string): BlueprintSeniority | null {
  const hits = new Set<BlueprintSeniority>();
  const w = ` ${textFolded.replace(/[^a-z0-9/ .]/g, " ")} `.replace(/\./g, " ").replace(/\s+/g, " ");
  const has = (re: RegExp) => re.test(w);
  if (has(/ (?:vp|svp|evp|vice president|chief|cxo|c level|ceo|cto|cfo|coo|cmo|cio|cpo|president|managing director|diretor executivo|vicepresidente|vice presidente) /)) hits.add("executive");
  if (has(/ (?:director|head of|diretor|diretora|directora|director a|vp of) /) && !has(/ (?:director of photography) /)) hits.add("director");
  if (has(/ (?:principal|distinguished) /)) hits.add("principal");
  if (has(/ (?:lead|tech lead|team lead|lider|lider tecnico|jefe de equipo|technical lead) /) && !has(/ lead (?:generation|gen|gen\w*|developer|qualification|nurturing)/)) hits.add("lead");
  if (has(/ (?:senior|sr|sênior|senior|sr\.) /)) hits.add("senior");
  if (has(/ (?:mid|mid level|midlevel|intermediate|intermediario|intermediaria|pleno|plena|semi senior|semisenior|ssr|semi sr|intermedio|intermedia) /)) hits.add("mid");
  if (has(/ (?:junior|jr|entry level|entry|graduate|juniors|jnr) /) && !has(/ graduate (?:program|school)/)) hits.add("junior");
  if (has(/ (?:intern|interns|internship|estagiario|estagiaria|estagio|pasante|becario|becaria) /)) hits.add("intern");
  if (hits.size === 0) return null;
  const arr = [...hits];
  // "Junior/Senior Developer" says both: no answer.
  const low = arr.filter((h) => h === "intern" || h === "junior" || h === "mid");
  const high = arr.filter((h) => h === "senior" || h === "lead" || h === "principal" || h === "director" || h === "executive");
  if (low.length && high.length) return null;
  if (low.length > 1) return low.length === 2 && low.includes("intern") && low.includes("junior") ? "intern" : null;
  if (low.length === 1) return low[0]!;
  // "Senior Lead", "Senior Director": the higher rank is the role.
  return arr.sort((a, b) => SENIORITY_RANK.indexOf(b) - SENIORITY_RANK.indexOf(a))[0]!;
}

/* ---------------------------------------------------------- compensation */

type CurrencyCode = "USD" | "EUR" | "GBP" | "BRL" | "CAD" | "AUD";
type PeriodCode = "year" | "month" | "hour";

const CUR_ANCHOR = /US\$|CA\$|AU\$|R\$|C\$|A\$|\$|€|£|\b(?:USD|EUR|GBP|BRL|CAD|AUD)\b/g;
const SYMBOL_CODE: Record<string, CurrencyCode> = {
  "US$": "USD", "CA$": "CAD", "C$": "CAD", "AU$": "AUD", "A$": "AUD", "R$": "BRL", "€": "EUR", "£": "GBP", "$": "USD",
};
const AMOUNT_RE = /^(\d{1,3}(?:[.,\u202f ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s?(k|mil|m|mm|bn|b|million|millions|milhao|milhoes|billion)\b|\s?(k)(?![a-z]))?/i;
const RANGE_SEP_RE = /^(?:\s*[-–—−~]\s*|\s+(?:to|a|ate|à|até|and|y|e|hasta)\s+)/i;
const AMBIGUOUS_DOLLAR =
  /\b(?:cad|aud|nzd|sgd|hkd|mxn|ars|clp|cop|pesos?|canadian|australian|canada|australia|toronto|vancouver|montreal|ottawa|calgary|sydney|melbourne|brisbane|perth|auckland|new zealand|mexico|argentina|chile|colombia|singapore|hong kong)\b/;
const COMP_WORD = /\b(?:salary|salaries|compensation|pay|paid|wage|wages|base|rate|remuneration|package|earn|earning|earnings|income|range|salario|salarial|remuneracao|sueldo|ganhos|faixa|bolsa|pagamento|honorarios|retribucion|offer|offering|offered|oferecemos|ofrecemos|paying|we pay|you ll make)\b/;
const COMP_WORD_AFTER = /^[^a-z0-9]{0,3}(?:\w+ ){0,2}(?:salary|base|gross|compensation|pay|salario|sueldo)\b/;
const BAD_BEFORE =
  /\b(?:bonus|stipend|allowance|budget|relocation|reimbursement|commission|equity|funding|funded|raised|revenue|valuation|ote|on target earnings|overtime|differential|referral|signing|sign on|tuition|perk|perks|bonificacao|auxilio|comissao|plr|vale|premio|gratificacao|bono|comision|incentive|incentives|credit|discount|fee|fees|deductible|insurance|401k|match|savings|loan)\W+(?:\w+\W+){0,3}$/;
const BAD_AFTER =
  /^(?:\w+ )?(?:bonus|stipend|allowance|budget|relocation|reimbursement|commission|equity|funding|revenue|valuation|signing|referral|in sales|in revenue|in funding|credit|discount|fee|incentive|auxilio|bonificacao|bono)\b/;
const BAD_FORM = /\b(?:million|billion|trillion)\b/;

type Cand = {
  idx: number;
  min?: number;
  max?: number;
  currency: CurrencyCode;
  period?: PeriodCode;
  explicitPeriod: boolean;
  isRange: boolean;
  labelled: boolean;
  qualifier: "upto" | "from" | null;
  dollarAmbiguous: boolean;
};

/** "8.000" is eight thousand, "45.50" is forty-five and a half, "90,000" is ninety thousand. */
function parseAmount(num: string, suffix?: string): number | null {
  let s = num.replace(/[\u202f ]/g, "");
  let value: number;
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (lastSep < 0) {
    value = Number(s);
  } else {
    const tail = s.slice(lastSep + 1);
    const head = s.slice(0, lastSep);
    const otherSep = /[.,]/.test(head);
    if (tail.length === 3 && !(otherSep && /[.,]\d{1,2}$/.test(s) && false)) {
      // Thousands separator, unless an earlier separator proves this is the decimal point.
      value = Number(s.replace(/[.,]/g, ""));
    } else if (tail.length <= 2) {
      value = Number(head.replace(/[.,]/g, "") + "." + tail);
    } else {
      return null;
    }
  }
  if (!Number.isFinite(value)) return null;
  const sfx = (suffix ?? "").toLowerCase();
  if (sfx === "k") value *= 1000;
  else if (sfx === "mil") value *= 1000;
  else if (sfx) return null; // m / million / billion: funding or revenue, not pay
  return value;
}

function periodFrom(tailFolded: string, headFolded: string): { period?: PeriodCode; explicit: boolean; unsupported: boolean } {
  const tail = tailFolded.slice(0, 36);
  const m =
    /(?:\/|\bper\b|\ba\b|\ban\b|\bpor\b|\bao\b|\bal\b|\bp\.?|\beach\b|\bevery\b|\bla\b|\bcada\b)\s*(hr|hrs|hour|hours|hora|horas|h|yr|year|years|ano|anos|annum|month|months|mo|mes|meses|wk|week|weeks|semana|day|days|dia|diaria|shift|project|projeto)\b|\b(hourly|yearly|annually|annual|monthly|mensal|mensais|mensual|mensuales|anual|anuales|semanal|weekly|daily|biweekly|bi weekly|pa|p a)\b/.exec(
      tail,
    );
  const map = (w: string): PeriodCode | "bad" => {
    if (/^(?:hr|hrs|hour|hours|hora|horas|h|hourly)$/.test(w)) return "hour";
    if (/^(?:yr|year|years|ano|anos|annum|yearly|annually|annual|anual|anuales|pa|p a)$/.test(w)) return "year";
    if (/^(?:month|months|mo|mes|meses|monthly|mensal|mensais|mensual|mensuales)$/.test(w)) return "month";
    return "bad";
  };
  const periodOfSomethingElse =
    m && /^\s*(?:bonus|commission|incentive|stipend|allowance|raise|increase|review|leave|holiday|vacation|pto|performance)/.test(tail.slice(m.index + m[0].length));
  if (m && !periodOfSomethingElse) {
    const word = m[1] ?? m[2] ?? "";
    const p = map(word);
    if (p === "bad") return { explicit: true, unsupported: true };
    return { period: p, explicit: true, unsupported: false };
  }
  const head = headFolded.slice(-48);
  const h = /\b(annual|yearly|hourly|monthly|mensal|anual|per hour|por hora|per year|per month|por mes|por ano)\b[^.]{0,22}$/.exec(head);
  if (h) {
    const p = map(h[1]!.replace(/^per |^por /, ""));
    if (p !== "bad") return { period: p, explicit: true, unsupported: false };
  }
  return { explicit: false, unsupported: false };
}

function plausible(c: { min?: number; max?: number; period?: PeriodCode }): boolean {
  const vals = [c.min, c.max].filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return false;
  for (const v of vals) {
    if (v <= 0) return false;
    if (c.period === "hour" && (v < 4 || v > 1_500)) return false;
    if (c.period === "month" && (v < 300 || v > 250_000)) return false;
    if (c.period === "year" && (v < 3_000 || v > 5_000_000)) return false;
    if (!c.period && (v < 3_000 || v > 5_000_000)) return false;
  }
  if (vals.length === 2 && vals[0]! > vals[1]!) return false;
  return true;
}

const NUM = String.raw`(\d{1,3}(?:[.,\u202f ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const SFX = String.raw`(?:\s?(k|mil)\b)?`;
const SEP = String.raw`(?:\s*[-–—−~]\s*|\s+(?:to|a|ate|à|até|and|y|e|hasta)\s+)`;
/** Amounts that END right before a currency token: "90,000 - 110,000 USD", "50.000 € - 60.000 ". */
const BACK_RE = new RegExp(
  `${NUM}${SFX}(?:\\s*[€£]?${SEP}[$€£]?\\s*${NUM}${SFX})?\\s*$`,
  "i",
);

type Read = { lo: number; hi?: number; end: number; from: number; sfx1?: string };

function readForward(flat: string, pos: number): Read | null {
  const lead = /^\s{0,2}/.exec(flat.slice(pos, pos + 2))![0].length;
  const f1 = AMOUNT_RE.exec(flat.slice(pos + lead, pos + lead + 40));
  if (!f1) return null;
  const s1 = (f1[2] ?? f1[3]) as string | undefined;
  const a1 = parseAmount(f1[1]!, s1);
  if (a1 === null) return null;
  let end = pos + lead + f1[0].length;
  let lo = a1;
  let hi: number | undefined;
  const rest = flat.slice(end, end + 60);
  const sep = RANGE_SEP_RE.exec(rest);
  if (sep) {
    let r = rest.slice(sep[0].length);
    const sym2 = /^(?:US\$|CA\$|AU\$|R\$|C\$|A\$|\$|€|£|USD|EUR|GBP|BRL|CAD|AUD)\s{0,2}/.exec(r);
    if (sym2) r = r.slice(sym2[0].length);
    const f2 = AMOUNT_RE.exec(r);
    if (f2) {
      const s2 = (f2[2] ?? f2[3]) as string | undefined;
      const a2 = parseAmount(f2[1]!, s2);
      if (a2 !== null) {
        hi = a2;
        end += sep[0].length + (sym2 ? sym2[0].length : 0) + f2[0].length;
        // "$90 - 110k": the partner carries the k.
        if (!s1 && s2 && lo < 1000 && lo * 1000 <= hi) lo *= 1000;
      }
    }
  }
  return { lo, hi, end, from: pos + lead, sfx1: s1 };
}

function readBackward(flat: string, tokenStart: number, tokenEnd: number, token: string): Read | null {
  const from = Math.max(0, tokenStart - 60);
  const back = flat.slice(from, tokenStart);
  const b = BACK_RE.exec(back);
  if (!b) return null;
  const s1 = b[2]?.toLowerCase();
  const a1 = parseAmount(b[1]!, s1);
  if (a1 === null) return null;
  let lo = a1;
  let hi: number | undefined;
  if (b[3]) {
    const s2 = b[4]?.toLowerCase();
    const a2 = parseAmount(b[3], s2);
    if (a2 === null) return null;
    hi = a2;
    if (!s1 && s2 && lo < 1000 && lo * 1000 <= hi) lo *= 1000;
  }
  let end = tokenEnd;
  if (hi === undefined && token === "€") {
    // "50.000 € - 60.000 €": the partner follows the first symbol.
    const rest = flat.slice(tokenEnd, tokenEnd + 40);
    const sep = RANGE_SEP_RE.exec(rest);
    if (sep) {
      const f2 = AMOUNT_RE.exec(rest.slice(sep[0].length));
      const a2 = f2 ? parseAmount(f2[1]!, (f2[2] ?? f2[3]) as string | undefined) : null;
      if (f2 && a2 !== null) {
        hi = a2;
        end = tokenEnd + sep[0].length + f2[0].length;
        const sym = /^\s?€/.exec(flat.slice(end, end + 3));
        if (sym) end += sym[0].length;
        if (!s1 && f2[2] && lo < 1000 && lo * 1000 <= hi) lo *= 1000;
      }
    }
  }
  return { lo, hi, end, from: from + b.index };
}

function findCompensation(flat: string, flatFolded: string): Cand[] {
  const out: Cand[] = [];
  CUR_ANCHOR.lastIndex = 0;
  let anchors = 0;
  let m: RegExpExecArray | null;
  const folded = flatFolded.length === flat.length ? flatFolded : flat.toLowerCase();
  while (anchors < MAX_CURRENCY_ANCHORS && (m = CUR_ANCHOR.exec(flat))) {
    anchors += 1;
    const token = m[0];
    const start = m.index;
    const after = start + token.length;
    const isCode = /^[A-Z]{3}$/.test(token);
    let currency: CurrencyCode = isCode ? (token as CurrencyCode) : SYMBOL_CODE[token]!;

    let read = readForward(flat, after);
    if (!read && (isCode || token === "€")) read = readBackward(flat, start, after, token);
    if (!read) continue;
    let tailFrom = read.end;

    // A code right after the numbers fixes the currency: "$90,000 CAD".
    let dollarAmbiguous = false;
    if (token === "$") {
      const codeAfter = /^\s?(USD|EUR|GBP|BRL|CAD|AUD)\b/.exec(flat.slice(tailFrom, tailFrom + 8));
      const codeBefore = /(USD|CAD|AUD|EUR|GBP|BRL)\s?$/.exec(flat.slice(Math.max(0, start - 8), start));
      if (codeAfter) {
        currency = codeAfter[1] as CurrencyCode;
        tailFrom += codeAfter[0].length;
      } else if (codeBefore) currency = codeBefore[1] as CurrencyCode;
      else dollarAmbiguous = true;
    }

    const headFolded = folded.slice(Math.max(0, read.from - 70), read.from);
    const { period, explicit, unsupported } = periodFrom(folded.slice(tailFrom, tailFrom + 40), headFolded);
    if (unsupported) {
      CUR_ANCHOR.lastIndex = Math.max(CUR_ANCHOR.lastIndex, tailFrom);
      continue;
    }
    const plus = read.hi === undefined && /^\s?\+(?!\d)|^\s?(?:and up|and above|e acima|y mas)\b/i.test(flat.slice(read.end, read.end + 12));
    const qualHead = headFolded.slice(-22);
    let qualifier: Cand["qualifier"] = null;
    if (/\b(?:up to|ate|hasta|max|maximum|maximo|no maximo)\W*(?:of\W*)?$/.test(qualHead)) qualifier = "upto";
    else if (/\b(?:from|starting at|starting from|starts at|a partir de|desde|min|minimum|minimo|at least)\W*$/.test(qualHead) || plus) qualifier = "from";

    const cand: Cand = {
      idx: read.from,
      currency,
      period,
      explicitPeriod: explicit,
      isRange: read.hi !== undefined,
      labelled: false,
      qualifier,
      dollarAmbiguous,
    };
    if (read.hi !== undefined) {
      cand.min = read.lo;
      cand.max = read.hi;
    } else if (qualifier === "upto") cand.max = read.lo;
    else if (qualifier === "from") cand.min = read.lo;
    else {
      cand.min = read.lo;
      cand.max = read.lo;
    }
    finishCand(cand, folded, Math.max(0, read.from - 80), tailFrom);
    // Skip past what was just read so "$90k - $110k" is one candidate, not two.
    CUR_ANCHOR.lastIndex = Math.max(CUR_ANCHOR.lastIndex, tailFrom);
    out.push(cand);
  }
  return out.filter((c) => c.min !== undefined || c.max !== undefined);
}

/** Decides if a candidate is pay, by what is written around it. Mutates `labelled`. */
function finishCand(c: Cand, folded: string, from: number, to: number): void {
  // "Bolsa auxílio" is how a Brazilian internship states its pay.
  const before = folded.slice(from, c.idx).replace(/\bbolsa auxilio\b/g, "bolsa");
  const afterText = folded.slice(to, to + 40);
  const ahead = folded.slice(to, to + 30);
  c.labelled = COMP_WORD.test(before.slice(-80)) || COMP_WORD_AFTER.test(afterText);
  const bad =
    BAD_BEFORE.test(before.slice(-45)) ||
    badAfter(afterText) ||
    BAD_FORM.test(ahead.slice(0, 14)) ||
    /\b(?:ote|on target earnings)\b/.test(before.slice(-30));
  if (bad) {
    c.min = undefined;
    c.max = undefined;
  }
}

/** "$5,000 relocation bonus" is not pay; "$60,000 per year plus commission" is. */
function badAfter(afterText: string): boolean {
  if (/^\s*[+&]/.test(afterText)) return false;
  const a = afterText
    .replace(/^\W{0,3}(?:(?:per|a|an|por|ao|al)\s+\w+|\/\s*\w+|annually|annual|yearly|monthly|hourly)?\W*/, "")
    .trim();
  if (/^(?:plus|and|with|\+|mais|e|y|mas)\b/.test(a)) return false;
  return BAD_AFTER.test(a);
}

type CompOut = {
  min?: number;
  max?: number;
  currency: CurrencyCode;
  period?: PeriodCode;
  conf: BlueprintConfidence;
};

function resolveCompensation(cands: Cand[], flatFolded: string): CompOut | null {
  const dollarBlocked = AMBIGUOUS_DOLLAR.test(flatFolded);
  const good = cands.filter((c) => {
    if (c.min === undefined && c.max === undefined) return false;
    if (c.dollarAmbiguous && dollarBlocked) return false;
    if (c.period === undefined && !c.labelled) return false;
    // Pay needs a word that says so, or the shape of a salary range ("$90k–$110k per year").
    const salaryShaped = c.labelled || (c.isRange && c.explicitPeriod) || (c.qualifier !== null && c.explicitPeriod);
    if (!salaryShaped) return false;
    // A period nobody wrote must not be guessed from magnitude for non-annual pay.
    if (c.period === undefined) {
      const vals = [c.min, c.max].filter((v): v is number => v !== undefined);
      const annualish = vals.every((v) => v >= 15_000);
      if (!annualish || c.currency === "BRL") return false;
    }
    return plausible({ min: c.min, max: c.max, period: c.period });
  });
  if (good.length === 0) return null;
  const key = (c: Cand) => `${c.min ?? ""}|${c.max ?? ""}|${c.currency}|${c.period ?? "year?"}`;
  const distinct = new Map<string, Cand>();
  for (const c of good) if (!distinct.has(key(c))) distinct.set(key(c), c);
  let pick: Cand | undefined;
  if (distinct.size === 1) pick = [...distinct.values()][0];
  else {
    // Several different figures: only trust one that is clearly THE salary line.
    const labelled = [...distinct.values()].filter((c) => c.labelled && c.isRange);
    if (labelled.length === 1) pick = labelled[0];
  }
  if (!pick) return null;
  const period: PeriodCode | undefined = pick.period ?? "year";
  return {
    min: pick.min,
    max: pick.max,
    currency: pick.currency,
    period,
    conf: pick.labelled && pick.explicitPeriod ? "high" : "medium",
  };
}

/* --------------------------------------------------------------- start date */

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, janeiro: 1, enero: 1, ene: 1,
  february: 2, feb: 2, fevereiro: 2, fev: 2, febrero: 2,
  march: 3, mar: 3, marco: 3, marzo: 3,
  april: 4, apr: 4, abril: 4, abr: 4,
  may: 5, mai: 5, maio: 5, mayo: 5,
  june: 6, jun: 6, junho: 6, junio: 6,
  july: 7, jul: 7, julho: 7, julio: 7,
  august: 8, aug: 8, agosto: 8, ago: 8,
  september: 9, sep: 9, sept: 9, set: 9, setembro: 9, septiembre: 9, setiembre: 9,
  october: 10, oct: 10, out: 10, outubro: 10, octubre: 10,
  november: 11, nov: 11, novembro: 11, noviembre: 11,
  december: 12, dec: 12, dez: 12, dezembro: 12, diciembre: 12, dic: 12,
};

function isoIfValid(y: number, m: number, d: number, now: Date): string | null {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (dt.getTime() < today) return null;
  if (y > now.getUTCFullYear() + 3) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** An ISO date only when the text leaves no room for another reading. */
export function parseUnambiguousDate(value: string, now: Date): string | null {
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(value);
  if (iso) return isoIfValid(+iso[1]!, +iso[2]!, +iso[3]!, now);
  const v = fold(value.replace(/\([^)]*\)/g, " ")).replace(/[,.]/g, (c) => (c === "." ? "." : " "));
  let m = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(v);
  if (m) return isoIfValid(+m[1]!, +m[2]!, +m[3]!, now);
  // 1 Nov 2026, 1st of November 2026, 1 de novembro de 2026
  m = /\b(\d{1,2})(?:st|nd|rd|th|o|º)?\s+(?:of\s+|de\s+)?([a-z]{3,10})\s+(?:of\s+|de\s+|del\s+)?(20\d{2})\b/.exec(v);
  if (m && MONTHS[m[2]!] !== undefined) return isoIfValid(+m[3]!, MONTHS[m[2]!]!, +m[1]!, now);
  // November 1, 2026
  m = /\b([a-z]{3,10})\s+(\d{1,2})(?:st|nd|rd|th)?\s+(20\d{2})\b/.exec(v);
  if (m && MONTHS[m[1]!] !== undefined) return isoIfValid(+m[3]!, MONTHS[m[1]!]!, +m[2]!, now);
  // 25/11/2026, 11/25/2026, 01.11.2026
  m = /\b(\d{1,2})([/.-])(\d{1,2})\2(20\d{2})\b/.exec(v);
  if (m) {
    const a = +m[1]!;
    const b = +m[3]!;
    const y = +m[4]!;
    if (m[2] === ".") return isoIfValid(y, b, a, now);
    if (a > 12 && b <= 12) return isoIfValid(y, b, a, now);
    if (b > 12 && a <= 12) return isoIfValid(y, a, b, now);
    if (a === b) return isoIfValid(y, a, b, now);
  }
  return null;
}

/* ----------------------------------------------------------- work authorisation */

const NO_SPONSOR: RegExp[] = [
  /\b(?:no|without|not|unable to|cannot|can not|can'?t|will not|won'?t|do not|does not|don'?t|doesn'?t|not able to|not in a position to|not currently able to) (?:\w+ ){0,3}(?:sponsor|sponsorship)\b/,
  /\b(?:sponsorship|visa sponsorship|work visas?) (?:is |are )?(?:not (?:available|offered|provided|possible)|unavailable)\b/,
  /\bunable to (?:offer|provide) (?:\w+ ){0,2}(?:visa|sponsorship)\b/,
  /\b(?:must|need to|required to|should) (?:already )?(?:be|have) (?:legally |currently )?(?:authori[sz]ed|eligible|permitted|entitled) to work\b/,
  /\bright to work in (?:the )?(?:uk|united kingdom|eu|us|usa|u s|canada|ireland|australia)\b.{0,30}\b(?:required|must|essential)\b|\b(?:must|need to|required to) have (?:the )?(?:existing |full )?right to work\b/,
  /\bwork authori[sz]ation (?:is )?(?:required|necessary|mandatory)\b/,
  /\bnao (?:oferecemos|fornecemos|patrocinamos|ha) (?:\w+ ){0,3}(?:patrocinio|visto)\b|\bsem patrocinio de visto\b|\b(?:necessario|obrigatorio|precisa) (?:ter )?(?:autorizacao|permissao) (?:de |para )?trabalh/,
  /\bno (?:ofrecemos|brindamos|patrocinamos) (?:\w+ ){0,3}(?:patrocinio|visa)\b|\bsin patrocinio de visa\b|\bdebe(?:s)? (?:contar con|tener) (?:autorizacion|permiso) (?:legal )?(?:para trabajar|de trabajo)\b/,
];
const YES_SPONSOR: RegExp[] = [
  /\b(?:we|company|employer) (?:can|will|do|may|are able to|offer|provide)(?: (?!not\b|never\b|unable\b)\w+){0,3} (?:visa )?sponsor(?:ship)?\b/,
  /\bvisa sponsorship (?:is |may be |will be )?(?:available|offered|provided|possible|considered)\b/,
  /\b(?:sponsorship|relocation and visa|visa support) (?:is |may be |will be )?(?:available|provided|offered)\b/,
  /\bsponsorship (?:for the right|can be)\b/,
  /\boferecemos (?:\w+ ){0,3}(?:patrocinio|suporte de visto)\b/,
  /\bofrecemos (?:\w+ ){0,3}(?:patrocinio|visa)\b/,
];

/* ---------------------------------------------------------------- sections */

const SEC_MUST = [
  /^(?:(?:the|our|key|core|minimum|basic|mandatory|essential|required|general|technical|desired and required) )*(?:requirements?|qualifications?|skills(?: (?:and|&) (?:experience|qualifications|requirements))?|must haves?|musts?)(?: (?:and|&) (?:qualifications?|skills|experience|requirements?))?$/,
  /^(?:what )?(?:you(?: ll| will)? need|you bring|you ll bring|you will bring|we re looking for|we are looking for|we look for|what we re looking for|what we are looking for|what we need|what you have|what you bring|what you ll bring|what you ll need to succeed|what you ll need to be successful)$/,
  /^(?:who you are|about you|you have|you will have|you ll have|you should have|you must have|your profile|your background|your skills|your experience|your qualifications|the ideal candidate|ideal candidate|to be successful|to be successful in this role|what makes you a great fit|what will make you successful|skills and experience|skills & experience|about the candidate|candidate profile|candidate requirements|minimum qualifications|basic qualifications|required qualifications|required skills|key skills|must have skills|must have|essential|essentials|essential criteria|essential skills|essential requirements|key requirements)$/,
  /^(?:requisitos(?: (?:e|y) (?:qualificacoes|qualificaciones|habilidades|conhecimentos|competencias|experiencia))?|requisitos obrigatorios|requisitos minimos|requisitos basicos|requisitos do cargo|requisitos da vaga|requisitos del puesto|requisitos del candidato|requerimientos|requerimientos del puesto|qualificacoes|qualificacoes e requisitos|qualificaciones|pre requisitos|habilidades|habilidades requeridas|competencias|competencias tecnicas|conhecimentos|conhecimentos tecnicos|conocimientos|perfil|perfil do candidato|perfil da vaga|perfil buscado|perfil del candidato|o que esperamos|o que buscamos|o que procuramos|o que voce precisa ter|o que voce precisa saber|o que voce precisa|tu perfil|que buscamos|lo que buscamos|que necesitas|que necesitamos|lo que necesitas|el candidato ideal|o candidato ideal|obrigatorio|obrigatorios|experiencia requerida|indispensavel|indispensaveis)$/,
];
const SEC_NICE = [
  /^(?:nice to haves?|nice to have|desirable criteria|nice to have skills|preferred(?: (?:qualifications|skills|experience|requirements))?|desired(?: (?:qualifications|skills|experience))?|desirable(?: (?:skills|qualifications|experience))?|bonus(?: points| skills| qualifications)?|bonus if you have|plus(?:es)?|good to haves?|good to have|extra credit|it would be (?:great|nice) if(?: you)?|even better|great to have|a plus|additional(?: qualifications| skills)?|what would make you stand out|what will set you apart|standout qualities|stand out|diferencial|diferenciais|desejavel|desejaveis|requisitos desejaveis|sera um diferencial|ser um diferencial|como diferencial|deseable|deseables|se valorara|valorable|requisitos deseables|conocimientos deseables|conocimientos valorables|sera valorable|es un plus|plus)$/,
];
const SEC_OTHER =
  /^(?:responsibilities|duties|key responsibilities|main responsibilities|what you ll do|what you will do|what you ll be doing|your role|the role|role overview|your responsibilities|about (?:the )?(?:role|job|us|company|team|position|opportunity)|who we are|our (?:mission|culture|values|team|story|company|benefits)|benefits(?: (?:and|&) perks)?|perks|perks (?:and|&) benefits|what we offer|what s in it for you|what we can offer|why join us|why you ll love working here|why us|compensation(?: (?:and|&) benefits)?|salary|pay|how to apply|apply|apply now|application process|equal opportunity(?: employer)?|eeo|diversity(?: (?:and|&) inclusion)?|location|schedule|hours|overview|summary|job summary|position summary|job description|description|company|mission|culture|values|the team|our team|the opportunity|about the job|day to day|a day in the life|growth|development|interview process|hiring process|selection process|next steps|contact|responsabilidades|atividades|principais atividades|atribuicoes|o que voce vai fazer|o que voce fara|sobre (?:nos|a empresa|a vaga|o cargo|a oportunidade)|sobre|beneficios|nossos beneficios|oferecemos|o que oferecemos|remuneracao|como se candidatar|processo seletivo|etapas do processo|funciones|principales funciones|que haras|tareas|actividades|sobre nosotros|acerca de|ofrecemos|que ofrecemos|como aplicar|proceso de seleccion|sobre el puesto|descripcion del puesto|descricao da vaga|descricao|descripcion|resumen|horario|jornada|local|ubicacion|localizacao)$/;

type SecKind = { kind: "must" | "nice" | "other" | "unknown" };

function headingKind(t: string, md: boolean): SecKind | null {
  if (!t || t.length > 80) return null;
  if (/[.!?,;]$/.test(t)) return null;
  const words = t.split(" ").length;
  if (words > 9) return null;
  let f = fold(t)
    .replace(/[^a-z0-9&' ]/g, " ")
    .replace(/'/g, " ")
    .replace(/^\d+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  // "Requirements (must have)" / "Qualifications - preferred"
  const paren = /\(([^)]*)\)/.exec(t);
  if (paren && /nice|prefer|bonus|desir|plus|diferencial|desej|deseable/i.test(paren[1]!)) return { kind: "nice" };
  f = f.replace(/\bmust have\b$/, (m) => (f === m ? m : "")).trim();
  if (SEC_NICE.some((r) => r.test(f))) return { kind: "nice" };
  if (SEC_MUST.some((r) => r.test(f))) return { kind: "must" };
  if (SEC_OTHER.test(f)) return { kind: "other" };
  const caps = isAllCaps(t);
  if (md || caps || /:$/.test(t)) return { kind: "unknown" };
  return null;
}

const NICE_CUE =
  /\b(?:is|are|would be|will be|be) (?:a |an |considered a |considered an )?(?:plus|bonus|advantage|asset|big plus|nice to have|desirable|welcome|valued|beneficial|an advantage|a nice)\b|\bnice to have\b|\bpreferred\b|^preferably\b|\bdesirable\b|^ideally\b|\bbonus points?\b|\bhighly desirable\b|\bis an advantage\b|\bwould be (?:great|nice)\b|\bdiferencial\b|\bdesejavel\b|\bdeseable\b|\bse valora\b|\bsera un plus\b|\b(?:a|um|un) plus\b|\bbonus:/;

function trimItem(raw: string): string | null {
  let s = raw.replace(/\s+/g, " ").trim().replace(/^[-–—•*·\s]+/, "");
  s = s.replace(/[;,:\s]+$/g, "").replace(/\.$/, "").replace(/\s+(?:and|or|e|y|ou|o)$/i, "").trim();
  if (s.length > MAX_REQUIREMENT_CHARS) {
    const first = /^(.{20,118}?[.!?])\s/.exec(s + " ");
    if (first && first[1]!.length <= MAX_REQUIREMENT_CHARS) s = first[1]!.replace(/[.!?]$/, "");
    else {
      const slice = s.slice(0, MAX_REQUIREMENT_CHARS - 1);
      const cut = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "), slice.lastIndexOf(" – "), slice.lastIndexOf(" - "));
      if (cut >= 25) s = slice.slice(0, cut);
      else return null;
    }
  }
  s = s.replace(/[;,:\s]+$/g, "").trim();
  if (s.length < MIN_REQUIREMENT_CHARS || s.length > MAX_REQUIREMENT_CHARS) return null;
  if (!/[A-Za-zÀ-ÿ]{3}/.test(s)) return null;
  if (/^(?:https?:\/\/|www\.)/i.test(s)) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function readRequirements(lines: Ln[]): BlueprintRequirement[] {
  const items: BlueprintRequirement[] = [];
  const seen = new Set<string>();
  let section: "must" | "nice" | null = null;
  let cur: { text: string; tag: "must_have" | "nice_to_have" } | null = null;
  let lastWasBullet = false;
  const flush = () => {
    const c = cur;
    cur = null;
    if (!c) return;
    const text = trimItem(c.text);
    if (!text) return;
    const key = normalizeRequirementKey(text);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ text, tag: NICE_CUE.test(fold(text)) ? "nice_to_have" : c.tag });
  };
  const limit = Math.min(lines.length, MAX_LINES);
  for (let i = 0; i < limit; i += 1) {
    const ln = lines[i]!;
    if (ln.blank) {
      flush();
      lastWasBullet = false;
      continue;
    }
    if (!ln.bullet) {
      const kind = headingKind(ln.t, ln.md);
      if (kind) {
        flush();
        lastWasBullet = false;
        if (kind.kind === "must") section = "must";
        else if (kind.kind === "nice") section = "nice";
        else if (kind.kind === "other") section = null;
        else if (kind.kind === "unknown") {
          // A sub-heading ("Technical skills:") inside a requirements section keeps
          // the section open; an all-caps or markdown heading ends it.
          if (section && !ln.md && /:$/.test(ln.t) && !isAllCaps(ln.t)) {
            /* keep section */
          } else section = null;
        }
        continue;
      }
    }
    if (!section) continue;
    if (ln.bullet) {
      flush();
      cur = { text: ln.t, tag: section === "nice" ? "nice_to_have" : "must_have" };
      lastWasBullet = true;
      continue;
    }
    // A wrapped bullet: the PDF broke the line mid-sentence.
    if (cur && lastWasBullet) {
      const open: { text: string; tag: "must_have" | "nice_to_have" } = cur;
      const prev = open.text;
      const startsLower = /^[a-zà-ÿ0-9(,]/.test(ln.t);
      const prevOpen = /[,(&/-]$|\b(?:and|or|of|with|to|in|for|the|a|an|e|ou|de|com|em|para|y|o|la|el)$/i.test(prev);
      if (startsLower || prevOpen) {
        open.text = `${prev} ${ln.t}`;
        continue;
      }
    }
    flush();
    lastWasBullet = false;
  }
  flush();
  // Never hand the client more must-haves than the product itself advises.
  let musts = 0;
  const capped: BlueprintRequirement[] = [];
  for (const it of items) {
    if (it.tag === "must_have") {
      musts += 1;
      capped.push(musts > MAX_MUST_HAVES ? { text: it.text, tag: "nice_to_have" } : it);
    } else capped.push(it);
    if (capped.length >= MAX_REQUIREMENTS) break;
  }
  return capped;
}

/* ------------------------------------------------------------------ main */

type Put<T> = { value: T; confidence: BlueprintConfidence };

export function quickReadJd(text: string, opts: QuickReadOptions = {}): QuickReadResult {
  const empty: QuickReadResult = { blueprint: {}, requirements: [] };
  try {
    return quickReadUnsafe(text, opts);
  } catch {
    // The quick read is a convenience. It must never be the reason a page breaks.
    return empty;
  }
}

function quickReadUnsafe(text: string, opts: QuickReadOptions): QuickReadResult {
  const now = opts.now ?? new Date();
  const norm = normalizeJdText(text ?? "");
  if (norm.length < 3) return { blueprint: {}, requirements: [] };

  const lines = norm
    .split("\n", MAX_LINES)
    .map(prepLine);

  const bp: JdBlueprint = {};

  /* ---- labelled lines and headline tokens ---- */
  const st = {
    title: null as Put<string> | null,
    team: null as Put<string> | null,
    location: null as Put<string> | null,
    senLabel: null as Put<BlueprintSeniority> | null,
    startLabel: null as Put<string> | null,
    locationConflict: false,
    titleRaw: "",
  };
  const wmLabelled: Array<Set<WorkModel>> = [];
  const empLabelled: Set<Emp> = new Set();
  const wmHeadline = new Set<WorkModel>();

  const consider = (
    field: Field,
    value: string,
    li: number,
    pin: boolean,
  ): void => {
    const v = value.trim();
    if (!v) return;
    if (field === "title" || field === "titleWeak") {
      if (st.title || li >= HEADER_LINES) return;
      const ct = cleanTitle(v);
      if (!ct) return;
      if (field === "titleWeak" && !hasRoleNoun(ct) && !looksNamelike(ct)) return;
      if (field === "titleWeak" && /^(?:reports?|responsible|located|based)\b/i.test(ct)) return;
      st.title = { value: ct, confidence: "high" };
      st.titleRaw = v;
      return;
    }
    if (field === "team") {
      if (st.team || li >= LABEL_LINES) return;
      const cleaned = v.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      if (
        cleaned.length < 2 || cleaned.length > 60 || cleaned.split(" ").length > 6 ||
        /[.!?]/.test(cleaned) || /\d/.test(cleaned) || /^(?:n\/?a|none|tbd|various)$/i.test(cleaned) ||
        /^(?:you|we|our|the team|to|will|is|are)\b/i.test(cleaned) ||
        WM_TOKEN_ONLY.test(fold(cleaned)) || hasEmploymentOnly(cleaned)
      ) return;
      st.team = { value: cleaned, confidence: "high" };
      return;
    }
    if (field === "location") {
      if (li >= LABEL_LINES) return;
      const r = readLocation(v);
      if (r.models.size && !r.ambiguous) wmLabelled.push(r.models);
      else if (r.models.size && r.ambiguous) wmLabelled.push(new Set(["remote", "hybrid", "onsite"] as WorkModel[]));
      if (r.place && !r.ambiguous) {
        if (st.location && st.location.value !== r.place) st.locationConflict = true;
        else st.location = st.location ?? { value: r.place, confidence: pin ? "medium" : "high" };
      } else if (r.place && r.ambiguous) {
        // "London / Remote": say nothing about where.
        st.locationConflict = true;
      }
      return;
    }
    if (field === "attr") {
      if (li >= LABEL_LINES) return;
      const f = fold(v);
      const wms = workModelsIn(f);
      if (wms.size) wmLabelled.push(wms);
      for (const e of employmentIn(f)) empLabelled.add(e);
      return;
    }
    if (field === "seniority") {
      if (st.senLabel || li >= LABEL_LINES) return;
      const s = seniorityFromWords(fold(v));
      if (s) st.senLabel = { value: s, confidence: "high" };
      return;
    }
    if (field === "start") {
      if (st.startLabel || li >= LABEL_LINES) return;
      const iso = parseUnambiguousDate(v, now);
      if (iso) st.startLabel = { value: iso, confidence: "high" };
    }
  };

  const limit = Math.min(lines.length, LABEL_LINES);
  for (let i = 0; i < limit; i += 1) {
    const ln = lines[i]!;
    if (ln.blank) continue;
    if (ln.bullet && i >= HEADER_LINES) continue;
    // Several fields on one line: "Location: London | Type: Full-time".
    const segments = i < HEADER_LINES && /\s[|•·]\s/.test(ln.t) ? ln.t.split(/\s+[|•·]\s+/) : [ln.t];
    for (let si = 0; si < segments.length; si += 1) {
      const seg = segments[si]!.trim();
      if (!seg) continue;
      const lab = splitLabel(seg);
      if (lab) {
        let value = lab.value;
        // Value on the next line: "Location:\nLondon".
        if (!value) {
          let j = i + 1;
          while (j < lines.length && lines[j]!.blank && j < i + 2) j += 1;
          const nxt = lines[j];
          if (nxt && !nxt.blank && !nxt.bullet && !nxt.md && !splitLabel(nxt.t) && nxt.t.length <= 80) {
            value = nxt.t;
            if (si === segments.length - 1) lines[j] = { ...nxt, t: "", blank: true };
          }
        }
        consider(lab.field, value, i, ln.pin);
        continue;
      }
      if (ln.pin && si === 0) {
        consider("location", seg, i, true);
        continue;
      }
      // Headline tokens: a line that is nothing but "Remote", "Hybrid — London", "Full-time".
      if (i < 40 && seg.length <= 48 && !ln.bullet) {
        const f = fold(seg);
        const head = /^(remote|remoto|remota|hybrid|hibrido|hibrida|on ?site|presencial|fully remote|100% remote|100% remoto|home ?office)\b(.*)$/.exec(f);
        if (head && WM_TOKEN_ONLY.test(head[1]!.replace(/^(fully|100%)\s?/, "")) ) {
          const r = readLocation(seg);
          if (r.models.size === 1 && !r.ambiguous) {
            r.models.forEach((x) => wmHeadline.add(x));
            if (r.place && !st.location) st.location = { value: r.place, confidence: "medium" };
          }
          continue;
        }
        if (WM_TOKEN_ONLY.test(f)) {
          workModelsIn(f).forEach((x) => wmHeadline.add(x));
          continue;
        }
        if (/^(?:full ?time|part ?time|contract|permanent|temporary|internship|freelance|tempo integral|meio periodo|tiempo completo|medio tiempo)(?: (?:position|role|job))?$/.test(f)) {
          employmentIn(f).forEach((x) => empLabelled.add(x));
          continue;
        }
      }
    }
  }
  if (st.locationConflict) st.location = null;

  /* ---- title: labelled wins; otherwise the headline, with a role noun ---- */
  if (!st.title) {
    let seenOnlyShort = true;
    const maxScan = Math.min(lines.length, 16);
    let nonBlank = 0;
    for (let i = 0; i < maxScan && nonBlank < 4; i += 1) {
      const ln = lines[i]!;
      if (ln.blank) continue;
      nonBlank += 1;
      if (ln.bullet) break;
      const t = ln.t;
      const lab = splitLabel(t);
      if (lab) continue;
      if (COMPANY_SUFFIX.test(t) || /^(?:careers?|jobs?|vagas?|empleos?)\b/i.test(fold(t))) continue;
      const segs = t.split(/\s+\|\s+/);
      const candidate = segs[0]!.trim();
      const looks =
        candidate.length >= 3 && candidate.length <= 90 && !/[.!?:;,]$/.test(candidate) && hasRoleNoun(candidate);
      if (looks && seenOnlyShort) {
        const ct = cleanTitle(candidate);
        if (ct && hasRoleNoun(ct)) {
          st.title = { value: ct, confidence: "medium" };
          st.titleRaw = candidate;
          segs.slice(1).forEach((s) => {
            const f = fold(s);
            if (WM_TOKEN_ONLY.test(f)) workModelsIn(f).forEach((x) => wmHeadline.add(x));
            else if (/^(?:full ?time|part ?time|contract|permanent|temporary|internship|freelance)$/.test(f)) employmentIn(f).forEach((x) => empLabelled.add(x));
          });
          break;
        }
      }
      // A long sentence before any title: this is a company blurb, not a header.
      if (t.length > 70 || t.split(" ").length > 9 || /[.!?]$/.test(t)) seenOnlyShort = false;
      if (!seenOnlyShort) break;
    }
  }
  if (st.title) bp.title = st.title;
  if (st.team) bp.team = st.team;

  /* ---- seniority: from the label, else the title words ---- */
  if (st.senLabel) bp.seniority = st.senLabel;
  else if (st.title) {
    const s = seniorityFromWords(fold(st.title.value));
    if (s) bp.seniority = { value: s, confidence: "high" };
  }

  /* ---- flat text for prose evidence and salary ---- */
  const flat = norm.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ");
  const flatFolded = (() => {
    const f = fold(flat);
    return f;
  })();
  // `fold` collapses whitespace and hyphens; salary windows use a length-preserving fold.
  const flatLen = flat
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‐-―−]/g, " ");

  /* ---- work model ---- */
  {
    let resolved: Put<WorkModel> | null = null;
    const label = new Set<WorkModel>();
    let labelConflict = false;
    for (const set of wmLabelled) {
      if (set.size !== 1) labelConflict = true;
      set.forEach((x) => label.add(x));
    }
    for (const x of wmHeadline) label.add(x);
    if (!labelConflict && label.size === 1) resolved = { value: [...label][0]!, confidence: "high" };
    else if (label.size === 0) {
      const prose = proseWorkModels(flatFolded);
      if (prose.size === 1) resolved = { value: [...prose][0]!, confidence: "medium" };
    }
    if (resolved) bp.workModel = resolved;
  }

  /* ---- location (remote roles need none; never invent one) ---- */
  if (st.location) bp.location = st.location;

  /* ---- employment type ---- */
  {
    let kind = resolveEmployment(empLabelled);
    let conf: BlueprintConfidence = "high";
    if (!kind && empLabelled.size === 0) {
      const prose = proseEmployment(flatFolded);
      kind = resolveEmployment(prose);
      conf = "medium";
      if (!kind && st.title) {
        const t = st.titleRaw || st.title.value;
        const words = fold(t).split(/[^a-z0-9]+/);
        if (words.includes("intern") || words.includes("internship") || words.includes("estagiario") || words.includes("estagiaria") || words.includes("estagio")) {
          kind = "internship";
          conf = "high";
        } else {
          const suffix = /[(\[\-–—]\s*(contract|temporary|temp|freelance|part[- ]time|full[- ]time|fixed[- ]term)\s*[)\]]?\s*$/i.exec(t);
          if (suffix) kind = resolveEmployment(employmentIn(fold(suffix[1]!)));
          if (!kind && /^part[- ]time\b/i.test(t)) kind = "part_time";
          if (!kind && /^full[- ]time\b/i.test(t)) kind = "full_time";
        }
      }
    }
    if (kind) bp.employmentType = { value: kind, confidence: conf };
  }

  /* ---- compensation ---- */
  {
    const comp = resolveCompensation(findCompensation(flat, flatLen), flatFolded);
    if (comp) {
      if (comp.min !== undefined) bp.salaryMin = { value: Math.round(comp.min * 100) / 100, confidence: comp.conf };
      if (comp.max !== undefined) bp.salaryMax = { value: Math.round(comp.max * 100) / 100, confidence: comp.conf };
      bp.currency = { value: comp.currency, confidence: comp.conf };
      if (comp.period) bp.compensationPeriod = { value: comp.period, confidence: comp.conf };
    }
  }

  /* ---- start date ---- */
  if (st.startLabel) bp.targetStartDate = st.startLabel;
  else {
    const m =
      /\b(?:start(?:s|ing)? date is|start(?:s|ing)? on|starts?|begins?|beginning|to start|starting|inicio em|inicio previsto|comeca em|empieza el|fecha de inicio es)\s*(?:on |in |from |:)?\s*([0-9a-z .,/-]{6,32})/.exec(
        flatFolded,
      );
    if (m) {
      const iso = parseUnambiguousDate(m[1]!, now);
      if (iso) bp.targetStartDate = { value: iso, confidence: "medium" };
    }
  }

  /* ---- sponsorship ---- */
  {
    const no = NO_SPONSOR.some((r) => r.test(flatFolded));
    if (no) {
      const yes = YES_SPONSOR.some((r) => r.test(flatFolded));
      if (!yes) bp.requiresExistingWorkAuth = { value: true, confidence: "medium" };
    }
  }

  const requirements = readRequirements(lines);

  // Tidy: drop undefined keys (the JdBlueprint contract has none).
  for (const k of Object.keys(bp) as (keyof JdBlueprint)[]) if (bp[k] === undefined) delete bp[k];
  return { blueprint: bp, requirements };
}

function hasEmploymentOnly(v: string): boolean {
  return /^(?:full ?time|part ?time|contract|permanent|temporary|internship)$/.test(fold(v));
}
