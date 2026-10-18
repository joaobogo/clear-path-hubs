import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type PagePhotographProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
};

/** An unframed editorial image with stable crops and intrinsic dimensions. */
export function PagePhotograph({
  src, alt, width = 1920, height = 1088, priority = false, className,
}: PagePhotographProps) {
  const ref = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(priority);
  useEffect(() => {
    const element = ref.current;
    if (!element || entered) return;
    if (!("IntersectionObserver" in window)) { setEntered(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setEntered(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [entered]);
  return (
    <figure ref={ref} data-entered={entered} className={cn("editorial-photograph m-0 overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </figure>
  );
}