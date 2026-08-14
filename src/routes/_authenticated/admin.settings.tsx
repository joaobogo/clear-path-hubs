import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Ban, Copy, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings · TaaSFlow admin" },
      { name: "description", content: "Audited registry of platform admin settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type Status = "functional" | "incomplete" | "unsafe" | "duplicate" | "unused";
type Row = {
  area: string;
  control: string;
  status: Status;
  location: string;
  persistence: string;
  audit: string;
  note?: string;
  to?: string;
};

// Audit registry. Every admin-facing control lives here so we can guarantee
// there are no orphaned controls that appear to save but do nothing.
const ROWS: Row[] = [
  // Account
  { area: "Account", control: "Change email (verified)", status: "functional",
    location: "/client/account · /me/profile", to: "/client/account", persistence: "auth.users via Supabase Auth", audit: "auth logs" },
  { area: "Account", control: "Password reset", status: "functional",
    location: "/login → Forgot password?", to: "/login", persistence: "auth.users via Supabase Auth", audit: "auth logs" },
  { area: "Account", control: "Name and phone", status: "functional",
    location: "/me/profile", to: "/me/profile", persistence: "profiles.full_name / phone", audit: "audit_events" },
  { area: "Account", control: "Data export / deletion request", status: "functional",
    location: "/me/settings", to: "/me/settings", persistence: "data_subject_requests", audit: "audit_events" },


  // Notifications
  { area: "Notifications", control: "Per-event email toggles", status: "functional",
    location: "/client/settings (per org)", to: "/client/settings", persistence: "client_notification_preferences", audit: "audit_events" },
  { area: "Notifications", control: "Delivery failure retries", status: "functional",
    location: "/admin/health → Operational health", to: "/admin/health", persistence: "notification_deliveries", audit: "audit_events" },

  // Tracking
  { area: "Tracking", control: "Essential tracker list + prior opt-in rule", status: "functional",
    location: "/admin/tracking", to: "/admin/tracking", persistence: "tracking_policy", audit: "tracking_policy.updated_by/updated_at",
    note: "Staff-only write (is_platform_staff); read publicly by the consent banner." },
  { area: "Tracking", control: "Tag configuration read-out", status: "functional",
    location: "/admin/health → Tracking configuration", to: "/admin/health", persistence: "environment variables (read-only)", audit: "n/a",
    note: "Read-only by design: identifiers are deploy-time configuration, not a UI setting." },

  // Business rules
  { area: "Business rules", control: "Rule overrides (thresholds, gates)", status: "functional",
    location: "/admin/business-rules", to: "/admin/business-rules", persistence: "business_rules_overrides", audit: "business_rules_audit" },

  // Agents
  { area: "Agents", control: "Pause / resume agent per workspace", status: "functional",
    location: "/admin/agent-ops", to: "/admin/agent-ops", persistence: "agent_settings", audit: "audit_events (entity_type='agent_settings')" },

  // Team / permissions
  { area: "Team & permissions", control: "Invite / role assignment", status: "functional",
    location: "/admin/team", to: "/admin/team", persistence: "memberships (role, status)", audit: "audit_events" },
  { area: "Team & permissions", control: "Deactivate member", status: "functional",
    location: "/admin/team", to: "/admin/team", persistence: "memberships.status='inactive'", audit: "audit_events",
    note: "Revocation is immediate: is_org_member() requires status='active' AND organizations.archived_at IS NULL." },
  { area: "Team & permissions", control: "Platform staff role grants", status: "functional",
    location: "/admin/team → invite flow", to: "/admin/team", persistence: "user_roles", audit: "audit_events",
    note: "Audited invite flow only — never auto-granted from an email domain or a trigger." },

  // Templates
  { area: "Templates", control: "Screening question bank", status: "functional",
    location: "/admin/positions/$id → Screening", persistence: "screening_questions", audit: "audit_events" },
  { area: "Templates", control: "Interview scorecard template", status: "incomplete",
    location: "planned", persistence: "n/a", audit: "n/a",
    note: "No UI shipped yet. Not exposed anywhere — cannot produce a false 'saved' state." },

  // Scoring configuration
  { area: "Scoring", control: "Blueprint / engine version pin", status: "functional",
    location: "score_runs.blueprint_version / engine_version", persistence: "score_runs (immutable after complete)", audit: "audit_events" },
  { area: "Scoring", control: "Publication readiness gates", status: "functional",
    location: "/admin/publish", to: "/admin/publish", persistence: "candidate_matches.approved_score_run_id + tg_candidate_matches_publish_gate", audit: "audit_events" },

  // Organization defaults
  { area: "Organization defaults", control: "Client profile (name, timezone, industry)", status: "functional",
    location: "/admin/clients → Overview", to: "/admin/clients", persistence: "organizations", audit: "audit_events" },
  { area: "Organization defaults", control: "Archive organization", status: "functional",
    location: "/admin/clients → Danger zone", to: "/admin/clients", persistence: "organizations.archived_at", audit: "audit_events",
    note: "Revokes access to all members instantly via is_org_member() guard." },

  // Security
  { area: "Security", control: "Support Mode (view-as-client)", status: "functional",
    location: "/admin/support", to: "/admin/support", persistence: "support_sessions + support_actions", audit: "audit_events + support_actions",
    note: "Read-only DTOs enforced via assertNotSupportViewReadOnly()." },
  { area: "Security", control: "RLS + tenant isolation", status: "functional",
    location: "policies on every public table", persistence: "pg_policies", audit: "pg_stat_statements" },

  // Integrations
  { area: "Integrations", control: "Integration health & connections", status: "functional",
    location: "/admin/integrations", to: "/admin/integrations", persistence: "integration_sync_status / integration_health_checks", audit: "audit_events" },
  { area: "Integrations", control: "Lovable AI Gateway (LLM)", status: "functional",
    location: "server-only", persistence: "LOVABLE_API_KEY secret", audit: "provider_usage_events" },
  { area: "Integrations", control: "Storage (private cvs bucket)", status: "functional",
    location: "server-only signed URLs", persistence: "supabase.storage", audit: "audit_events (file access via server fns)" },
];


const statusStyles: Record<Status, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  functional: { label: "Functional", icon: CheckCircle2, variant: "secondary" },
  incomplete: { label: "Incomplete", icon: AlertTriangle, variant: "outline" },
  unsafe:     { label: "Unsafe",     icon: Ban,           variant: "destructive" },
  duplicate:  { label: "Duplicate",  icon: Copy,          variant: "outline" },
  unused:     { label: "Unused",     icon: Wrench,        variant: "outline" },
};

function SettingsPage() {
  const counts = ROWS.reduce<Record<Status, number>>(
    (a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a),
    { functional: 0, incomplete: 0, unsafe: 0, duplicate: 0, unused: 0 },
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audited registry of every admin-facing control. Each row lists where it lives,
          how it persists, and how it is audited. Non-functional controls are removed —
          they are listed here only when work is planned.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(statusStyles) as Status[]).map((s) => {
          const S = statusStyles[s];
          return (
            <div key={s} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <S.icon className="h-3.5 w-3.5" />
                {S.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{counts[s]}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Control</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Persists to</th>
              <th className="px-3 py-2 font-medium">Audit trail</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROWS.map((r, i) => {
              const S = statusStyles[r.status];
              return (
                <tr key={i} className="align-top hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.area}</td>
                  <td className="px-3 py-2">
                    <div>{r.control}</div>
                    {r.note && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{r.note}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={S.variant} className="gap-1">
                      <S.icon className="h-3 w-3" />
                      {S.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.to ? <Link to={r.to} className="underline">{r.location}</Link> : r.location}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.persistence}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.audit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Any control that would appear in this UI but not persist or audit its change is a
        blocker. If you see one in the app that is not listed here, treat it as a bug.
      </p>
    </div>
  );
}
