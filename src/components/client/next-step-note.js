import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight, Clock, UserCheck } from "lucide-react";
import { buildNextStep } from "@/lib/client-next-step";
import { cn } from "@/lib/utils";
/**
 * "What happens next" under every state: what happens, who owns it, and when.
 * If we owe the client something we say so; if the ball is with them, we say
 * that instead — never silence.
 */
export function NextStepNote({ stage, stageEnteredAt, className, }) {
    const next = buildNextStep(stage, stageEnteredAt);
    const waitingOnClient = next.owner === "client";
    return (_jsxs("div", { className: cn("flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs", next.overdue
            ? "border-warning/40 bg-warning/5 text-warning-foreground"
            : waitingOnClient
                ? "border-border bg-muted/40 text-muted-foreground"
                : "border-primary/30 bg-primary/5 text-muted-foreground", className), children: [next.overdue ? (_jsx(Clock, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-foreground", "aria-hidden": true })) : waitingOnClient ? (_jsx(UserCheck, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground", "aria-hidden": true })) : (_jsx(ArrowRight, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-primary", "aria-hidden": true })), _jsxs("p", { className: "leading-relaxed", children: [
                    _jsx("span", { className: "font-medium text-foreground", children: "Next: " }), next.sentence, " ", _jsx("span", { className: "font-medium text-foreground", children: waitingOnClient ? "You" : "Recruiting team" }), next.due && (_jsxs(_Fragment, { children: [" · ", _jsx("span", { className: cn("font-medium", next.overdue ? "text-warning-foreground" : "text-foreground"), children: next.overdue ? "Overdue — we're on it." : next.due })
                        ] }))] })
        ] }));
}
