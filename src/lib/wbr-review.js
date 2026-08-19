/**
 * Client-safe types and CSV serialization for the weekly operating review.
 * Kept out of `wbr-review.server.ts` so the route can import it.
 */
export function reviewToCsv(review) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [];
    lines.push(esc("Week (UTC)") + "," + esc(review.week_start.slice(0, 10)));
    lines.push("");
    lines.push(["Metric", "This week", "Previous week", "Change", "Basis"].map(esc).join(","));
    for (const m of review.metrics) {
        lines.push([m.label, m.current, m.previous, m.current - m.previous, m.basis].map(esc).join(","));
    }
    lines.push("");
    lines.push(["Regressed role", "Client", "Delivered this week", "Delivered previous week"]
        .map(esc)
        .join(","));
    for (const r of review.regressed_roles) {
        lines.push([r.title, r.client_name, r.delivered_this_week, r.delivered_prev_week].map(esc).join(","));
    }
    lines.push("");
    lines.push(["Metric", "Record", "Detail", "Timestamp"].map(esc).join(","));
    for (const m of review.metrics) {
        for (const rec of m.records) {
            lines.push([m.label, rec.label, rec.sublabel, rec.at].map(esc).join(","));
        }
    }
    return lines.join("\n");
}
