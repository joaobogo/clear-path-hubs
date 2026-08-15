// Role-fit rediscovery: which already-screened candidates fit a new role.
// Everything returned is derived from real records — screening dates, prior
// stages, recorded skills. Nothing is invented or estimated.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { seniorityFromYears } from "@/lib/candidate-seniority";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type RoleFitReason = {
  kind: "skill" | "seniority" | "location" | "progress" | "pool";
  label: string;
};

export type RoleFitCandidateDTO = {
  candidate_profile_id: string;
  display_name: string;
  headline: string | null;
  location: string | null;
  seniority: string | null;
  /** When this candidate was last screened for this workspace. */
  screened_at: string;
  screened_for_title: string | null;
  furthest_stage: string | null;
  matched_requirements: string[];
  reasons: RoleFitReason[];
  pool_names: string[];
  signal_count: number;
};

export type RoleFitResultDTO = {
  position: { id: string; title: string; location: string | null; seniority: string | null };
  candidates: RoleFitCandidateDTO[];
  summary: {
    library_size: number;
    fitting: number;
    already_interviewed: number;
    screenings_reused: number;
    oldest_screening_at: string | null;
  };
  requirements: string[];
};

const STAGE_RANK: Record<string, number> = {
  new: 0,
  reviewing: 1,
  delivered: 2,
  shortlisted: 3,
  interview_process: 4,
  offer: 5,
  hired: 6,
};

const STAGE_LABEL: Record<string, string> = {
  reviewing: "reviewed",
  delivered: "shown to you",
  shortlisted: "shortlisted",
  interview_process: "interviewed",
  offer: "offered",
  hired: "hired",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
}

