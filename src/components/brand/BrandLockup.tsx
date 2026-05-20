import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLockupVariant = "sidebar" | "compact" | "mark";

interface BrandLockupProps {
  variant?: BrandLockupVariant;
  className?: string;
}

export function BrandLockup({ variant = "sidebar", className }: BrandLockupProps) {
  // TECHNICAL DEBT: Currently using mix-blend-multiply to hide the cream background 
  // on the PNG asset. Replace with a native transparent PNG or SVG in the future
  // for perfect cross-browser and dark mode support.
  const imageClasses = cn(
    "shrink-0 object-contain mix-blend-multiply dark:mix-blend-normal",
    variant === "sidebar" ? "h-14 w-14" : variant === "compact" ? "h-10 w-10" : "h-14 w-14"
  );

  const containerClasses = cn(
    "flex items-center gap-3",
    variant === "sidebar" && "px-2 py-2",
    className
  );

  if (variant === "mark") {
    return (
      <div className={className}>
        <Image
          src="/brand/kehl-mark.png"
          alt="Kehl Study"
          width={56}
          height={56}
          priority
          className={imageClasses}
        />
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <Image
        src="/brand/kehl-mark.png"
        alt="Kehl Study"
        width={56}
        height={56}
        priority
        className={imageClasses}
      />
      <div className="leading-none flex flex-col justify-center">
        <span 
          className={cn(
            "block font-serif font-medium text-[var(--brand-sage)] tracking-[-0.03em]",
            variant === "sidebar" ? "text-2xl" : "text-xl"
          )}
        >
          Kehl
        </span>
        <span 
          className={cn(
            "mt-1 block font-semibold uppercase text-[var(--brand-beige)] tracking-[0.35em]",
            variant === "sidebar" ? "text-[0.66rem]" : "text-[0.55rem]"
          )}
        >
          Study
        </span>
      </div>
    </div>
  );
}
