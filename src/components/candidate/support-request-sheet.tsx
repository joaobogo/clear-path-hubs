import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_BODY_MAX,
  SUPPORT_CATEGORIES,
  SUPPORT_RESPONSE_PROMISE,
} from "@/lib/candidate/support";
import { submitSupportRequest } from "@/lib/candidate/support.functions";
import { track } from "@/lib/candidate/funnel-events.functions";

/**
 * In-product support route. The candidate never has to find an address or
 * quote their own reference — the category and the reference travel with the
 * message.
 */
export function SupportRequestSheet({
  reference,
  triggerLabel = "Get help",
  variant = "outline",
}: {
  reference?: string;
  triggerLabel?: string;
  variant?: "outline" | "ghost" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0].key);
  const [body, setBody] = useState("");
  const submit = useServerFn(submitSupportRequest);

  const send = useMutation({
    mutationFn: () =>
      submit({ data: { category, body: body.trim(), reference } }),
    onSuccess: (r) => {
      if (r.ok) {
        track("support_requested", { category, reference });
        toast.success("Request sent. We'll reply in your messages and by email.");
        setBody("");
        setOpen(false);
      } else {
        toast.error(r.message ?? "We could not send that. Please try again.");
      }
    },
    onError: () => toast.error("We could not send that. Please try again."),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} className="min-h-11 gap-1.5">
          <LifeBuoy className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Get help</SheetTitle>
          <SheetDescription>{SUPPORT_RESPONSE_PROMISE}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {reference ? (
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              We&apos;ll attach your reference <span className="font-medium">{reference}</span> so
              you don&apos;t have to.
            </p>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What is this about?</legend>
            <div className="space-y-1.5">
              {SUPPORT_CATEGORIES.map((c) => (
                <label
                  key={c.key}
                  className="flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm"
                >
                  <input
                    type="radio"
                    name="support-category"
                    value={c.key}
                    checked={category === c.key}
                    onChange={() => setCategory(c.key)}
                    className="h-4 w-4"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="support-body">What happened?</Label>
            <Textarea
              id="support-body"
              rows={5}
              maxLength={SUPPORT_BODY_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us what you tried and what you saw."
            />
            <p className="text-xs text-muted-foreground">
              {body.trim().length}/{SUPPORT_BODY_MAX} characters.
            </p>
          </div>

          <Button
            className="w-full min-h-11"
            disabled={!body.trim() || send.isPending}
            aria-busy={send.isPending || undefined}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Send request"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
