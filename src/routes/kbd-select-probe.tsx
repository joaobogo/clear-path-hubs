import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/kbd-select-probe")({ component: Probe });

function Probe() {
  const [v, setV] = React.useState("full_time");
  const [w, setW] = React.useState("full_time");
  const [n, setN] = React.useState(0);
  return (
    <div className="p-10">
      <button data-testid="counter" onClick={() => setN(n + 1)}>
        count {n}
      </button>
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

      <SelectPrimitive.Root value={w} onValueChange={setW}>
        <SelectPrimitive.Trigger data-testid="raw-trigger" aria-label="Raw">
          <SelectPrimitive.Value />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content>
            <SelectPrimitive.Viewport>
              <SelectPrimitive.Item value="full_time">
                <SelectPrimitive.ItemText>Full time</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
              <SelectPrimitive.Item value="part_time">
                <SelectPrimitive.ItemText>Part time</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
              <SelectPrimitive.Item value="contract">
                <SelectPrimitive.ItemText>Contract</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
              <SelectPrimitive.Item value="temporary">
                <SelectPrimitive.ItemText>Temporary</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      <p data-testid="raw-value">{w}</p>
    </div>
  );
}
