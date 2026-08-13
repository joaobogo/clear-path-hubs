/**
 * Keyboard-first navigation for staff queues.
 *
 * Presentation only: this hook never decides what an action does or whether a
 * row is allowed to be actioned — it only moves focus and forwards Enter to the
 * row's single primary action, which the queue itself supplies.
 *
 * Bindings (shared by every admin queue so the muscle memory transfers):
 *   j / ArrowDown  next row
 *   k / ArrowUp    previous row
 *   Enter          run the highlighted row's primary action
 *   o              open the highlighted row's record
 *   /              focus the queue's filter field
 *   Escape         clear the highlight (or blur the filter field)
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const QUEUE_SHORTCUTS = [
  { keys: ["j", "k"], label: "Move between rows" },
  { keys: ["Enter"], label: "Primary action" },
  { keys: ["o"], label: "Open record" },
  { keys: ["/"], label: "Filter" },
  { keys: ["Esc"], label: "Clear highlight" },
] as const;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export type QueueKeyboard = {
  /** Index of the highlighted row, or -1 when nothing is highlighted. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Spread on the element wrapping the rows. */
  listProps: { role: "list"; "data-queue-keyboard": "on" };
  /** Spread on each row element, in render order. */
  rowProps: (index: number) => {
    ref: (node: HTMLElement | null) => void;
    tabIndex: number;
    "data-queue-row": number;
    "data-active": "true" | undefined;
    onFocus: () => void;
    onMouseEnter: () => void;
  };
  /** Attach to the queue's filter input so `/` can focus it. */
  filterRef: (node: HTMLInputElement | null) => void;
};

export function useQueueKeyboard(args: {
  count: number;
  /** Runs the highlighted row's single primary action. */
  onPrimary?: (index: number) => void;
  /** Opens the highlighted row's record. */
  onOpen?: (index: number) => void;
  enabled?: boolean;
}): QueueKeyboard {
  const { count, onPrimary, onOpen, enabled = true } = args;
  const [activeIndex, setActive] = useState(-1);
  const rows = useRef<Array<HTMLElement | null>>([]);
  const filter = useRef<HTMLInputElement | null>(null);

  const setActiveIndex = useCallback(
    (index: number) => {
      const next = Math.max(-1, Math.min(index, count - 1));
      setActive(next);
      if (next >= 0) {
        const node = rows.current[next];
        node?.focus({ preventScroll: true });
        node?.scrollIntoView({ block: "nearest" });
      }
    },
    [count],
  );

  useEffect(() => {
    if (activeIndex > count - 1) setActive(count > 0 ? count - 1 : -1);
  }, [count, activeIndex]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex(activeIndex < 0 ? 0 : activeIndex + 1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(activeIndex <= 0 ? 0 : activeIndex - 1);
      } else if (e.key === "/") {
        if (filter.current) {
          e.preventDefault();
          filter.current.focus();
          filter.current.select();
        }
      } else if (e.key === "Enter" && activeIndex >= 0 && onPrimary) {
        e.preventDefault();
        onPrimary(activeIndex);
      } else if (e.key === "o" && activeIndex >= 0 && onOpen) {
        e.preventDefault();
        onOpen(activeIndex);
      } else if (e.key === "Escape") {
        setActive(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, activeIndex, count, onPrimary, onOpen, setActiveIndex]);

  return {
    activeIndex,
    setActiveIndex,
    listProps: { role: "list", "data-queue-keyboard": "on" },
    rowProps: (index: number) => ({
      ref: (node: HTMLElement | null) => {
        rows.current[index] = node;
      },
      tabIndex: activeIndex === index ? 0 : -1,
      "data-queue-row": index,
      "data-active": activeIndex === index ? ("true" as const) : undefined,
      onFocus: () => setActive(index),
      onMouseEnter: () => undefined,
    }),
    filterRef: (node: HTMLInputElement | null) => {
      filter.current = node;
    },
  };
}

/** Shared highlight styling so every queue reads the same. */
export const QUEUE_ROW_ACTIVE_CLASS =
  "outline-none data-[active=true]:ring-2 data-[active=true]:ring-primary/50 data-[active=true]:bg-primary/5";
