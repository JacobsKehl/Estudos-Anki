import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLockupVariant = "sidebar" | "compact" | "mark";

interface BrandLockupProps {
  variant?: BrandLockupVariant;
  className?: string;
}

/**
 * Kehl Study — Brand Lockup
 * Renders the brand mark (transparent PNG) with optional wordmark.
 * No backgrounds, no borders, no shadows, no mix-blend hacks.
 */
export function BrandLockup({ variant = "sidebar", className }: BrandLockupProps) {
  if (variant === "mark") {
    return (
      <div className={cn("inline-flex", className)}>
        <Image
          src="/brand/kehl-mark.png"
          alt="Kehl Study"
          width={72}
          height={72}
          priority
          className="h-16 w-16 shrink-0 object-contain"
        />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Image
          src="/brand/kehl-mark.png"
          alt="Kehl Study"
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 object-contain"
        />
        <span className="text-lg font-medium tracking-[-0.03em] text-brand-sage">
          Kehl
        </span>
      </div>
    );
  }

  // variant === "sidebar" (default)
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/brand/kehl-mark.png"
        alt="Kehl Study"
        width={68}
        height={68}
        priority
        className="h-[68px] w-[68px] shrink-0 object-contain"
      />

      <div className="leading-none flex flex-col justify-center">
        <span className="block text-[1.55rem] font-medium tracking-[-0.045em] text-brand-sage">
          Kehl
        </span>
        <span className="mt-1 block text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-brand-beige">
          Study
        </span>
      </div>
    </div>
  );
}
