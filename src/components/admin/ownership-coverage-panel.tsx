/**
 * Ownership coverage panel — the reassignment queue for open roles.
 *
 * Shows owner, backup owner, when each was assigned, and every open role whose
 * owner is missing or inactive (including roles flagged automatically when a
 * staff member was deactivated). Assignment is always explicit: no round-robin,
 * no capacity balancing.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCoverageQueue,
  listOwnershipStaff,
  setPositionOwners,
  previewOwnerBulkReassign,
  applyOwnerBulkReassign,
} from "@/lib/position-ownership.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { ArrowUpRight, AlertTriangle } from "lucide-react";

const NONE = "__none__";

type Queue = Awaited<ReturnType<typeof getCoverageQueue>>;
type Row = Queue["rows"][number];
type Staff = Awaited<ReturnType<typeof listOwnershipStaff>>[number];
type Preview = Awaited<ReturnType<typeof previewOwnerBulkReassign>>;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OwnershipCoveragePanel({
  includeTest = false,
}: {
  includeTest?: boolean;
}) {
  const load = useServerFn(getCoverageQueue);
  const [showAll, setShowAll] = useState(false);

  const staffQ = useQuery({
    queryKey: ["admin", "ownership-staff"],
    queryFn: () => listOwnershipStaff(),
  });

  const q = useQuery({
    queryKey: ["admin", "coverage-queue", includeTest, showAll],
    queryFn: () => load({ data: { include_test: includeTest, all: showAll } }),
  });

  const staff = staffQ.data ?? [];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Ownership &amp; coverage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open roles whose owner is missing, inactive, or flagged for
            reassignment after a staff change.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {q.data && (
            <p className="text-xs text-muted-foreground">
              {q.data.totals.flagged} flagged · {q.data.totals.no_owner} without owner ·{" "}
              {q.data.totals.inactive_owner} inactive owner · {q.data.totals.no_backup} without
              backup
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show only uncovered" : "Show all open roles"}
          </Button>
        </div>
      </div>

      <PanelState
        query={q}
        isEmpty={(q.data?.rows ?? []).length === 0}
        className="mt-4"
        empty={<PanelEmpty className="mt-4" title="All open roles have an active owner" description="Nothing needs reassignment right now." />}
      >
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Open roles with owner, backup owner and assignment dates
            </caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Role</th>
                <th scope="col" className="py-2 pr-3 font-medium">Owner</th>
                <th scope="col" className="py-2 pr-3 font-medium">Assigned</th>
                <th scope="col" className="py-2 pr-3 font-medium">Backup</th>
                <th scope="col" className="py-2 pr-3 font-medium">Assign</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.rows ?? []).map((r) => (
                <CoverageRowView key={r.position_id} row={r} staff={staff} />
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      <BulkReassign staff={staff} includeTest={includeTest} />
    </Card>
  );
}

function CoverageRowView({ row, staff }: { row: Row; staff: Staff[] }) {
  const run = useServerFn(setPositionOwners);
  const qc = useQueryClient();
  const [owner, setOwner] = useState<string>(row.owner_user_id ?? NONE);
  const [backup, setBackup] = useState<string>(row.backup_owner_user_id ?? NONE);

  const mut = useMutation({
    mutationFn: (input: { owner_user_id: string | null; backup_owner_user_id: string | null }) =>
      run({ data: { position_id: row.position_id, ...input } }),
    onSuccess: () => {
      toast.success("Ownership updated");
      void qc.invalidateQueries({ queryKey: ["admin", "coverage-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin", "recruiter-workload"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't update ownership"),
  });

  const dirty =
    owner !== (row.owner_user_id ?? NONE) || backup !== (row.backup_owner_user_id ?? NONE);

  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-3 pr-3">
        <Link
          to="/admin/positions/$id"
          params={{ id: row.position_id }}
          className="font-medium hover:underline"
        >
          {row.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {row.organization_name ?? "Unknown client"} · {row.status.replace(/_/g, " ")}
        </p>
        {row.needs_reassignment && (
          <Badge variant="outline" className="mt-1 gap-1 border-warning text-warning-foreground">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Needs reassignment
            {row.reassignment_reason ? ` · ${row.reassignment_reason.replace(/_/g, " ")}` : ""}
          </Badge>
        )}
      </td>
      <td className="py-3 pr-3">
        {row.owner_user_id ? (
          <>
            <span>{row.owner_name}</span>
            {!row.owner_is_active && (
              <Badge variant="outline" className="ml-2">Inactive</Badge>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">No owner</span>
        )}
      </td>
      <td className="py-3 pr-3 text-muted-foreground">{fmtDate(row.owner_assigned_at)}</td>
      <td className="py-3 pr-3">
        {row.backup_owner_user_id ? (
          <>
            <span>{row.backup_owner_name}</span>
            {!row.backup_owner_is_active && (
              <Badge variant="outline" className="ml-2">Inactive</Badge>
            )}
            <p className="text-xs text-muted-foreground">
              {fmtDate(row.backup_owner_assigned_at)}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">No backup</span>
        )}
      </td>
      <td className="py-3 pr-3">
        <div className="flex flex-wrap items-center gap-2">
          <StaffSelect
            label={`Owner for ${row.title}`}
            value={owner}
            onChange={setOwner}
            staff={staff}
          />
          <StaffSelect
            label={`Backup owner for ${row.title}`}
            value={backup}
            onChange={setBackup}
            staff={staff}
          />
          <Button
            size="sm"
            disabled={!dirty || mut.isPending}
            onClick={() =>
              mut.mutate({
                owner_user_id: owner === NONE ? null : owner,
                backup_owner_user_id: backup === NONE ? null : backup,
              })
            }
          >
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StaffSelect({
  label,
  value,
  onChange,
  staff,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  staff: Staff[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[168px]" aria-label={label}>
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unassigned</SelectItem>
        {staff.map((s) => (
          <SelectItem key={s.user_id} value={s.user_id}>
            {s.name}
            {s.is_active ? "" : " (inactive)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BulkReassign({ staff, includeTest }: { staff: Staff[]; includeTest: boolean }) {
  const previewFn = useServerFn(previewOwnerBulkReassign);
  const applyFn = useServerFn(applyOwnerBulkReassign);
  const qc = useQueryClient();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  const payload = {
    from_user_id: from,
    to_user_id: to,
    include_backup: true,
    include_test: includeTest,
    reason: reason.trim() || undefined,
  };

  const prev = useMutation({
    mutationFn: () => previewFn({ data: payload }),
    onSuccess: (p) => setPreview(p),
    onError: (e: Error) => toast.error(e.message || "Couldn't build preview"),
  });

  const apply = useMutation({
    mutationFn: () => applyFn({ data: payload }),
    onSuccess: (r) => {
      toast.success(`Reassigned ${r.moved} role${r.moved === 1 ? "" : "s"}`);
      setPreview(null);
      setFrom("");
      setTo("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "coverage-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin", "recruiter-workload"] });
    },
    onError: (e: Error) => toast.error(e.message || "Reassignment failed"),
  });

  const ready = from !== "" && to !== "" && from !== to;

  return (
    <section className="mt-6 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Bulk reassign</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Move every open role from one recruiter to another. You will see a
        preview before anything is written.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="bulk-from" className="text-xs">From</Label>
          <Select
            value={from}
            onValueChange={(v) => {
              setFrom(v);
              setPreview(null);
            }}
          >
            <SelectTrigger id="bulk-from" className="mt-1">
              <SelectValue placeholder="Select recruiter" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.name}
                  {s.is_active ? "" : " (inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="bulk-to" className="text-xs">To</Label>
          <Select
            value={to}
            onValueChange={(v) => {
              setTo(v);
              setPreview(null);
            }}
          >
            <SelectTrigger id="bulk-to" className="mt-1">
              <SelectValue placeholder="Select recruiter" />
            </SelectTrigger>
            <SelectContent>
              {staff
                .filter((s) => s.is_active)
                .map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="bulk-reason" className="text-xs">Reason (optional)</Label>
          <Input
            id="bulk-reason"
            className="mt-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. left the company"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!ready || prev.isPending}
          onClick={() => prev.mutate()}
        >
          {prev.isPending ? "Building preview…" : "Preview reassignment"}
        </Button>
        {preview && preview.items.length > 0 && (
          <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending
              ? "Reassigning…"
              : `Reassign ${preview.items.length} role${preview.items.length === 1 ? "" : "s"}`}
          </Button>
        )}
      </div>

      {preview && (
        <div className="mt-4 rounded border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            {preview.from_name} → {preview.to_name}
            {!preview.to_is_active && (
              <Badge variant="outline" className="ml-2">Target is inactive</Badge>
            )}
          </p>
          {preview.items.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              No open roles to move for {preview.from_name}.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {preview.items.map((it) => (
                <li key={`${it.position_id}-${it.role_on_position}`} className="flex flex-wrap gap-2">
                  <Link
                    to="/admin/positions/$id"
                    params={{ id: it.position_id }}
                    className="hover:underline"
                  >
                    {it.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {it.organization_name ?? "Unknown client"} · as {it.role_on_position}
                  </span>
                  {it.conflict && (
                    <span className="text-xs text-warning-foreground">{it.conflict}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {preview.skipped.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Skipped ({preview.skipped.length})
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {preview.skipped.map((s) => (
                  <li key={s.position_id}>
                    {s.title} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Applying writes one audit event per role.
          </p>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        Deactivating a staff member flags their open roles here automatically.
      </p>
    </section>
  );
}