const STOP_WORDS = new Set([
  "and", "or", "the", "a", "an", "in", "on", "with", "for", "to", "from", "of", "at", "by", "is",
  "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "can", "shall", "we", "you", "they", "he", "she", "it",
  "this", "that", "these", "those", "i", "my", "our", "your", "their", "his", "her", "its", "such",
  "as", "so", "than", "too", "very", "just", "only", "own", "same", "more", "most", "other", "some",
  "any", "each", "every", "all", "both", "few", "little", "much", "many", "several", "no", "not",
  "neither", "nor", "either", "also", "about", "into", "through", "during", "before", "after",
  "above", "below", "between", "among", "within", "without", "under", "over", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how", "what", "which", "who", "whom",
  "whose", "5+", "5", "years", "year", "experience", "experienced", "building", "production",
  "applications", "application", "app", "apps", "strong", "practical", "comfortable", "fluent",
  "written", "spoken", "end-to-end", "end", "automated", "automate", "maintaining", "maintain",
  "tests", "test", "testing", "unit", "one", "another", "model", "models", "modelling", "modeling",
  "including", "include", "migrations", "migration", "owning", "owned", "features", "feature",
  "shipped", "ship", "design", "designs", "designed", "row-level", "row", "level", "multi-tenant",
  "multi", "tenant", "tenants", "isolation", "isolations", "relational", "data", "database",
  "databases", "server", "servers", "client", "clients", "senior", "junior", "mid", "lead", "manager",
  "work", "working", "worked", "team", "teams", "product", "business", "stakeholder", "technical",
  "technology", "platform", "platforms", "system", "systems", "service", "services", "api", "apis",
  "web", "mobile", "frontend", "front-end", "front", "back", "backend", "back-end", "side", "ui",
  "ux", "user", "interface", "interfaces", "developer", "developers", "development", "developed",
  "engineer", "engineers", "engineering", "software", "code", "coding", "coded", "quality", "high",
  "clear", "clean", "scalable", "scale", "scaling", "scaled", "reliable", "reliability", "secure",
  "security", "best", "practices", "practice", "standard", "standards", "patterns", "pattern",
  "architecture", "architectural", "architect", "designing", "implementing", "implemented",
  "implementation", "deploy", "deployment", "deployments", "deployed", "release", "releases", "released",
  "shipping", "deliver", "delivering", "delivered", "delivery", "ci", "cd", "cicd", "ci/cd", "pipeline",
  "pipelines", "integration", "continuous", "version", "control", "git", "repo", "repository", "branch",
  "commit", "pull", "request", "merge", "review", "reviewing", "reviewed", "agile", "scrum", "sprint",
  "documentation", "docs", "spec", "specification", "requirement", "requirements", "roadmap",
  "prioritize", "backlog", "ticket", "issue", "bug", "fix", "debug", "debugging", "performance",
  "performant", "optimized", "optimize", "optimization", "efficient", "efficiency", "monitor",
  "monitoring", "observability", "metrics", "metric", "logs", "logging", "trace", "tracing", "alert",
  "alerting", "incident", "on-call", "sre", "devops", "ml", "machine", "learning", "ai", "artificial",
  "intelligence", "llm", "training", "fine-tuning", "inference", "predict", "prediction", "analytics",
  "analysis", "dataset", "big", "warehouse", "etl", "elt", "stream", "streaming", "batch", "real",
  "time", "real-time", "lake", "governance", "compliance", "compliant", "regulatory", "regulation",
  "privacy", "private", "public", "confidential", "encryption", "encrypted", "hash", "hashing",
  "token", "tokens", "tokenization", "jwt", "oauth", "sso", "single", "sign", "authentication",
  "auth", "authorization", "permission", "permissions", "role", "roles", "access", "control",
  "firewall", "vpn", "network", "networking", "cloud", "native", "serverless", "lambda", "function",
  "functions", "container", "containerization", "docker", "kubernetes", "k8s", "helm", "terraform",
  "ansible", "prometheus", "grafana", "datadog", "sentry", "opentelemetry", "otel", "elasticsearch",
  "kibana", "redis", "rabbitmq", "kafka", "sqs", "sns", "kinesis", "pubsub", "websocket", "graphql",
  "rest", "grpc", "protobuf", "json", "xml", "yaml", "csv", "parquet", "avro", "openapi", "http",
  "https", "ssl", "tls", "tcp", "ip", "dns", "cdn", "load", "balancer", "balancing", "proxy",
  "reverse", "gateway", "ingress", "egress", "mesh", "istio", "nginx", "apache", "postgres",
  "postgresql", "mysql", "mongodb", "mongo", "mariadb", "sqlite", "oracle", "sql", "server", "tsql",
  "plsql", "pl/sql", "nosql", "newrelic", "pagerduty", "jaeger", "zipkin", "logstash", "fluentd",
  "fluentbit", "loki", "tempo", "cortex", "thanos", "mimir", "memcached", "nats", "mqtt", "socket",
  "sockets", "soap", "swagger", "postman", "insomnia", "load", "balancer", "balancers", "balancing",
  "puppet", "chef", "vagrant", "nomad", "consul", "vault", "linkerd", "traefik", "caddy", "haproxy",
  "gcp", "google", "amazon", "azure", "microsoft", "aws", "lambda", "function", "functions",
  "step", "step", "workflow", "workflows", "iam", "sts", "ec2", "s3", "rds", "ecs", "eks", "fargate",
  "cloudfront", "route53", "dynamodb", "cognito", "ses", "sqs", "sns", "eventbridge", "kinesis",
  "firehose", "lambda", "api", "gateway", "sagemaker", "bedrock", "vertex", "gke", "cloudrun",
  "functions", "cloudsql", "bigquery", "pubsub", "cloudstorage", "gcs", "blob", "storage", "bucket",
  "buckets", "compute", "engine", "app", "run", "heroku", "netlify", "vercel", "digitalocean", "linode",
  "vm", "vms", "virtual", "machine", "machines", "bare", "metal", "hardware", "host", "hosting",
  "hosted", "provider", "providers", "saas", "paas", "iaas", "on-prem", "onprem", "premises", "premise",
  "datacenter", "data-center", "data", "center", "edge", "cdn", "cache", "caching", "cached", "memoization",
  "memoize", "lazy", "loading", "loaded", "loader", "bundler", "bundle", "bundles", "bundling", "webpack",
  "vite", "rollup", "esbuild", "swc", "babel", "transpile", "transpilation", "compile", "compiler",
  "compilation", "runtime", "runtimes", "framework", "frameworks", "library", "libraries", "toolkit",
  "tooling", "tool", "tools", "sdk", "sdks", "cli", "command", "line", "shell", "bash", "zsh", "powershell",
  "terminal", "console", "script", "scripts", "scripting", "automated", "automation", "automate", "cron",
  "scheduler", "scheduling", "scheduled", "queue", "queues", "queueing", "job", "jobs", "worker", "workers",
  "background", "task", "tasks", "process", "processes", "processing", "processor", "thread", "threads",
  "concurrency", "concurrent", "parallel", "parallelism", "synchronous", "sync", "asynchronous", "async",
  "event", "events", "event-driven", "driven", "reactive", "reactive", "observable", "observer", "pub",
  "sub", "publish", "subscribe", "subscription", "message", "messages", "messaging", "broker", "brokers",
  "bus", "buses", "rpc", "remote", "procedure", "call", "calls", "called", "calling", "invocation",
  "invoke", "invoked", "invoking", "request", "requests", "requested", "requesting", "response",
  "responses", "respond", "responder", "reply", "replies", "payload", "payloads", "header", "headers",
  "body", "bodies", "query", "queries", "param", "params", "parameter", "parameters", "path", "paths",
  "route", "routes", "routing", "router", "middleware", "middlewares", "interceptor", "interceptors",
  "filter", "filters", "filtering", "guard", "guards", "decorator", "decorators", "annotation",
  "annotations", "aspect", "aspects", "module", "modules", "component", "components", "directive",
  "directives", "pipe", "pipes", "service", "services", "provider", "providers", "inject", "injection",
  "injector", "dependency", "dependencies", "singleton", "scoped", "transient", "factory", "factories",
  "builder", "builders", "pattern", "patterns", "abstract", "interface", "interfaces", "class", "classes",
  "object", "objects", "function", "functions", "method", "methods", "property", "properties", "field",
  "fields", "attribute", "attributes", "variable", "variables", "constant", "constants", "const",
  "let", "var", "type", "types", "typing", "typed", "type-safe", "generic", "generics", "interface",
  "union", "intersection", "tuple", "enum", "enums", "literal", "literals", "primitive", "primitives",
  "boolean", "booleans", "number", "numbers", "string", "strings", "array", "arrays", "object", "objects",
  "map", "maps", "set", "sets", "weakmap", "weakset", "date", "dates", "regexp", "regex", "regexes",
  "promise", "promises", "promisify", "async", "await", "callback", "callbacks", "cb", "error", "errors",
  "exception", "exceptions", "try", "catch", "finally", "throw", "throws", "throwing", "thrown",
  "stack", "trace", "traces", "tracing", "debug", "debugger", "debugging", "debugged", "log", "logs",
  "logging", "logger", "loggers", "console", "print", "println", "printf", "format", "formatting",
  "formatted", "parse", "parsing", "parsed", "parser", "parsers", "serialize", "serializing",
  "serialized", "serialization", "deserialize", "deserializing", "deserialized", "deserialization",
  "stringify", "json", "encode", "encoding", "encoded", "decoder", "decoding", "decode", "decoded",
  "compression", "compress", "compressed", "decompress", "decompressed", "zip", "gzip", "deflate",
  "inflate", "base64", "hex", "binary", "octal", "unicode", "utf8", "utf-8", "ascii", "latin1",
  "buffer", "buffers", "stream", "streams", "streaming", "chunk", "chunks", "pipe", "piping", "piped",
  "file", "files", "filesystem", "fs", "path", "paths", "directory", "directories", "dir", "dirs",
  "folder", "folders", "cwd", "pwd", "root", "relative", "absolute", "glob", "globs", "globbing",
  "wildcard", "wildcards", "pattern", "patterns", "match", "matches", "matching", "matcher", "matchers",
  "search", "searching", "searched", "index", "indexes", "indices", "key", "keys", "value", "values",
  "entry", "entries", "document", "documents", "record", "records", "row", "rows", "column", "columns",
  "schema", "schemas", "table", "tables", "view", "views", "materialized", "index", "indexing", "indexed",
  "transaction", "transactions", "transactional", "acid", "isolation", "consistency", "durability",
  "atomicity", "commit", "commits", "committed", "committing", "rollback", "rollbacks", "savepoint",
  "lock", "locks", "locking", "locked", "deadlock", "deadlocks", "concurrency", "concurrent", "serial",
  "serializable", "snapshot", "snapshots", "mvcc", "replication", "replica", "replicas", "replicating",
  "replicated", "primary", "secondary", "follower", "leader", "master", "slave", "sharding", "shard",
  "shards", "partition", "partitions", "partitioning", "partitioned", "distribution", "distributed",
  "distribute", "distributing", "balancer", "balance", "balancing", "balanced", "failover", "fail",
  "over", "failovers", "backup", "backups", "restore", "restores", "restoring", "restored", "recovery",
  "recoveries", "recovering", "recovered", "snapshot", "snapshots", "clone", "clones", "cloning", "cloned",
  "migration", "migrations", "migrating", "migrated", "migrate", "seed", "seeds", "seeding", "seeded",
  "fixture", "fixtures", "demo", "demos", "mock", "mocks", "mocking", "mocked", "stub", "stubs",
  "fake", "fakes", "dummy", "dummies", "sample", "samples", "sampling", "production", "prod", "dev",
  "development", "develop", "developing", "developed", "qa", "test", "testing", "tests", "staging",
  "stage", "stages", "staged", "environment", "environments", "env", "envs", "config", "configs",
  "configuration", "configurations", "configure", "configured", "configuring", "setting", "settings",
  "option", "options", "flag", "flags", "toggle", "toggles", "feature", "features", "feature-flag",
  "feature-toggles", "experiment", "experiments", "experimentation", "ab", "a/b", "split", "split-test",
  "metrics", "metric", "kpi", "kpis", "indicator", "indicators", "measure", "measures", "measurement",
  "measurements", "analytics", "analytic", "analysis", "analyses", "report", "reports", "reporting",
  "reported", "dashboard", "dashboards", "visualization", "visualizations", "chart", "charts",
  "graph", "graphs", "diagram", "diagrams", "plot", "plots", "table", "tables", "spreadsheet",
  "csv", "excel", "sheet", "sheets", "workbook", "workbooks", "pivot", "pivots", "slice", "slices",
  "dice", "drill", "drill-down", "roll-up", "rollup", "cube", "cubes", "olap", "etl", "elt", "data",
  "warehouse", "warehousing", "lake", "lakehouse", "data", "mesh", "fabric", "catalog", "catalogs",
  "metadata", "metastore", "lineage", "lineages", "provenance", "venance", "data", "governance",
  "quality", "data-quality", "profiling", "profile", "profiles", "cleansing", "clean", "cleaning",
  "enrichment", "enrich", "enriched", "enriching", "transformation", "transform", "transformed",
  "transforming", "normalize", "normalized", "normalizing", "denormalize", "denormalized", "aggregation",
  "aggregate", "aggregated", "aggregating", "group", "groups", "grouping", "grouped", "window", "windows",
  "windowing", "rank", "ranks", "ranking", "ranked", "percentile", "percentiles", "quantile", "quantiles",
  "distribution", "distributions", "histogram", "histograms", "boxplot", "boxplots", "outlier",
  "outliers", "anomaly", "anomalies", "anomalous", "detect", "detection", "detecting", "detected",
  "forecast", "forecasting", "forecasted", "predict", "prediction", "predictions", "predictive",
  "model", "models", "modeling", "modelling", "train", "training", "trained", "retrain", "retraining",
  "fit", "fitting", "fitted", "overfit", "overfitting", "underfit", "underfitting", "validation",
  "validate", "validating", "validated", "cross-validation", "hyperparameter", "hyperparameters",
  "tune", "tuning", "tuned", "optimizer", "optimizers", "optimization", "optimizations", "gradient",
  "descent", "backprop", "backpropagation", "neural", "network", "networks", "deep", "deep-learning",
  "learning", "machine-learning", "reinforcement", "rl", "supervised", "unsupervised", "semi-supervised",
  "classification", "classifier", "classifiers", "classify", "classifying", "classified", "regression",
  "regressor", "clustering", "cluster", "clusters", "clustered", "dimensionality", "reduction", "pca",
  "tsne", "umap", "embedding", "embeddings", "vector", "vectors", "vectorization", "vectorized",
  "similarity", "similarities", "distance", "distances", "metric", "metrics", "nearest", "neighbor",
  "neighbors", "knn", "search", "indexing", "retrieval", "retrieve", "retrieving", "retrieved",
  "recommender", "recommendation", "recommendations", "recommend", "recommending", "ranking", "ranked",
  "personalization", "personalize", "personalized", "personalizing", "content", "contents", "item",
  "items", "user", "users", "session", "sessions", "session-based", "sequential", "sequence", "sequences",
  "time", "series", "time-series", "temporal", "timestamp", "timestamps", "date", "dates", "calendar",
  "calendars", "schedule", "schedules", "scheduling", "scheduler", "recurring", "interval", "intervals",
  "period", "periods", "duration", "durations", "frequency", "frequencies", "rate", "rates", "quota",
  "quotas", "limit", "limits", "limiting", "limited", "throttle", "throttling", "throttled", "burst",
  "bursts", "capacity", "capacities", "concurrency", "concurrent", "parallel", "parallelism", "thread",
  "threads", "threading", "async", "asynchronous", "synchronous", "sync", "blocking", "non-blocking",
  "nonblocking", "event-loop", "eventloop", "loop", "loops", "callback", "callbacks", "promise", "promises",
  "future", "futures", "asyncio", "coroutine",
]);

