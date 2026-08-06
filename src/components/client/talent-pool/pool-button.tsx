import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PoolButton({
  active,
  onClick,
  label,
  count,
  isSystem,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | undefined;
  isSystem?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-transparent hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {isSystem && <Sparkles className="h-3 w-3 text-primary" />}
        {label}
      </span>
      {typeof count === "number" && (
        <Badge variant="outline" className="text-[10px]">
          {count}
        </Badge>
      )}
    </button>
  );
}
