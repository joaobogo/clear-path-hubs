import { Link } from "@tanstack/react-router";
import { Award, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REASON_LABELS, type TalentMemoryDTO } from "@/lib/talent-memory.functions";

export function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <Award className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-medium">No silver medalists yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tag strong candidates who weren&apos;t selected — they&apos;ll resurface
        automatically when you open similar roles.
      </p>
      <Link to="/client/candidates" className="mt-4 inline-block text-sm text-primary hover:underline">
        Browse candidates
      </Link>
    </div>
  );
}

export function MemoryCard({
  memory,
  onOpen,
}: {
  memory: TalentMemoryDTO;
  onOpen: () => void;
}) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <button className="w-full text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{memory.candidate.display_name}</p>
            {memory.candidate.headline && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {memory.candidate.headline}
              </p>
            )}
          </div>
          {memory.status === "archived" ? (
            <Badge variant="outline" className="text-[10px]">archived</Badge>
          ) : (
            <Badge className="border-warning/60 bg-warning/60 text-warning text-[10px]">
              silver
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {REASON_LABELS[memory.reason_category]}
          </Badge>
          {memory.role_title_snapshot && (
            <span className="text-[11px] text-muted-foreground">
              from <span className="font-medium">{memory.role_title_snapshot}</span>
            </span>
          )}
        </div>
        {memory.skills_snapshot.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {memory.skills_snapshot.slice(0, 5).map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
            ))}
            {memory.skills_snapshot.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                +{memory.skills_snapshot.length - 5} more
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            consent: {memory.consent_status}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(memory.tagged_at).toLocaleDateString()}
          </span>
        </div>
      </button>
    </li>
  );
}
