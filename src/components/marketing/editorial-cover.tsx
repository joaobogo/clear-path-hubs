import type { ReactNode } from "react";
import { PagePhotograph } from "@/components/marketing/page-photograph";
import { cn } from "@/lib/utils";

export function EditorialCover({ image, alt, children, className, width, height }: {
  image: string;
  alt: string;
  children: ReactNode;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <section className={cn("editorial-cover relative isolate overflow-hidden", className)}>
      <PagePhotograph src={image} alt={alt} width={width} height={height} priority className="absolute inset-0 -z-20 h-full w-full" />
      <div aria-hidden className="editorial-cover-scrim absolute inset-0 -z-10" />
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-32 sm:px-6 sm:pb-12 sm:pt-40 lg:px-8 lg:pt-44">
        {children}
      </div>
    </section>
  );
}