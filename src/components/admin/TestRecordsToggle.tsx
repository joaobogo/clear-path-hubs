/**
 * "Show test records" toggle for admin attention surfaces.
 *
 * Defaults to OFF. State is held per-page (URL search param or local state) —
 * never globally — so turning it on for QA never changes what another operator
 * sees.
 */
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function TestRecordsToggle({
  checked,
  onChange,
  id = "show-test-records",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground">
        Show test records
      </Label>
    </div>
  );
}
