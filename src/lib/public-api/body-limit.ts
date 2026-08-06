/**
 * Body size guard for public endpoints that forward text to a paid LLM.
 *
 * An unauthenticated caller must not be able to hand us an arbitrarily large
 * document and have us pay to tokenize it. We refuse oversized payloads on
 * three signals, cheapest first: the declared Content-Length, the actual bytes
 * read from the stream (a lying header is still caught), and the character
 * length of the individual fields after parsing.
 */

export type BodyLimitFailure = {
  ok: false;
  status: 413 | 400;
  error: "payload_too_large" | "field_too_long" | "invalid_json";
  detail: Record<string, number | string>;
};

export type BodyLimitSuccess = { ok: true; body: unknown; bytes: number };

/**
 * Reads a JSON body while enforcing a hard byte ceiling.
 *
 * Streams the body so an oversized payload is abandoned instead of buffered in
 * full, and rejects before any parsing or downstream LLM work happens.
 */
export async function readJsonWithLimit(
  request: Request,
  maxBytes: number,
): Promise<BodyLimitSuccess | BodyLimitFailure> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: "payload_too_large",
      detail: { max_bytes: maxBytes, declared_bytes: declared },
    };
  }

  const body = request.body;
  let text: string;
  let bytes = 0;

  if (!body) {
    text = "";
  } else {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel().catch(() => {});
          return {
            ok: false,
            status: 413,
            error: "payload_too_large",
            detail: { max_bytes: maxBytes, read_bytes: bytes },
          };
        }
        chunks.push(value);
      }
    } catch {
      return { ok: false, status: 400, error: "invalid_json", detail: {} };
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder().decode(joined);
  }

  try {
    return { ok: true, body: JSON.parse(text || "null"), bytes };
  } catch {
    return { ok: false, status: 400, error: "invalid_json", detail: {} };
  }
}

/** Enforces a per-field character ceiling before the text reaches a model. */
export function assertFieldLength(
  field: string,
  value: unknown,
  maxChars: number,
): BodyLimitFailure | null {
  if (typeof value !== "string") return null;
  if (value.length <= maxChars) return null;
  return {
    ok: false,
    status: 413,
    error: "field_too_long",
    detail: { field, max_chars: maxChars, actual_chars: value.length },
  };
}
