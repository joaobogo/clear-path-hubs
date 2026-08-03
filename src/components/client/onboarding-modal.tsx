import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  dismissClientOnboarding,
  updateClientTimezone,
  updateClientNotificationPreferences,
} from "@/lib/client.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase,
  Users,
  MessageSquare,
  ShieldCheck,
  Clock,
  Bell,
  LifeBuoy,
  CheckCircle2,
} from "lucide-react";

type Role = "client_admin" | "client_editor" | "client_viewer";

export function ClientOnboardingModal({
  orgId,
  orgName,
  role,
  initialTimezone,
  displayName,
}: {
  orgId: string;
  orgName: string;
  role: Role;
  initialTimezone: string | null;
  displayName: string | null;
}) {
  const qc = useQueryClient();
  const dismiss = useServerFn(dismissClientOnboarding);
  const saveTz = useServerFn(updateClientTimezone);
  const saveNotifs = useServerFn(updateClientNotificationPreferences);

  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [tz, setTz] = useState<string>(
    initialTimezone ??
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC"),
  );
  const [emailOptIn, setEmailOptIn] = useState(true);

  const finish = useMutation({
    mutationFn: async () => {
      // Persist preferences and mark onboarding complete.
      await Promise.all([
        saveTz({ data: { orgId, timezone: tz } }).catch(() => null),
        saveNotifs({
          data: {
            orgId,
            candidate_delivered: emailOptIn,
            interview_request: emailOptIn,
            new_message: emailOptIn,
            offer_update: emailOptIn,
            hire_update: emailOptIn,
            email_enabled: emailOptIn,
            digest: "immediate",
          },
        }).catch(() => null),
        dismiss(),
      ]);
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["client-context"] });
      setOpen(false);
    },
  });

  const roleCopy: Record<Role, string> = {
    client_admin:
      "As Client admin you can invite teammates, submit new positions, approve offers, and configure workspace settings.",
    client_editor:
      "As Client editor you can move candidates through your pipeline, schedule interviews, and message TaaSFlow.",
    client_viewer:
      "As Client viewer you can review positions and candidates. Actions that change state are hidden — ask an admin for edit access if you need more.",
  };

  const steps: Array<{ title: string; body: React.ReactNode }> = [
    {
      title: `Welcome${displayName ? `, ${displayName.split(" ")[0]}` : ""} — this is ${orgName}`,
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            You are inside the <strong>{orgName}</strong> workspace. Everything you see is
            scoped to this organization. If you belong to more organizations, use the
            switcher above the navigation to move between them.
          </p>
        </div>
      ),
    },
    {
      title: "Your role",
      body: (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            {role.replace("client_", "Client ").replace(/^./, (c) => c.toUpperCase())}
          </div>
          <p className="text-muted-foreground">{roleCopy[role]}</p>
        </div>
      ),
    },
    {
      title: "How the workspace is organized",
      body: (
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <NavItem
            icon={<Briefcase className="h-4 w-4" />}
            title="Positions"
            body="Every role you are hiring for, with a pipeline summary."
          />
          <NavItem
            icon={<Users className="h-4 w-4" />}
            title="Candidates"
            body="Only candidates delivered for your positions — never a global pool."
          />
          <NavItem
            icon={<MessageSquare className="h-4 w-4" />}
            title="Messages"
            body="Direct line to your TaaSFlow team, scoped to this workspace."
          />
          <NavItem
            icon={<Clock className="h-4 w-4" />}
            title="Overview"
            body="Action Required, KPIs, and what is happening next."
          />
        </ul>
      ),
    },
    {
      title: "How candidates are delivered",
      body: (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>TaaSFlow sources and vets candidates against your position brief.</li>
          <li>Only candidates cleared by our review appear in your workspace.</li>
          <li>
            Each delivered candidate ships with a role-specific score, evidence, and a
            CV — you never see raw resumes without context.
          </li>
          <li>
            Move candidates through Shortlist → Interview → Offer → Hire. TaaSFlow sees
            every action and follows up.
          </li>
        </ol>
      ),
    },
    {
      title: "Set your timezone",
      body: (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            We use this to show times in your local zone and to schedule interview
            reminders.
          </p>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="e.g. Europe/Lisbon"
          />
        </div>
      ),
    },
    {
      title: "Notifications",
      body: (
        <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={emailOptIn}
            onChange={(e) => setEmailOptIn(e.target.checked)}
          />
          <span>
            <span className="flex items-center gap-1.5 font-medium">
              <Bell className="h-3.5 w-3.5" /> Email me for candidates, messages, and
              interviews.
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              You can fine-tune every event later in Settings → Notifications.
            </span>
          </span>
        </label>
      ),
    },
    {
      title: "You are set",
      body: (
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <LifeBuoy className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Need help?</div>
              <p className="text-muted-foreground">
                Send a message from{" "}
                <Link to="/client/conversations" className="underline">
                  Messages
                </Link>{" "}
                — your TaaSFlow team replies in the same workspace. You can reopen this
                tour any time from{" "}
                <Link to="/client/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Timezone, notifications, and workspace
            preferences saved.
          </div>
        </div>
      ),
    },
  ];

  const isLast = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;

  const closeAndDismiss = () => {
    finish.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Any dismiss (X, Esc, backdrop) marks the tour complete so it does not loop.
        if (!next) closeAndDismiss();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{steps[step].title}</DialogTitle>
          <DialogDescription className="sr-only">
            Client workspace welcome tour, step {step + 1} of {steps.length}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">{steps[step].body}</div>
        <Progress value={progress} className="h-1" />
        <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={closeAndDismiss}
            disabled={finish.isPending}
          >
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                disabled={finish.isPending}
              >
                Back
              </Button>
            )}
            {!isLast ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={closeAndDismiss} disabled={finish.isPending}>
                {finish.isPending ? "Saving…" : "Finish"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NavItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
    </li>
  );
}
