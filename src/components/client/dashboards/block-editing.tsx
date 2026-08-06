import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BLOCK_LIST, type BlockId } from "@/lib/dashboards/blocks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddBlockMenu({
  current,
  onAdd,
}: {
  current: BlockId[];
  onAdd: (id: BlockId) => void;
}) {
  const remaining = BLOCK_LIST.filter((b) => !current.includes(b.id));
  const [open, setOpen] = useState(false);
  if (!remaining.length) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add block
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
          <DialogDescription>Each block states exactly what it counts.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {remaining.map((b) => (
            <button
              key={b.id}
              type="button"
              className="w-full rounded-md border p-3 text-left hover:bg-muted"
              onClick={() => {
                onAdd(b.id);
                setOpen(false);
              }}
            >
              <p className="text-sm font-medium">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.definition}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SaveDraft({
  existingName,
  onSave,
  onCancel,
  saving,
}: {
  existingName?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(existingName ?? "My dashboard");
  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-44"
        aria-label="Dashboard name"
      />
      <Button size="sm" disabled={saving || !name.trim()} onClick={() => onSave(name.trim())}>
        Save layout
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
