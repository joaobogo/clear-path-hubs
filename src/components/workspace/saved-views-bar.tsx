import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSavedViews,
  saveSavedView,
  deleteSavedView,
  type SavedView,
  type SavedViewSurface,
} from "@/lib/saved-views.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bookmark, BookmarkPlus, Check, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type SavedViewsBarProps = {
  surface: SavedViewSurface;
  organizationId?: string;
  /** Current filter values as a plain string map. */
  currentFilters: Record<string, string>;
  /** Called when the user selects a saved view — apply these filters. */
  onApply: (filters: Record<string, string>) => void;
  /** Whether the user can share views (org owners/admins). */
  canShare?: boolean;
};

function filtersMatch(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const ak = Object.keys(a),
    bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

export function SavedViewsBar({
  surface,
  organizationId,
  currentFilters,
  onApply,
  canShare = false,
}: SavedViewsBarProps) {
  const listFn = useServerFn(listSavedViews);
  const saveFn = useServerFn(saveSavedView);
  const delFn = useServerFn(deleteSavedView);
  const qc = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);

  const key = ["saved-views", surface, organizationId ?? null];
  const views = useQuery({
    queryKey: key,
    queryFn: () =>
      listFn({
        data: { surface, ...(organizationId ? { organization_id: organizationId } : {}) },
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          surface,
          name: name.trim(),
          filters: currentFilters,
          is_shared: shared,
          organization_id: shared ? organizationId ?? null : null,
        },
      }),
    onSuccess: () => {
      toast.success(`Saved view "${name.trim()}"`);
      setSaveOpen(false);
      setName("");
      setShared(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("View deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = views.data ?? [];
  const active = rows.find((v) => filtersMatch(v.filters, currentFilters));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            {active ? active.name : "Saved views"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {rows.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No saved views yet.
            </div>
          ) : (
            rows.map((v: SavedView) => (
              <DropdownMenuItem
                key={v.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onApply(v.filters);
                }}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {active?.id === v.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{v.name}</span>
                  {v.is_shared && (
                    <Share2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </span>
                {v.is_mine && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove.mutate(v.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Delete view ${v.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setSaveOpen(true);
            }}
          >
            <BookmarkPlus className="mr-2 h-3.5 w-3.5" />
            Save current filters as view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="e.g. My roles at risk"
                required
              />
            </div>
            {canShare && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={shared}
                  onCheckedChange={(v) => setShared(!!v)}
                />
                Share with everyone in this workspace
              </label>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending || !name.trim()}>
                {save.isPending ? "Saving…" : "Save view"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
