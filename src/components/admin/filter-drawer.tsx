import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Mobile home for a desk's filter controls.
 *
 * Wide filter grids collapse badly below desktop widths, so small screens get a
 * drawer instead: one trigger showing how many filters are on, the same controls
 * inside, and the active-filter chip row left visible on the page behind it.
 */
export function FilterDrawer({
  activeCount,
  onClear,
  children,
  className,
  title = "Filters",
  description = "Narrow the list. Your filters stay in the URL, so the view can be shared.",
}: {
  /** Number of filters currently applied — shown on the trigger. */
  activeCount: number;
  /** Clear every filter. Omit to hide the clear action. */
  onClear?: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full justify-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {title}
            {activeCount > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-3">{children}</div>
          <SheetFooter className="mt-6 flex-row gap-2">
            {onClear && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                disabled={activeCount === 0}
              >
                Clear all
              </Button>
            )}
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
