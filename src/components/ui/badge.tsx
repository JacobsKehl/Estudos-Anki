import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "destructive";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-accent text-accent-foreground",
    secondary: "border-transparent bg-muted text-muted-foreground",
    outline: "text-foreground border-border dark:border-border/60",
    success: "border-transparent bg-success-bg text-success-text dark:bg-emerald-500/10 dark:text-emerald-400",
    destructive: "border-transparent bg-red-500 text-white dark:bg-red-500/20 dark:text-red-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
