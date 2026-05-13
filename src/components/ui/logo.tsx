import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number | string;
}

/**
 * Kehl Study Logo Component
 * A premium, minimalist fusion of a heart and an open book.
 * 
 * Design Details:
 * - Top Heart Lobes: Sage Green (Welcoming)
 * - Inner Open Book: Lavender Pastel (Knowledge)
 * - Base Point: Slate (Stability/Foundation)
 * - Bookmark: Accent Sage (Focus)
 */
export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("drop-shadow-sm", className)}
    >
      {/* 
        1. MAIN HEART SHAPE - BASE (Slate)
        Forms the underlying structure and the bottom point
      */}
      <path
        d="M50 92L15 55C10 50 10 40 15 35C20 30 30 30 35 35L50 50L65 35C70 30 80 30 85 35C90 40 90 50 85 55L50 92Z"
        fill="#64748B"
        className="fill-slate-500"
      />

      {/* 
        2. TOP HEART LOBES (Sage Green)
        Rounded top section for a soft, friendly feel
      */}
      <path
        d="M15 35C10 40 10 50 15 55L50 50L85 55C90 50 90 40 85 35C80 30 70 30 65 35L50 50L35 35C30 30 20 30 15 35Z"
        fill="#D1E2C4"
        className="fill-sage-light"
      />
      
      {/* 
        3. OPEN BOOK PAGES (Lavender Pastel)
        Inner heart area shaped like open pages
      */}
      <path
        d="M50 80C50 80 22 65 22 45C22 35 32 30 50 42C68 30 78 35 78 45C78 65 50 80 50 80Z"
        fill="#E9DFFF"
        className="fill-lavender-light"
      />

      {/* 
        4. CENTER FOLD (Negative Space)
        Subtle white divider for the book spine
      */}
      <rect x="49.5" y="42" width="1" height="38" rx="0.5" fill="white" fillOpacity="0.4" />

      {/* 
        5. BOOKMARK (Accent Sage)
        Small V-shaped ribbon on the right page
      */}
      <path
        d="M62 40V55L66 52L70 55V40H62Z"
        fill="#789461"
        className="fill-sage-accent"
      />
    </svg>
  );
}
