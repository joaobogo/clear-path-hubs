/**
 * Term synonym layer for the deterministic scoring engine.
 *
 * Requirement keywords are written by humans ("Kubernetes"), CVs are written by
 * other humans ("k8s"). Matching only the literal token loses real evidence,
 * so every requirement term is expanded through this table before matching.
 *
 * Two hard rules:
 *  1. Expansion is one-way and explicit. There is no fuzzy/stemming step, so
 *     "java" can never reach "javascript" — they are separate canonical terms
 *     with disjoint alias sets.
 *  2. The table is data, not inference. Same table + same CV = same result,
 *     which is what the run's input hash and reproducibility promise depend on.
 *
 * Matching itself stays word-boundary based (see findTermMatches), so an alias
 * like "go" still cannot match inside "google".
 */

/** canonical term -> equivalent surface forms (all lowercase). */
const SYNONYM_GROUPS: Record<string, string[]> = {
  kubernetes: ["k8s", "kube"],
  javascript: ["js", "es6", "ecmascript"],
  typescript: ["ts"],
  postgresql: ["postgres", "psql"],
  "node.js": ["node", "nodejs"],
  react: ["react.js", "reactjs"],
  vue: ["vue.js", "vuejs"],
  angular: ["angular.js", "angularjs"],
  python: ["py"],
  "c#": ["csharp", "c sharp", ".net"],
  "c++": ["cpp", "cplusplus"],
  amazon: ["aws"],
  aws: ["amazon web services"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  terraform: ["tf", "hcl"],
  docker: ["containerisation", "containerization"],
  "ci/cd": ["cicd", "continuous integration", "continuous delivery", "continuous deployment"],
  sql: ["t-sql", "pl/sql", "ansi sql"],
  mongodb: ["mongo"],
  elasticsearch: ["elastic search", "opensearch"],
  kafka: ["apache kafka"],
  rabbitmq: ["rabbit mq", "amqp"],
  redis: ["valkey"],
  graphql: ["gql", "apollo"],
  rest: ["restful", "rest api", "http api"],
  grpc: ["protobuf", "protocol buffers"],
  machine: ["ml", "machine learning"],
  "machine learning": ["ml", "deep learning"],
  nlp: ["natural language processing"],
  qa: ["quality assurance", "quality engineering"],
  seo: ["search engine optimisation", "search engine optimization"],
  crm: ["salesforce", "hubspot"],
  erp: ["sap", "netsuite"],
  saas: ["software as a service"],
  b2b: ["business to business"],
  ux: ["user experience"],
  ui: ["user interface"],
  figma: ["sketch"],
  accounting: ["bookkeeping"],
  ifrs: ["international financial reporting standards"],
  gaap: ["generally accepted accounting principles"],
  aml: ["anti money laundering", "anti-money laundering"],
  kyc: ["know your customer"],
  ehr: ["electronic health record", "electronic health records", "emr"],
  hipaa: ["health insurance portability"],
  rn: ["registered nurse"],
  pms: ["property management system"],
  ota: ["online travel agency", "booking.com", "expedia"],
  haccp: ["hazard analysis critical control"],
  forklift: ["fork lift", "reach truck"],
  wms: ["warehouse management system"],
  cdl: ["commercial driver's license", "commercial drivers license"],
  osha: ["occupational safety and health"],
  scrum: ["agile", "kanban"],
  jira: ["atlassian"],
  git: ["github", "gitlab", "bitbucket"],
  linux: ["unix", "ubuntu", "debian"],
  excel: ["spreadsheets", "google sheets"],
  powerbi: ["power bi"],
  tableau: ["looker"],
  spanish: ["espanol", "español"],
  portuguese: ["portugues", "português"],
};

/** alias -> the terms it is evidence for. Built once from SYNONYM_GROUPS. */
const EXPANSION: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const add = (key: string, value: string) => {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  };
  for (const [canonical, aliases] of Object.entries(SYNONYM_GROUPS)) {
    for (const alias of aliases) {
      add(canonical, alias);
      // Symmetry: a requirement written as the alias should also match the
      // canonical spelling in the CV.
      add(alias, canonical);
    }
  }
  return map;
})();

/**
 * Every surface form a requirement term should be matched against, the term
 * itself first. Order is stable so evidence trails stay reproducible.
 */
export function expandTerm(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const extras = EXPANSION.get(t);
  if (!extras) return [t];
  return [t, ...[...extras].sort()];
}

/** True when the two terms are declared equivalent (used by tests and review UI). */
export function areSynonyms(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left === right) return true;
  return EXPANSION.get(left)?.has(right) === true;
}

/** Exposed for tests: the raw table, so drift is visible in review. */
export const SYNONYM_TABLE = SYNONYM_GROUPS;
