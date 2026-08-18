/**
 * Small shared render helpers for the admin candidate workspace.
 *
 * They live outside the tab bundle because both the always-visible profile view
 * and the lazily loaded panels use them — duplicating them would mean shipping
 * the same code twice.
 */
import React from "react";

export function safeNode(v: unknown): React.ReactNode {
  if (v == null || v === "") return null;

  // Handle answers stored as { value: X } or { answer: { value: X } }
  let val = v;
  if (typeof v === "object" && !React.isValidElement(v) && !Array.isArray(v)) {
    const o = v as any;
    if (o && "value" in o) val = o.value;
    else if (o && "answer" in o && typeof o.answer === "object" && o.answer && "value" in (o.answer as any)) {
      val = (o.answer as any).value;
    }
  }

  if (val == null || val === "") return null;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    const s = val.trim();
    if (s.startsWith("http://") || s.startsWith("https://")) {
      return (
        <a
          href={s}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Link
        </a>
      );
    }
    return s || null;
  }

  if (React.isValidElement(val)) return val;

  if (Array.isArray(val)) {
    const parts = val
      .map((x) => {
        const inner = typeof x === "object" && x && "value" in x ? (x as any).value : x;
        return typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean"
          ? String(inner === true ? "Yes" : inner === false ? "No" : inner)
          : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }

  if (typeof val === "object") {
    const o = val as any;

    // Special case: Work Auth {"visa_required":false,"eu_right_to_work":true}
    if ("eu_right_to_work" in o || "visa_required" in o) {
      const parts: string[] = [];
      if (o.eu_right_to_work === true) parts.push("EU right to work");
      if (o.visa_required === false) parts.push("no visa required");
      else if (o.visa_required === true) parts.push("visa required");
      return parts.join(" · ") || "None stated";
    }

    // Special case: Availability {"note":"","status":"","notice_weeks":X}
    if ("status" in o || "notice_weeks" in o || "note" in o) {
      const parts: string[] = [];
      if (o.status) parts.push(String(o.status));
      if (o.notice_weeks != null && o.notice_weeks !== "")
        parts.push(`${o.notice_weeks} week${Number(o.notice_weeks) === 1 ? "" : "s"} notice`);
      if (o.note) parts.push(String(o.note));
      return parts.join(" · ") || "Available";
    }

    const keys = Object.keys(o);
    if (keys.length === 0) return null;
    const compact = keys
      .map((k) => {
        const item = o[k];
        const inner = typeof item === "object" && item && "value" in item ? (item as any).value : item;
        if (inner == null || inner === "") return null;
        if (typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean") {
          return `${k}: ${inner === true ? "Yes" : inner === false ? "No" : inner}`;
        }
        return null;
      })
      .filter(Boolean);
    return compact.length ? compact.join(" · ") : null;
  }
  return null;
}

export function toReqText(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "[object Object]") return "—";
    return t;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toReqText).filter((s) => s && s !== "—").join(", ") || "—";
  if (typeof v === "object") {
    const o = v as any;
    const cand = o.text ?? o.label ?? o.name ?? o.requirement ?? o.requirement_text ?? o.title;
    if (typeof cand === "string" && cand.trim() && cand.trim() !== "[object Object]") return cand.trim();
    return "—";
  }
  return "—";
}

export function cleanLine(s: string): string {
  return s.replace(/\[object Object\]/g, "requirement").trim();
}

export function Row({ label, v }: { label: string; v: React.ReactNode }) {
  const safe = safeNode(v);
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{safe ?? <span className="text-muted-foreground">Not provided</span>}</dd>
    </>
  );
}
