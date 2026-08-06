import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BulkDueDate({ onApply }: { onApply: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Change due date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change due date</DialogTitle>
        </DialogHeader>
        <Input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onApply(null);
              setOpen(false);
            }}
          >
            Clear due date
          </Button>
          <Button
            disabled={!val}
            onClick={() => {
              onApply(new Date(val).toISOString());
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkReassign({ onApply }: { onApply: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign selected approvals</DialogTitle>
        </DialogHeader>
        <Label className="text-xs">Assignee user ID (UUID)</Label>
        <Input
          placeholder="00000000-0000-0000-0000-000000000000"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Paste the team member's user ID. Team-picker UI coming next; this works today for admins
          moving urgent items.
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onApply(null);
              setOpen(false);
            }}
          >
            Unassign
          </Button>
          <Button
            disabled={val.length !== 36}
            onClick={() => {
              onApply(val);
              setOpen(false);
            }}
          >
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
