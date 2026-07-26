import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  /** Stable key, also used as the mobile label when `header` is a node. */
  id: string;
  header: ReactNode;
  /** Mobile label override; defaults to `header` when it is a string. */
  label?: string;
  cell: (row: T, index: number) => ReactNode;
  /** Right-align numeric columns. */
  align?: "left" | "right";
  /** Hide on small screens even in card mode (e.g. redundant metadata). */
  hideOnMobile?: boolean;
  className?: string;
  width?: string;
};

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  caption?: string;
  /** Rendered when `rows` is empty. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Accessible description of what clicking a row does. */
  rowActionLabel?: (row: T) => string;
  className?: string;
}

/**
 * Shared workspace table. Above `md` it is a real table with sticky-feeling
 * headers; below `md` each row collapses into a labelled card via
 * `.ws-table-responsive`, so there is never horizontal overflow.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  onRowClick,
  rowActionLabel,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("w-full", className)}>
      <table className="ws-table-responsive w-full border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                  col.align === "right" && "text-right",
                  col.hideOnMobile && "hidden md:table-cell",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={rowKey(row, index)}
                {...(clickable
                  ? {
                      tabIndex: 0,
                      role: "button",
                      "aria-label": rowActionLabel?.(row),
                      onClick: () => onRowClick?.(row),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick?.(row);
                        }
                      },
                    }
                  : {})}
                className={cn(
                  "border-b border-border/70 align-middle transition-colors last:border-0",
                  clickable && "cursor-pointer hover:bg-[color:var(--taas-interactive-hover)]",
                )}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={col.id}
                    data-label={col.label ?? (typeof col.header === "string" ? col.header : col.id)}
                    data-primary={colIndex === 0 ? "true" : undefined}
                    className={cn(
                      "px-3 text-[length:var(--ws-text-body)] text-foreground",
                      "py-[var(--ws-density-y)] md:px-3",
                      col.align === "right" && "md:text-right",
                      col.hideOnMobile && "hidden md:table-cell",
                      col.className,
                    )}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-muted-foreground">No results.</p>
      ) : null}
    </div>
  );
}
