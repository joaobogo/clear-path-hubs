import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
