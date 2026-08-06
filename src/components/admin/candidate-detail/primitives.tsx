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
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (React.isValidElement(v)) return v;
  if (Array.isArray(v)) {
    const parts = v.map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : null)).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    if (keys.length === 0) return null;
    const compact = keys
      .map((k) => {
        const val = (v as Record<string, unknown>)[k];
        if (val == null || val === "") return null;
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return `${k}: ${val}`;
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
    const o = v as Record<string, unknown>;
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
      <dd>{safe ?? <span className="text-muted-foreground">—</span>}</dd>
    </>
  );
}

