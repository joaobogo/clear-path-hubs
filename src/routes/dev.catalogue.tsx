import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Inbox, TrendingUp, Users } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  KpiCard,
  KpiRowSkeleton,
  PageBody,
  PageHeader,
  PageShell,
  Section,
  StatusBadge,
  TableSkeleton,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dev/catalogue")({
  component: Catalogue,
  head: () => ({
    meta: [
      { title: "Design System Catalogue — TaaSFlow" },
      { name: "description", content: "Component catalogue and design tokens for TaaSFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Catalogue() {
  return (
    <PageShell>
      <PageHeader
        title="Design system catalogue"
        description="Approved components, tokens, and states. Every dashboard uses these primitives — no per-page inventions."
        actions={<Button variant="outline">View tokens</Button>}
      />
      <PageBody>
        <Section title="Semantic colors" description="Status tones map 1:1 to StatusBadge variants.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Background", "bg-background", "text-foreground"],
                ["Card", "bg-card", "text-card-foreground"],
                ["Muted", "bg-muted", "text-muted-foreground"],
                ["Primary", "bg-primary", "text-primary-foreground"],
                ["Success", "bg-success", "text-success-foreground"],
                ["Warning", "bg-warning", "text-warning-foreground"],
                ["Info", "bg-info", "text-info-foreground"],
                ["Destructive", "bg-destructive", "text-destructive-foreground"],
                ["Success soft", "bg-success-soft", "text-success"],
                ["Warning soft", "bg-warning-soft", "text-warning-foreground"],
                ["Info soft", "bg-info-soft", "text-info"],
                ["Danger soft", "bg-danger-soft", "text-destructive"],
              ] as const
            ).map(([label, bg, fg]) => (
              <div key={label} className={`rounded-lg border border-border p-4 ${bg} ${fg}`}>
                <p className="text-xs font-medium">{label}</p>
                <p className="mt-1 font-mono text-[10px] opacity-70">{bg}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Status badges">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">Draft</StatusBadge>
            <StatusBadge tone="info">In review</StatusBadge>
            <StatusBadge tone="warning">Needs clarification</StatusBadge>
            <StatusBadge tone="success">Active</StatusBadge>
            <StatusBadge tone="danger">Failed</StatusBadge>
          </div>
        </Section>

        <Section title="KPI cards" description="Empty state uses em-dash, never a bare zero.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Candidates Delivered" value={12} hint="Since inception." icon={<Users className="h-4 w-4" />} drillTo="/_dev/catalogue" />
            <KpiCard label="Top Matches" value={3} hint="Latest fit band = top." icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard label="Scheduled Interviews" value={0} emptyHint="No upcoming interviews." icon={<Briefcase className="h-4 w-4" />} />
            <KpiCard label="Active Positions" value={null} loading icon={<Inbox className="h-4 w-4" />} />
          </div>
        </Section>

        <Section title="Empty, error & loading states">
          <div className="grid gap-4 lg:grid-cols-3">
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No candidates yet"
              description="Delivered candidates will appear here after admin review."
              action={<Button size="sm" variant="outline">Learn more</Button>}
            />
            <ErrorState traceId="trc_01H8XKQ" onRetry={() => {}} />
            <TableSkeleton rows={4} cols={3} />
          </div>
          <KpiRowSkeleton />
        </Section>

        <Section title="Forms">
          <form className="max-w-md space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="space-y-1.5">
              <Label htmlFor="ds-email">Work email</Label>
              <Input id="ds-email" type="email" placeholder="you@company.com" />
              <p className="text-xs text-muted-foreground">We'll never share your address.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-title">Role title</Label>
              <Input id="ds-title" defaultValue="Head of Engineering" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button">Cancel</Button>
              <Button type="button">Save changes</Button>
            </div>
          </form>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Typography">
          <div className="space-y-2 rounded-xl border border-border bg-card p-6">
            <h1 className="text-3xl font-semibold tracking-tight">Display / H1 · 30px semibold</h1>
            <h2 className="text-xl font-semibold tracking-tight">Section / H2 · 20px semibold</h2>
            <h3 className="text-base font-semibold">Subsection / H3 · 16px semibold</h3>
            <p className="text-sm text-foreground">Body · 14px — default for dashboard content.</p>
            <p className="text-xs text-muted-foreground">Caption · 12px muted — hints, timestamps.</p>
          </div>
        </Section>
      </PageBody>
    </PageShell>
  );
}
