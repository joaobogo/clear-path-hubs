import { type ElementType, type ReactNode } from "react";
import { useInView } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Section-entry reveal.
 *
 * One-shot fade + 8px rise triggered when the element enters the viewport.
 * Never blocks interaction: content is fully present in the DOM the moment
 * it renders — only opacity/transform animate. Reduced-motion users see
 * content immediately (see src/styles/motion.css).
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      data-reveal=""
      data-in={inView ? "true" : undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "motion-reveal",
        inView && "motion-reveal-in",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Stagger container — children with `data-stagger-item` get an incremental
 * delay derived from their index. Keeps the reveal quick: max 6 steps.
 */
export function Stagger({
  step = 60,
  max = 6,
  className,
  children,
}: {
  step?: number;
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={
        {
          ["--taas-stagger-step" as string]: `${step}ms`,
          ["--taas-stagger-max" as string]: String(max),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
