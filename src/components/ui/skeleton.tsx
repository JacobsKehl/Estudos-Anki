import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "sage" | "beige" | "default";
}

export function Skeleton({ className, variant = "default", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse",
        variant === "sage" && "bg-sage-light/20 dark:bg-sage-light/5 border border-sage-light/30 dark:border-sage-light/10",
        variant === "beige" && "bg-brand-beige/10 dark:bg-brand-beige/5 border border-brand-beige/20 dark:border-brand-beige/5",
        variant === "default" && "bg-slate-200/50 dark:bg-slate-800/40",
        className
      )}
      {...props}
    />
  );
}
