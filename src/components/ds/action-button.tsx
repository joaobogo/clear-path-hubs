import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionButtonProps = Omit<ButtonProps, "onClick"> & {
  /** Async handler. Re-entry is blocked until it settles. */
  onAction: (event: React.MouseEvent<HTMLButtonElement>) => unknown | Promise<unknown>;
  /** Shown while the action is in flight. Defaults to the button label. */
  pendingLabel?: string;
  /** External pending flag (e.g. mutation.isPending). */
  pending?: boolean;
  /** Explains why the button is disabled — never ship a disabled control without one. */
  disabledReason?: string;
};

/**
 * Button with built-in double-submit protection, loading state and an
 * always-explained disabled state. Meets the 44px mobile tap target.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      onAction,
      pendingLabel,
      pending,
      disabled,
      disabledReason,
      children,
      className,
      size,
      ...props
    },
    ref,
  ) => {
    const [running, setRunning] = React.useState(false);
    const inFlight = React.useRef(false);
    const mounted = React.useRef(true);
    React.useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);

    const busy = running || !!pending;
    const isDisabled = busy || !!disabled;

    return (
      <Button
        ref={ref}
        size={size}
        className={cn("min-h-11", className)}
        disabled={isDisabled}
        aria-busy={busy || undefined}
        title={disabled && disabledReason ? disabledReason : props.title}
        onClick={async (event) => {
          if (inFlight.current || isDisabled) return;
          inFlight.current = true;
          setRunning(true);
          try {
            await onAction(event);
          } finally {
            inFlight.current = false;
            if (mounted.current) setRunning(false);
          }
        }}
        {...props}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        {busy ? (pendingLabel ?? children) : children}
      </Button>
    );
  },
);
ActionButton.displayName = "ActionButton";
