import { Bot, Sparkles, User2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const SUGGESTED = [
  "What changed this week?",
  "Who needs review right now?",
  "What should I do next?",
  "What is blocking my open roles?",
  "Who best fits SQL experience?",
];

export function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
      <h2 className="mt-3 text-lg font-medium">Ask about your pipeline</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The assistant only answers using your TaaSFlow records — it will cite each
        one so you can jump straight to the source.
      </p>
      <ul className="mt-5 grid gap-2 text-left">
        {SUGGESTED.map((q) => (
          <li key={q}>
            <button
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm transition hover:bg-muted"
              onClick={() => onPick(q)}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <Avatar role="assistant" />
      <div className="rounded-2xl rounded-tl-sm border bg-background px-3 py-2 text-sm text-muted-foreground">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
        </span>
      </div>
    </div>
  );
}

export function Avatar({ role }: { role: "user" | "assistant" | "system" }) {
  const isUser = role === "user";
  return (
    <div
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs ${
        isUser ? "bg-muted" : "bg-primary/10 text-primary"
      }`}
    >
      {isUser ? <User2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
  );
}

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" | "none" }) {
  const styles: Record<string, string> = {
    high: "border-success/30 bg-success/10 text-success",
    medium: "border-warning/30 bg-warning/10 text-warning",
    low: "border-warning/30 bg-warning/10 text-warning",
    none: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    none: "Insufficient data",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-normal ${styles[level]}`}>
      {labels[level]}
    </Badge>
  );
}
