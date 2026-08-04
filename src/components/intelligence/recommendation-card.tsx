import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, BellOff, Clock, Eye, Lightbulb, X } from "lucide-react";
import type {
  BestPractice,
  Recommendation,
  RecommendationSeverity,
} from "@/lib/intelligence/recommendations";
import { SNOOZE_LABEL } from "@/lib/intelligence/use-recommendation-dismissals";

/**
 * One detected condition, one action.
 *
 * Presentation rules held here:
 *  - Severity is never colour-only: each level carries an icon and a word.
 *  - Supporting data is a real definition list, so the figures behind the
 *    observation are readable by keyboard and screen reader alike.
 *  - Impact copy comes from the engine and is deliberately hedged; nothing here
 *    adds a forecast.
 */

const SEVERITY_META: Record<
  RecommendationSeverity,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  act_now: {
    label: "Act now",
    icon: AlertTriangle,
    className: "border-destructive/50 text-destructive",
  },
  review: { label: "Worth reviewing", icon: Eye, className: "border-amber-600/40 text-amber-700" },
  watch: { label: "Keep an eye on", icon: Clock, className: "border-muted-foreground/40 text-muted-foreground" },
};

export function RecommendationCard({
  recommendation,
  onDismiss,
  onSnooze,
}: {
  recommendation: Recommendation;
  onDismiss?: (id: string) => void;
  onSnooze?: (id: string) => void;
}) {
  const meta = SEVERITY_META[recommendation.severity];
  const Icon = meta.icon;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={`gap-1 ${meta.className}`}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {meta.label}
          </Badge>
          <div className="flex items-center gap-1">
            {recommendation.snoozable && onSnooze && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`${SNOOZE_LABEL}: ${recommendation.title}`}
                title={SNOOZE_LABEL}
                onClick={() => onSnooze(recommendation.id)}
              >
                <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
            {recommendation.dismissible && onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Dismiss: ${recommendation.title}`}
                title="Dismiss"
                onClick={() => onDismiss(recommendation.id)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <h3 className="text-base font-semibold leading-snug">{recommendation.title}</h3>
        <p className="text-sm text-muted-foreground">{recommendation.observed}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {recommendation.evidence.map((e) => (
            <div key={e.label} className="flex items-baseline justify-between gap-2 border-b py-1">
              <dt className="text-muted-foreground">{e.label}</dt>
              <dd className="font-medium tabular-nums">{e.value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Suggested action. </span>
            {recommendation.suggestedAction}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Possible effect. </span>
            {recommendation.expectedImpact}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button asChild size="sm" variant="secondary">
            <Link to={recommendation.link.to}>
              {recommendation.link.label}
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            From “{recommendation.derivedFrom.replace(/_/g, " ")}”
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecommendationCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2 pb-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-8 w-40" />
      </CardContent>
    </Card>
  );
}

export function BestPracticeList({ practices }: { practices: BestPractice[] }) {
  if (!practices.length) return null;
  return (
    <section aria-labelledby="best-practice-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="best-practice-heading" className="text-sm font-semibold">
          General practice
        </h2>
        <span className="text-xs text-muted-foreground">
          Standing guidance — not detected from your records
        </span>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {practices.map((p) => (
          <li key={p.key} className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm font-medium">{p.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            {p.link && (
              <Link
                to={p.link.to}
                className="mt-2 inline-flex items-center text-sm underline underline-offset-4"
              >
                {p.link.label}
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
