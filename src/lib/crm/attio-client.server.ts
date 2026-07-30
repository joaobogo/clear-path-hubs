/**
 * Attio API v2 HTTP layer. Server-only.
 * The credential is read from process.env.ATTIO_API_KEY inside each call and
 * is never logged, returned, or exposed to the browser.
 */

const ATTIO_BASE = "https://api.attio.com/v2";
const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export class AttioError extends Error {
  status: number;
  retryable: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AttioError";
    this.status = status;
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

function apiKey(): string {
  const key = process.env.ATTIO_API_KEY;
  if (!key) throw new AttioError(0, "attio_not_configured");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function attioFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const key = apiKey();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${ATTIO_BASE}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });

      if (res.ok) return (await res.json()) as T;

      const text = (await res.text().catch(() => "")).slice(0, 500);
      const err = new AttioError(res.status, text || `attio_http_${res.status}`);
      if (!err.retryable || attempt === MAX_ATTEMPTS) throw err;
      lastError = err;
    } catch (e) {
      if (e instanceof AttioError && !e.retryable) throw e;
      lastError = e instanceof Error ? e : new AttioError(0, "attio_unknown_error");
      if (attempt === MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
    await sleep(300 * 2 ** (attempt - 1));
  }

  if (lastError instanceof AttioError) throw lastError;
  throw new AttioError(408, "attio_timeout");
}

type RecordResponse = { data: { id: { record_id: string } } };

/** Upsert a Person, matched on email address (no duplicates on repeat sends). */
export async function assertPerson(values: Record<string, unknown>): Promise<string> {
  const res = await attioFetch<RecordResponse>(
    "/objects/people/records?matching_attribute=email_addresses",
    { method: "PUT", body: { data: { values } } },
  );
  return res.data.id.record_id;
}

/** Upsert a Company, matched on domain. */
export async function assertCompany(values: Record<string, unknown>): Promise<string> {
  const res = await attioFetch<RecordResponse>(
    "/objects/companies/records?matching_attribute=domains",
    { method: "PUT", body: { data: { values } } },
  );
  return res.data.id.record_id;
}

/**
 * Find an existing open Deal already associated with this Person, so repeat
 * inquiries update one pipeline record instead of creating duplicates.
 * Closed-won / closed-lost stages are skipped: those need a fresh Deal.
 */
const CLOSED_STAGE = /won|lost|closed|archiv/i;

export async function findOpenDealForPerson(personId: string): Promise<string | null> {
  try {
    const res = await attioFetch<{
      data: { id: { record_id: string }; values?: Record<string, unknown> }[];
    }>("/objects/deals/records/query", {
      method: "POST",
      body: {
        filter: { associated_people: { target_record_id: personId } },
        sorts: [{ direction: "desc", attribute: "created_at", field: "value" }],
        limit: 25,
      },
    });
    for (const record of res.data ?? []) {
      const stageValues = (record.values?.stage ?? []) as { status?: { title?: string } }[];
      const title = stageValues[0]?.status?.title ?? "";
      if (!CLOSED_STAGE.test(title)) return record.id.record_id;
    }
    return null;
  } catch {
    return null;
  }
}

/** Update an existing Deal in place (used for repeat inquiries). */
export async function updateDeal(dealId: string, values: Record<string, unknown>): Promise<string> {
  const res = await attioFetch<RecordResponse>(`/objects/deals/records/${dealId}`, {
    method: "PATCH",
    body: { data: { values } },
  });
  return res.data.id.record_id;
}

export async function createDeal(values: Record<string, unknown>): Promise<string> {
  const res = await attioFetch<RecordResponse>("/objects/deals/records", {
    method: "POST",
    body: { data: { values } },
  });
  return res.data.id.record_id;
}

/** Read existing stage options so we reuse a stage rather than creating one. */
export async function listDealStages(): Promise<{ id: string; title: string }[]> {
  try {
    const res = await attioFetch<{
      data: { id: { status_id?: string; option_id?: string }; title: string }[];
    }>("/objects/deals/attributes/stage/statuses");
    return res.data.map((s) => ({
      id: s.id.status_id ?? s.id.option_id ?? "",
      title: s.title,
    }));
  } catch {
    return [];
  }
}

/**
 * Attribute slugs actually configured on an object in this workspace, cached
 * per isolate. Used to drop unknown attribution fields before writing, so one
 * missing custom attribute can't wipe out every other attribution value.
 */
const attributeSlugCache = new Map<string, Set<string>>();
export async function listObjectAttributeSlugs(object: string): Promise<Set<string> | null> {
  const cached = attributeSlugCache.get(object);
  if (cached) return cached;
  try {
    const res = await attioFetch<{ data: { api_slug: string }[] }>(
      `/objects/${object}/attributes`,
    );
    const slugs = new Set(res.data.map((a) => a.api_slug));
    attributeSlugCache.set(object, slugs);
    return slugs;
  } catch {
    return null;
  }
}

/**
 * Attio marks `owner` as required on the Deals object, so a deal cannot be
 * created without one. Prefer an admin member, fall back to the first member.
 */
export async function resolveDealOwnerEmail(): Promise<string | null> {
  try {
    const res = await attioFetch<{
      data: { email_address?: string; access_level?: string }[];
    }>("/workspace_members");
    const members = res.data.filter((m) => !!m.email_address);
    const admin = members.find((m) => m.access_level === "admin");
    return (admin ?? members[0])?.email_address ?? null;
  } catch {
    return null;
  }
}

export async function listWorkspaceLists(): Promise<
  { id: string; name: string; api_slug: string }[]
> {
  try {
    const res = await attioFetch<{
      data: { id: { list_id: string }; name: string; api_slug: string }[];
    }>("/lists");
    return res.data.map((l) => ({
      id: l.id.list_id,
      name: l.name,
      api_slug: l.api_slug,
    }));
  } catch {
    return [];
  }
}

export async function addToList(
  listId: string,
  parentObject: "people" | "companies" | "deals",
  recordId: string,
): Promise<void> {
  await attioFetch(`/lists/${listId}/entries`, {
    method: "POST",
    body: {
      data: {
        parent_object: parentObject,
        parent_record_id: recordId,
        entry_values: {},
      },
    },
  });
}

export async function createNote(input: {
  parentObject: "people" | "companies" | "deals";
  parentRecordId: string;
  title: string;
  content: string;
}): Promise<string | null> {
  try {
    const res = await attioFetch<{ data: { id: { note_id: string } } }>("/notes", {
      method: "POST",
      body: {
        data: {
          parent_object: input.parentObject,
          parent_record_id: input.parentRecordId,
          title: input.title,
          format: "plaintext",
          content: input.content,
        },
      },
    });
    return res.data.id.note_id;
  } catch {
    return null;
  }
}
