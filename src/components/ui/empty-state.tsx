import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 md:py-20 px-6 text-center animate-in fade-in zoom-in duration-500",
      className
    )}>
      <div className="w-16 h-16 md:w-20 md:h-20 bg-sage-light/20 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mb-6 transform -rotate-6 transition-transform hover:rotate-0 duration-500">
        <Icon className="w-8 h-8 md:w-10 md:h-10 text-accent" />
      </div>
      <h3 className="text-lg md:text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm md:text-base max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      {action && (
        <Button 
          size="lg" 
          className="rounded-2xl h-12 md:h-14 px-6 md:px-8 shadow-lg shadow-accent/10 w-full md:w-auto"
          asChild={!!action.href}
          onClick={action.onClick}
        >
          {action.href ? (
            <Link href={action.href}>{action.label}</Link>
          ) : (
            action.label
          )}
        </Button>
      )}
    </div>
  );
}
