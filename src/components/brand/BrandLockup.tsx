import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLockupVariant = "sidebar" | "compact" | "mark";

interface BrandLockupProps {
  variant?: BrandLockupVariant;
  className?: string;
}

/**
 * Kehl Study — Brand Lockup
 * Transparent PNG, no backgrounds, no blend hacks.
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
        <span className="text-xl font-serif font-medium tracking-[0.02em] text-brand-sage-dark dark:text-brand-sage">
          Kehl
        </span>
      </div>
    );
  }

  // variant === "sidebar" — fills the full sidebar width
  return (
    <div className={cn("flex items-center gap-4 w-full", className)}>
      <Image
        src="/brand/kehl-mark.png"
        alt="Kehl Study"
        width={96}
        height={96}
        priority
        className="h-[88px] w-[88px] shrink-0 object-contain"
      />

      <div className="leading-none flex flex-col justify-center min-w-0">
        <span className="block text-[2.25rem] font-serif font-semibold tracking-[0.01em] text-brand-sage-dark dark:text-brand-sage leading-none">
          Kehl
        </span>
        <span className="mt-1.2 block text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-brand-beige leading-none pl-[0.08em]">
          Study
        </span>
      </div>
    </div>
  );
}
