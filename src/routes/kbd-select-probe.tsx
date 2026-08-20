import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/kbd-select-probe")({ component: Probe });

function Probe() {
  const [v, setV] = React.useState("full_time");
  return (
    <div className="p-10">
      <Select value={v} onValueChange={setV}>
        <SelectTrigger aria-label="Employment Type" data-testid="trigger" className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full_time">Full time</SelectItem>
          <SelectItem value="part_time">Part time</SelectItem>
          <SelectItem value="contract">Contract</SelectItem>
          <SelectItem value="temporary">Temporary</SelectItem>
          <SelectItem value="internship">Internship</SelectItem>
        </SelectContent>
      </Select>
      <p data-testid="value">{v}</p>
    </div>
  );
}
