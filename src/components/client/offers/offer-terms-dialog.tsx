import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  upsertOfferDraft,
  assignHireOwner,
  listOfferOwners,
  type HireRecordDTO,
} from "@/lib/hires.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "./field";

// Owns its own form state; the parent only supplies the target hire and
// success/close callbacks.
export function OfferTermsDialog({
  hire,
  orgId,
  onClose,
  onSaved,
}: {
  hire: HireRecordDTO;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(upsertOfferDraft);
  const assignFn = useServerFn(assignHireOwner);
  const ownersFn = useServerFn(listOfferOwners);

  const [salaryAmount, setSalaryAmount] = useState(
    hire.salary_amount != null ? String(hire.salary_amount) : "",
  );
  const [salaryCurrency, setSalaryCurrency] = useState(hire.salary_currency ?? "EUR");
  const [salaryPeriod, setSalaryPeriod] = useState<string>(hire.salary_period ?? "year");
  const [startDate, setStartDate] = useState(hire.start_date ?? "");
  const [employmentType, setEmploymentType] = useState(hire.employment_type ?? "");
  const [workModel, setWorkModel] = useState(hire.work_model ?? "");
  const [location, setLocation] = useState(hire.location ?? "");
  const [notes, setNotes] = useState(hire.offer_notes ?? "");
  const [guaranteeDays, setGuaranteeDays] = useState(
    hire.guarantee_days != null ? String(hire.guarantee_days) : "",
  );
  const [guaranteeStartsOn, setGuaranteeStartsOn] = useState(hire.guarantee_starts_on ?? "");
  const [guaranteeTerms, setGuaranteeTerms] = useState(hire.guarantee_terms ?? "");
  const [guaranteeVisible, setGuaranteeVisible] = useState(
    hire.guarantee_visible_to_client !== false,
  );
  const [owner, setOwner] = useState<string>(hire.owner_user_id ?? "__unassigned__");

  const { data: ownersData } = useQuery({
    queryKey: ["hire-owners", orgId],
    queryFn: () => ownersFn({ data: { orgId } }),
  });

  const save = useMutation({
    mutationFn: async () => {
      await updateFn({
        data: {
          orgId,
          matchId: hire.candidate_match_id,
          terms: {
            salary_amount: salaryAmount ? Number(salaryAmount) : null,
            salary_currency: salaryCurrency || null,
            salary_period:
              (salaryPeriod as "year" | "month" | "hour") || null,
            start_date: startDate || null,
            employment_type: employmentType || null,
            work_model: workModel || null,
            location: location || null,
            offer_notes: notes || null,
            guarantee_days: guaranteeDays ? Number(guaranteeDays) : null,
            guarantee_starts_on: guaranteeStartsOn || null,
            guarantee_terms: guaranteeTerms || null,
            guarantee_visible_to_client: guaranteeVisible,
          },
        },
      });
      await assignFn({
        data: {
          orgId,
          id: hire.id,
          owner_user_id: owner === "__unassigned__" ? null : owner,
        },
      });
    },
    onSuccess: () => {
      toast.success("Offer terms saved");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Offer terms — {hire.candidate_name}</DialogTitle>
          <DialogDescription>{hire.position_title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Compensation">
            <div className="flex gap-1">
              <Input
                type="number"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="e.g. 90000"
              />
              <Input
                className="w-16"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase())}
                placeholder="EUR"
              />
              <Select value={salaryPeriod} onValueChange={setSalaryPeriod}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">/yr</SelectItem>
                  <SelectItem value="month">/mo</SelectItem>
                  <SelectItem value="hour">/hr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Employment type">
            <Input
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              placeholder="Full-time, contract, …"
            />
          </Field>
          <Field label="Work model">
            <Input
              value={workModel}
              onChange={(e) => setWorkModel(e.target.value)}
              placeholder="Remote, hybrid, on-site"
            />
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Berlin, EU-remote, …"
            />
          </Field>
          <Field label="Owner">
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {(ownersData?.owners ?? []).map((o) => (
                  <SelectItem key={o.user_id} value={o.user_id}>
                    {o.name} · {o.role.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bonus, equity, contingencies, negotiation history…"
              />
            </Field>
          </div>
          <div className="space-y-3 rounded-md border p-3 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Guarantee
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Guarantee period (days)">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={guaranteeDays}
                  onChange={(e) => setGuaranteeDays(e.target.value)}
                  placeholder="e.g. 90"
                />
              </Field>
              <Field label="Guarantee starts on">
                <Input
                  type="date"
                  value={guaranteeStartsOn}
                  onChange={(e) => setGuaranteeStartsOn(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Terms">
              <Textarea
                rows={2}
                value={guaranteeTerms}
                onChange={(e) => setGuaranteeTerms(e.target.value)}
                placeholder="What happens if the hire leaves inside the guarantee period."
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={guaranteeVisible}
                onChange={(e) => setGuaranteeVisible(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Show these terms to the client
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
