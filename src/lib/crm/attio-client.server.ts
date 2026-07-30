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
