import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { readTeamsActionLink, consumeTeamsActionLink } from "@/lib/teams.functions";
import { clientAction } from "@/lib/client-decisions.functions";

export const Route = createFileRoute("/_authenticated/teams/act/$token")({
  head: () => ({
    meta: [
      { title: "Confirm decision — TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamsActPage,
});

const LABEL: Record<string, { verb: string; blurb: string; reason?: string }> = {
  shortlist: { verb: "Advance", blurb: "Move this candidate forward to your shortlist." },
  hold: {
    verb: "Hold",
    blurb: "Pause this candidate for now. You can pick them back up any time.",
    reason: "timing",
  },
  not_moving_forward: {
    verb: "Decline",
    blurb: "Close this candidate out. We'll tell them respectfully.",
    reason: "other",
  },
};

function TeamsActPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState("");

  const read = useServerFn(readTeamsActionLink);
  const act = useServerFn(clientAction);
  const consume = useServerFn(consumeTeamsActionLink);

  const { data, isLoading } = useQuery({
    queryKey: ["teams-action", token],
    queryFn: () => read({ data: { token } }),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!data || data.status !== "ready") return;
      const meta = LABEL[data.action] ?? LABEL.shortlist;
      await act({
        data: {
          orgId: data.orgId,
          matchId: data.matchId,
          action: data.action as "shortlist" | "hold" | "not_moving_forward",
          reasonCode: meta.reason,
          feedback: note.trim() || undefined,
        },
      });
      await consume({ data: { token } });
    },
    onSuccess: () => {
      toast.success("Decision recorded.");
      navigate({ to: "/client" });
    },
    onError: (e) => toastError(e, { fallback: "Could not record that." }),
  });

  if (isLoading) {
    return <Shell>Checking this link…</Shell>;
  }

  if (!data || data.status !== "ready") {
    const msg =
      data?.status === "used"
        ? "This link has already been used. Open the workspace to see the current status."
        : data?.status === "expired"
          ? "This link has expired. Open the workspace to make the decision there."
          : data?.status === "forbidden"
            ? "Your account doesn't have permission to make decisions in this workspace."
            : "This link isn't valid.";
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">{msg}</p>
        <Button asChild className="mt-4">
          <Link to="/client">Open your workspace</Link>
        </Button>
      </Shell>
    );
  }

  const meta = LABEL[data.action] ?? LABEL.shortlist;
  const needsNote = data.action === "not_moving_forward";

  return (
    <Shell>
      <h1 className="text-xl font-semibold">
        {meta.verb} this candidate on {data.roleTitle}?
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{meta.blurb}</p>
      <div className="mt-4 space-y-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="note">
          {needsNote ? "Why? (helps us find better matches)" : "Add a note (optional)"}
        </label>
        <Textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional context for our team"
        />
      </div>
      <div className="mt-5 flex gap-2">
        <Button
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending || (needsNote && !note.trim())}
        >
          {confirm.isPending ? "Saving…" : `Confirm ${meta.verb.toLowerCase()}`}
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/client">Cancel</Link>
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="p-6">{children}</Card>
    </div>
  );
}
