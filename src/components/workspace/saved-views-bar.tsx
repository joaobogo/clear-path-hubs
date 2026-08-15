import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSavedViews,
  saveSavedView,
  updateSavedView,
  setDefaultSavedView,
  touchSavedView,
  deleteSavedView,
  type SavedView,
  type SavedViewSurface,
} from "@/lib/saved-views.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Bookmark,
  BookmarkPlus,
  Check,
  Pencil,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";

export type SavedViewsBarProps = {
  surface: SavedViewSurface;
  organizationId?: string;
  /** Current filter values as a plain string map. */
  currentFilters: Record<string, string>;
  /** Called when the user selects a saved view — apply these filters. */
  onApply: (filters: Record<string, string>) => void;
  /** Whether the user can share views (staff, or org owners/admins). */
  canShare?: boolean;
};

function filtersMatch(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return false;
  }
  return true;
}

function relative(iso: string | null): string {
  if (!iso) return "never used";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "used just now";
  if (mins < 60) return `used ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `used ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `used ${days}d ago`;
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
  const updateFn = useServerFn(updateSavedView);
  const defaultFn = useServerFn(setDefaultSavedView);
  const touchFn = useServerFn(touchSavedView);
  const delFn = useServerFn(deleteSavedView);
  const qc = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const appliedDefault = useRef(false);

  const key = ["saved-views", surface, organizationId ?? null];
  const views = useQuery({
    queryKey: key,
    queryFn: () =>
      listFn({
        data: { surface, ...(organizationId ? { organization_id: organizationId } : {}) },
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const rows = views.data ?? [];
  const hasActiveFilters = Object.values(currentFilters).some((v) => (v ?? "") !== "");

  // Error surfaces as a toast; the filters currently applied stay untouched.
  useEffect(() => {
    if (views.isError) toast.error("Couldn't load saved views");
  }, [views.isError]);

  const apply = (v: SavedView) => {
    onApply(v.filters);
    if (v.is_mine) {
      touchFn({ data: { id: v.id } })
        .then(invalidate)
        .catch(() => undefined);
    }
  };

  // A default view applies on first load only when no filters are set yet.
  useEffect(() => {
    if (appliedDefault.current || !views.data || hasActiveFilters) return;
    const def = views.data.find((v) => v.is_default && v.is_mine);
    appliedDefault.current = true;
    if (def) apply(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.data, hasActiveFilters]);

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
    onError: (e: Error) => toastError(e),
  });

  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      updateFn({ data: { id: v.id, name: v.name } }),
    onSuccess: () => {
      toast.success("View renamed");
      setRenaming(null);
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const toggleShare = useMutation({
    mutationFn: (v: SavedView) =>
      updateFn({
        data: {
          id: v.id,
          is_shared: !v.is_shared,
          organization_id: !v.is_shared ? organizationId ?? null : null,
        },
      }),
    onSuccess: (_r, v) => {
      toast.success(v.is_shared ? "View is now private" : "View shared with the team");
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const toggleDefault = useMutation({
    mutationFn: (v: SavedView) =>
      defaultFn({ data: { id: v.id, surface, is_default: !v.is_default } }),
    onSuccess: (_r, v) => {
      toast.success(v.is_default ? "Default cleared" : `"${v.name}" is now your default`);
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("View deleted");
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

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
        <DropdownMenuContent align="end" className="z-[70] w-80">
          {views.isLoading ? (
            <div className="space-y-2 px-2 py-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : views.isError ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Saved views unavailable.{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => views.refetch()}
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No saved views yet
            </div>
          ) : (
            rows.map((v: SavedView) => (
              <DropdownMenuItem
                key={v.id}
                onSelect={(e) => {
                  e.preventDefault();
                  apply(v);
                }}
                className="flex items-start justify-between gap-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {active?.id === v.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{v.name}</span>
                    {v.is_shared && (
                      <Share2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    {v.is_default && (
                      <Star className="h-3 w-3 shrink-0 fill-current text-warning" />
                    )}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {v.owner_name} · {relative(v.last_used_at)}
                    {v.is_shared ? " · shared" : ""}
                  </span>
                </span>
                {v.is_mine && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDefault.mutate(v);
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={
                        v.is_default
                          ? `Clear default for ${v.name}`
                          : `Set ${v.name} as default`
                      }
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${v.is_default ? "fill-current" : ""}`}
                      />
                    </button>
                    {canShare && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleShare.mutate(v);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={
                          v.is_shared ? `Unshare view ${v.name}` : `Share view ${v.name}`
                        }
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenaming(v);
                        setRenameValue(v.name);
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Rename view ${v.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(v.id);
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Delete view ${v.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
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
              <p className="text-xs text-muted-foreground">
                Views store the filter set only, so results are always live.
              </p>
            </div>
            {canShare && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={shared}
                  onCheckedChange={(v) => setShared(!!v)}
                />
                {organizationId
                  ? "Share with everyone in this workspace"
                  : "Share with the internal team"}
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

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming && renameValue.trim())
                rename.mutate({ id: renaming.id, name: renameValue.trim() });
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="view-rename">Name</Label>
              <Input
                id="view-rename"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={rename.isPending || !renameValue.trim()}>
                {rename.isPending ? "Saving…" : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
