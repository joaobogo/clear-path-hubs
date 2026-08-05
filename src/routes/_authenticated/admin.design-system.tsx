import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  PageShell,
  PageHeader,
  PageBody,
  StatusBadge,
  EmptyState,
  ErrorState,
  Skeleton,
  TableSkeleton,
  KpiRowSkeleton,
  KpiCard,
  ScoreDisplay,
  StageIndicator,
  Section,
  DashboardCard,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, Search, Trash2, ArrowLeft, Info, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/design-system")({
  head: () => ({
    meta: [
      { title: "Design system · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.design-system.tsx"),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
  component: DesignSystemGallery,
});

function DesignSystemGallery() {
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <PageShell>
      <PageHeader
        title="Design system"
        description="Living gallery of TaaSFlow tokens, primitives, and states. Copy these components rather than reinventing patterns."
        breadcrumb={
          <Link to="/admin" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Admin
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Density</span>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => setDensity("comfortable")}
                className={`px-3 py-1.5 text-xs ${density === "comfortable" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`px-3 py-1.5 text-xs ${density === "compact" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Compact
              </button>
            </div>
          </div>
        }
      />

      <PageBody>
        <div data-density={density}>

          {/* ────────── Tokens ────────── */}
          <Section title="Color tokens" description="Never hardcode colors. Use these Tailwind tokens or the underlying --taas-* variables.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { name: "primary", cls: "bg-primary text-primary-foreground" },
                { name: "secondary", cls: "bg-secondary text-secondary-foreground" },
                { name: "muted", cls: "bg-muted text-muted-foreground" },
                { name: "accent", cls: "bg-accent text-accent-foreground" },
                { name: "success", cls: "bg-success text-success-foreground" },
                { name: "warning", cls: "bg-warning text-warning-foreground" },
                { name: "info", cls: "bg-info text-info-foreground" },
                { name: "destructive", cls: "bg-destructive text-destructive-foreground" },
              ].map((t) => (
                <div key={t.name} className={`rounded-lg border border-border p-4 text-xs font-medium ${t.cls}`}>
                  {t.name}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Status colors carry a single meaning across the whole product:{" "}
              <b>success</b> = completed / positive, <b>warning</b> = needs attention,{" "}
              <b>destructive</b> = failed / blocking, <b>info</b> = informational / in progress,
              neutral = inactive.
            </p>
          </Section>

          {/* ────────── Typography ────────── */}
          <Section title="Typography">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Display · Fraunces</p>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
                A first ranked shortlist in days
              </h1>
              <h2 className="mt-4 text-2xl font-semibold text-foreground">Dashboard heading</h2>
              <h3 className="mt-2 text-lg font-semibold text-foreground">Section heading</h3>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Body copy uses Inter at 15px on marketing surfaces and 14px in dense workspace views. Long
                unbreakable strings never push the layout: overflow-wrap is set globally.
              </p>
              <code className="mt-3 inline-block rounded bg-muted px-2 py-1 font-mono text-xs">
                --taas-font-display · --taas-font-sans · --taas-font-mono
              </code>
            </div>
          </Section>

          {/* ────────── Buttons ────────── */}
          <Section title="Buttons" description="One height scale everywhere: sm=32, default=36, lg=40. Compact density shrinks defaults automatically.">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Tertiary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive"><Trash2 />Destructive</Button>
              <Button variant="link">Link</Button>
              <Button size="icon" variant="outline" aria-label="Search"><Search /></Button>
              <Button disabled>Disabled</Button>
              <Button><Loader2 className="animate-spin" />Loading…</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </Section>

          {/* ────────── Badges + Score + Stage ────────── */}
          <Section title="Status badges, scores, pipeline stages">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="neutral">Neutral</StatusBadge>
              <StatusBadge tone="success">Completed</StatusBadge>
              <StatusBadge tone="warning">Needs review</StatusBadge>
              <StatusBadge tone="danger">Failed</StatusBadge>
              <StatusBadge tone="info">Processing</StatusBadge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <ScoreDisplay score={92} />
              <ScoreDisplay score={74} variant="chip" />
              <ScoreDisplay score={58} variant="bar" className="w-56" />
              <ScoreDisplay score={null} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["new","review","shortlisted","interview","offer","hired","rejected","withdrawn"] as const).map((s) => (
                <StageIndicator key={s} stage={s} />
              ))}
            </div>
          </Section>

          {/* ────────── KPI cards ────────── */}
          <Section title="KPI cards">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Open positions" value={12} hint="+3 vs last week" icon={<Sparkles className="h-4 w-4" />} />
              <KpiCard label="Applications" value={287} hint="Rolling 30 days" drillTo="/admin/candidates" />
              <KpiCard label="Time-to-shortlist" value="9d" hint="Target: in days" />
              <KpiCard label="Placeholder" value={null} emptyHint="No data yet — add a role to begin." />
            </div>
          </Section>

          {/* ────────── Forms ────────── */}
          <Section title="Form controls" description="Inputs share the same 36px control height and focus ring across every route.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ds-name">Full name</Label>
                <Input id="ds-name" placeholder="Ada Lovelace" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-email">Work email</Label>
                <Input id="ds-email" type="email" defaultValue="ada@analyticalengine.co" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-role">Role</Label>
                <Select>
                  <SelectTrigger id="ds-role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eng">Engineering</SelectItem>
                    <SelectItem value="prod">Product</SelectItem>
                    <SelectItem value="ops">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-error">Invalid field</Label>
                <Input id="ds-error" aria-invalid defaultValue="not-an-email" className="border-destructive focus-visible:ring-destructive" />
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="ds-notes">Notes</Label>
                <Textarea id="ds-notes" placeholder="Anything the recruiter should know…" rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-consent" />
                <Label htmlFor="ds-consent" className="text-sm">I agree to the terms</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-consent-d" disabled />
                <Label htmlFor="ds-consent-d" className="text-sm text-muted-foreground">Disabled option</Label>
              </div>
            </div>
          </Section>

          {/* ────────── Tabs ────────── */}
          <Section title="Tabs">
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a">Overview</TabsTrigger>
                <TabsTrigger value="b">Evidence</TabsTrigger>
                <TabsTrigger value="c">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="pt-4 text-sm text-muted-foreground">Overview panel.</TabsContent>
              <TabsContent value="b" className="pt-4 text-sm text-muted-foreground">Evidence panel.</TabsContent>
              <TabsContent value="c" className="pt-4 text-sm text-muted-foreground">Activity panel.</TabsContent>
            </Tabs>
          </Section>

          {/* ────────── Progress + Skeletons ────────── */}
          <Section title="Progress & loading">
            <div className="space-y-3">
              <Progress value={35} />
              <Progress value={82} />
            </div>
            <div className="mt-6 grid gap-4">
              <KpiRowSkeleton />
              <TableSkeleton rows={4} cols={5} />
              <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-48" /></div>
            </div>
          </Section>

          {/* ────────── Empty / error ────────── */}
          <Section title="Empty & error states">
            <div className="grid gap-4 md:grid-cols-2">
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="No candidates yet"
                description="Publish a role to the job board and applications land here — usually the same day."
                action={<Button size="sm">Publish a role</Button>}
                tone="positive"
              />
              <ErrorState
                title="We couldn't load this list"
                description="Our side, not yours. Retry — your work is safe."
                traceId="req_01HXYZ…"
                onRetry={() => {}}
              />
            </div>
          </Section>

          {/* ────────── Long-content resilience ────────── */}
          <Section title="Long-content resilience" description="Layout must not break on unusually long names, URLs, or paragraphs.">
            <DashboardCard>
              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidate name</p>
                <p className="text-base font-semibold text-foreground">
                  Anastasia-Konstantinopoulou-Vandenberg-Lichtenstein-de-la-Rosa
                </p>
                <p className="text-sm text-muted-foreground">
                  Loremipsumdolorsitametconsecteturadipiscingelitseddoeiusmodtempor
                  incididuntutlaboreetdoloremagnaaliquauttenimadminimveniamquisnostrud
                </p>
              </div>
            </DashboardCard>
          </Section>

          {/* ────────── Dialog & Tooltip ────────── */}
          <Section title="Dialog & Tooltip">
            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm action</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">This is a canonical confirm dialog. Actions align right.</p>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button onClick={() => setOpenDialog(false)}>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More info"><Info /></Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Tooltips carry a single line of context — never a paragraph.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Section>

          {/* ────────── Data table (compact demo) ────────── */}
          <Section title="Data table" description="Compact density (data-density='compact') tightens rows without changing markup.">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="p-3">Candidate</th><th className="p-3">Role</th><th className="p-3">Stage</th><th className="p-3">Score</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { n: "Amelia Roux", r: "Senior Product Manager", s: "shortlisted", sc: 91 },
                    { n: "Kenji Tanaka", r: "Staff Engineer", s: "interview", sc: 78 },
                    { n: "Priya Shah", r: "Data Scientist", s: "review", sc: 62 },
                    { n: "Léa Duval", r: "Design Lead", s: "offer", sc: 88 },
                  ].map((row) => (
                    <tr key={row.n}>
                      <td className="p-3 font-medium text-foreground">{row.n}</td>
                      <td className="p-3 text-muted-foreground">{row.r}</td>
                      <td className="p-3"><StageIndicator stage={row.s} /></td>
                      <td className="p-3"><ScoreDisplay score={row.sc} variant="chip" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

        </div>
      </PageBody>
    </PageShell>
  );
}
