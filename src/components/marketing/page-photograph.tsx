import { cn } from "@/lib/utils";

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
  return (
    <figure className={cn("m-0 overflow-hidden", className)}>
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