import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  icon: Icon, 
  title, 
  description, 
  children,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-8", className)}>
      <div className="flex flex-col gap-1 md:gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl md:rounded-2xl bg-sage-light text-accent shadow-sm">
            <Icon className="h-4 w-4 md:h-5 md:h-5" />
          </div>
          {title}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {children}
      </div>
    </div>
  );
}