function requirementTokens(req: string): string[] {
  return norm(req)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function matchesRequirement(req: string, haystack: string, skills: string[]): boolean {
  const tokens = requirementTokens(req);
  if (tokens.length === 0) return false;
  return tokens.some(
    (t) =>
      haystack.includes(t) ||
      skills.some((s) => norm(s).includes(t) || norm(s) === t),
  );
}


function labelsFrom(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((r) =>
      typeof r === "string" ? r : r && typeof r === "object" ? String((r as AnyRow).label ?? "") : "",
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function toSkills(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as AnyRow).name ?? "") : ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

function displayName(row: AnyRow): string {
  const full = row?.full_name ? String(row.full_name).trim() : "";
  if (full) return full;
  return "Candidate";
}

function locationMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const tokens = (s: string) => new Set(s.split(/[ ,]+/).filter((t) => t.length > 2));
  const ta = tokens(na);
  for (const t of tokens(nb)) if (ta.has(t)) return true;
  return false;
}

export const getRoleFitFromPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string; limit?: number }) =>
    z
      .object({
        orgId: z.string().uuid(),
        positionId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<RoleFitResultDTO> => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", data.orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");

    const { data: position, error: posErr } = await supabase
      .from("positions")
      .select("id, title, location, seniority, requirements, preferred_requirements")
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (posErr) throw new Error(posErr.message);
    if (!position) throw new Error("Role not found");
    const pos = position as AnyRow;

    const requirements = [
      ...labelsFrom(pos.requirements),
      ...labelsFrom(pos.preferred_requirements),
    ];
    const reqNorm = requirements.map((r) => ({ label: r, n: norm(r) })).filter((r) => r.n.length > 1);

    // Every candidate previously screened for this workspace. The library is the
    // whole set of screen-recruited people, not excluding those who were already
    // matched to the picked role — the selected role may be a re-run, a refilled
    // requisition, or a similar title, and the client wants to see all evidence
    // they have already paid for.
    const { data: matchRows, error: mErr } = await supabase
      .from("candidate_matches")
      .select("candidate_profile_id, position_id, stage, created_at, delivered_at, updated_at")
      .eq("organization_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(4000);
    if (mErr) throw new Error(mErr.message);
    const matches = (matchRows as AnyRow[]) ?? [];

    type Roll = {
      screened_at: string;
      screened_for: string | null;
      furthest: string | null;
      on_this_role: boolean;
    };
    const rolled = new Map<string, Roll>();
    for (const m of matches) {
      const key = m.candidate_profile_id as string;
      const stamp = (m.delivered_at ?? m.created_at) as string;
      const cur = rolled.get(key);
      if (!cur) {
        rolled.set(key, {
          screened_at: stamp,
          screened_for: m.position_id,
          furthest: m.stage,
          on_this_role: m.position_id === data.positionId,
        });
      } else {
        if (stamp < cur.screened_at) {
          cur.screened_at = stamp;
          cur.screened_for = m.position_id;
        }
        if ((STAGE_RANK[m.stage] ?? -1) > (STAGE_RANK[cur.furthest ?? ""] ?? -1)) cur.furthest = m.stage;
        if (m.position_id === data.positionId) cur.on_this_role = true;
      }
    }

    const libraryIds = Array.from(rolled.keys());
    if (libraryIds.length === 0) {
      return {
        position: { id: pos.id, title: pos.title, location: pos.location, seniority: pos.seniority },
        candidates: [],
        summary: {
          library_size: 0,
          fitting: 0,
          already_interviewed: 0,
          screenings_reused: 0,
          oldest_screening_at: null,
        },
        requirements,
      };
    }


    const { data: profileRows } = await supabase
      .from("candidate_profiles")
      .select("id, full_name, headline, location, years_experience, skills")
      .in("id", libraryIds);
    const profiles = new Map<string, AnyRow>();
    for (const p of (profileRows as AnyRow[]) ?? []) profiles.set(p.id, p);

    const titleIds = Array.from(
      new Set(Array.from(rolled.values()).map((r) => r.screened_for).filter(Boolean) as string[]),
    );
    const titles = new Map<string, string>();
    if (titleIds.length) {
      const { data: posRows } = await supabase.from("positions").select("id, title").in("id", titleIds);
      for (const p of (posRows as AnyRow[]) ?? []) titles.set(p.id, p.title);
    }

    const { data: poolRows } = await supabase
      .from("talent_pool_members")
      .select("candidate_profile_id, talent_pools(name)")
      .eq("organization_id", data.orgId)
      .in("candidate_profile_id", libraryIds);
    const poolNames = new Map<string, string[]>();
    for (const r of (poolRows as AnyRow[]) ?? []) {
      const name = r.talent_pools?.name;
      if (!name) continue;
      const list = poolNames.get(r.candidate_profile_id) ?? [];
      list.push(name);
      poolNames.set(r.candidate_profile_id, list);
    }

    const out: RoleFitCandidateDTO[] = [];
    for (const id of libraryIds) {
      const p = profiles.get(id);
      if (!p) continue;
      const roll = rolled.get(id)!;
      const skills = toSkills(p.skills);
      const seniorityBand = seniorityFromYears(p.years_experience);
      const haystack = norm([...skills, p.headline ?? "", seniorityBand ?? ""].join(" "));

      const matchedRequirements = reqNorm
        .filter((r) => haystack.includes(r.n) || skills.some((s) => norm(s).includes(r.n)))
        .map((r) => r.label);

      const reasons: RoleFitReason[] = [];
      if (matchedRequirements.length) {
        reasons.push({
          kind: "skill",
          label: `Evidence for ${matchedRequirements.length} of ${reqNorm.length} requirement${reqNorm.length === 1 ? "" : "s"}: ${matchedRequirements.slice(0, 3).join(", ")}`,
        });
      }
      if (pos.seniority && seniorityBand && norm(pos.seniority) === norm(seniorityBand)) {
        reasons.push({ kind: "seniority", label: `Same seniority as the role (${seniorityBand})` });
      }
      if (locationMatch(pos.location, p.location)) {
        reasons.push({ kind: "location", label: `Already located in ${p.location}` });
      }
      const stageLabel = roll.furthest ? STAGE_LABEL[roll.furthest] : null;
      if (roll.furthest && (STAGE_RANK[roll.furthest] ?? 0) >= 3) {
        reasons.push({
          kind: "progress",
          label: `Previously ${stageLabel} for ${titles.get(roll.screened_for ?? "") ?? "another role"}`,
        });
      }
      const pools = poolNames.get(id) ?? [];
      if (pools.length) {
        reasons.push({ kind: "pool", label: `Saved in ${pools.join(", ")}` });
      }

      // Evidence-only: no reason, no card.
      if (!matchedRequirements.length && reasons.length === 0) continue;
      if (!matchedRequirements.length && !reasons.some((r) => r.kind === "progress" || r.kind === "pool"))
        continue;

      out.push({
        candidate_profile_id: id,
        display_name: displayName(p),
        headline: p.headline ?? null,
        location: p.location ?? null,
        seniority: seniorityBand,
        screened_at: roll.screened_at,
        screened_for_title: titles.get(roll.screened_for ?? "") ?? null,
        furthest_stage: stageLabel,
        matched_requirements: matchedRequirements,
        reasons,
        pool_names: pools,
        signal_count: matchedRequirements.length + reasons.length - (matchedRequirements.length ? 1 : 0),
      });
    }

    out.sort(
      (a, b) =>
        b.matched_requirements.length - a.matched_requirements.length ||
        b.signal_count - a.signal_count ||
        b.screened_at.localeCompare(a.screened_at),
    );

    const limited = out.slice(0, data.limit ?? 50);
    const oldest = out.reduce<string | null>(
      (min, c) => (!min || c.screened_at < min ? c.screened_at : min),
      null,
    );

    return {
      position: { id: pos.id, title: pos.title, location: pos.location, seniority: pos.seniority },
      candidates: limited,
      summary: {
        library_size: libraryIds.length,
        fitting: out.length,
        already_interviewed: out.filter((c) => c.furthest_stage === "interviewed" || c.furthest_stage === "offered")
          .length,
        screenings_reused: out.length,
        oldest_screening_at: oldest,
      },
      requirements,
    };
  });

export const listRoleFitPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("positions")
      .select("id, title, status, created_at")
      .eq("organization_id", data.orgId)
      .in("status", ["approved", "active", "under_review", "draft", "submitted", "paused"])
      .order("created_at", { ascending: false })
      .limit(100);
    return {
      positions: ((rows as AnyRow[]) ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status })),
    };
  });
