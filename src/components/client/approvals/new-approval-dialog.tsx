import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createTask,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
} from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toastError } from "@/lib/toast-error";
import { FieldError } from "@/components/ui/field-error";
import { FORM_MESSAGES } from "@/lib/form-validation";

export function NewApprovalDialog({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">(
    "normal",
  );
  const [taskType, setTaskType] = useState<TaskType>("general_follow_up");
  const [blocking, setBlocking] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [reminder, setReminder] = useState<"none" | "daily" | "weekly" | "before_due">("none");
  const createFn = useServerFn(createTask);
  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId,
          title: title.trim(),
          description: description.trim() || undefined,
          task_type: taskType,
          priority,
          blocking,
          reminder_policy: reminder,
          due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("normal");
      setTaskType("general_follow_up");
      setBlocking(false);
      setDueAt("");
      setReminder("none");
      onCreated();
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: Error) =>
      toastError(e, { fallback: "We couldn't submit. Nothing was saved — please try again." }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTitleError(title.trim() ? null : FORM_MESSAGES.required);
            if (title.trim()) submit.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Action title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={240}
              aria-invalid={!!titleError}
              placeholder="e.g. Review shortlist for Head of Sales"
            />
            <FieldError message={titleError} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Context (optional)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "low" | "normal" | "high" | "urgent")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reminder</Label>
              <Select
                value={reminder}
                onValueChange={(v) =>
                  setReminder(v as "none" | "daily" | "weekly" | "before_due")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="before_due">Before due</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={blocking}
              onCheckedChange={(v) => setBlocking(v === true)}
            />
            <span>Blocks delivery — surface this on the overview</span>
          </label>
          {submit.error && (
            <div className="text-sm text-destructive">
              {(submit.error as Error).message}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submit.isPending || !title.trim()}>
              {submit.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
