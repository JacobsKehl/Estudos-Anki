import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number | string;
}

/**
 * Kehl Study Logo Component
 * Uses the Sarara girl icon.
 */
export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <div className={cn("relative overflow-hidden flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <Image
        src="/icon.png"
        alt="Kehl Study Logo"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
