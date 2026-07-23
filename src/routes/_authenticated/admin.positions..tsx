
// ── Audit ───────────────────────────────────────────────────────────────────
function humanizeDiff(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, Any>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, Any>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const notes: string[] = [];
  for (const k of keys) {
    if (["id", "created_at", "updated_at"].includes(k)) continue;
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    const fmt = (v: Any) => {
      if (v == null) return "—";
      if (typeof v === "string") return v.length > 60 ? v.slice(0, 57) + "…" : v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
      return "updated";
    };
    notes.push(`${k.replace(/_/g, " ")}: ${fmt(bv)} → ${fmt(av)}`);
  }
  return notes;
}

function AuditTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-position-audit", id],
    queryFn: () => getPositionActivity({ data: { id, limit: 200 } }),
  });
  const rows = (data ?? []) as Any[];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        Immutable audit trail — every change to this position, oldest first at the bottom.
      </div>
      <ul className="divide-y">
        {rows.map((r) => {
          const notes = humanizeDiff(r.before_state, r.after_state);
          return (
            <li key={r.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">{r.action.replace(/_/g, " ")}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Actor{" "}
                <span className="font-mono">
                  {r.actor_user_id ? String(r.actor_user_id).slice(0, 8) : "system"}
                </span>
                {r.trace_id && (
                  <>
                    {" · trace "}
                    <span className="font-mono">{r.trace_id}</span>
                  </>
                )}
              </div>
              {notes.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {notes.slice(0, 8).map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                  {notes.length > 8 && (
                    <li className="italic">…and {notes.length - 8} more field changes</li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-4 py-10 text-center text-muted-foreground">
            No audit events yet.
          </li>
        )}
      </ul>
    </div>
  );
}
