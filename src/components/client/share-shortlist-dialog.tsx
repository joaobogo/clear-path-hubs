import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, ExternalLink, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createShortlistShare, type ShareMode } from "@/lib/shares.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  positionId?: string | null;
  matchIds: string[];
  suggestedTitle?: string;
};

export function ShareShortlistDialog({
  open,
  onOpenChange,
  orgId,
  positionId,
  matchIds,
  suggestedTitle,
}: Props) {
  const [title, setTitle] = useState(suggestedTitle ?? "");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ShareMode>("review");
  const [allowComments, setAllowComments] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [result, setResult] = useState<{
    token: string;
    expires_at: string;
  } | null>(null);

  const create = useServerFn(createShortlistShare);
  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          orgId,
          positionId: positionId ?? null,
          matchIds,
          title: title.trim() || undefined,
          message: message.trim() || undefined,
          defaultMode: mode,
          allowComments,
          expiresInDays,
        },
      }),
    onSuccess: (r) => {
      setResult({ token: r.token, expires_at: r.expires_at });
      toast.success("Share link ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shareUrl = result
    ? `${window.location.origin}/share/${result.token}`
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setResult(null);
          setTitle(suggestedTitle ?? "");
          setMessage("");
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share shortlist with a stakeholder
          </DialogTitle>
          <DialogDescription>
            Generate a read-only link — no TaaSFlow login required. You control
            the mode, expiry, and whether stakeholders can leave comments.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {matchIds.length} candidate{matchIds.length === 1 ? "" : "s"}{" "}
              selected
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="share-title">Title (optional)</Label>
              <Input
                id="share-title"
                placeholder="e.g. Head of Data — Round 1 shortlist"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="share-message">Note to stakeholder (optional)</Label>
              <Textarea
                id="share-message"
                placeholder="Context, what you'd like feedback on, or deadline."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default view</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as ShareMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="review">Review mode</SelectItem>
                    <SelectItem value="presentation">Presentation mode</SelectItem>
                    <SelectItem value="compare">Compare mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expires in</Label>
                <Select
                  value={String(expiresInDays)}
                  onValueChange={(v) => setExpiresInDays(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Allow comments</div>
                <div className="text-xs text-muted-foreground">
                  Stakeholders can leave feedback tagged by sentiment.
                </div>
              </div>
              <Switch
                checked={allowComments}
                onCheckedChange={setAllowComments}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-primary/5 p-3">
              <div className="text-sm font-medium">Share link created</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Expires{" "}
                {new Date(result.expires_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.open(shareUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with the link can view — no login needed. Revoke or extend
              any time in <span className="font-medium">Shares</span>.
            </p>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || matchIds.length === 0}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create share link
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
