import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

export function ProposeForm({
  times,
  setTimes,
}: {
  times: string[];
  setTimes: Dispatch<SetStateAction<string[]>>;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Proposed times</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTimes((t) => [...t, ""])}
        >
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
      <div className="mt-1 space-y-2">
        {times.map((t, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="datetime-local"
              value={t}
              onChange={(e) =>
                setTimes((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))
              }
            />
            {times.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove time slot ${i + 1}`}
                className="min-h-11 min-w-11"
                onClick={() => setTimes((arr) => arr.filter((_, idx) => idx !== i))}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
