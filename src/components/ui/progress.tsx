import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showValue?: boolean;
}

const Progress = ({ value, max = 100, className, showValue = false }: ProgressProps) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="w-full">
      {showValue && (
        <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={cn("relative h-1.5 w-full overflow-hidden bg-muted/20 rounded-full", className)}>
        <div
          className="h-full w-full flex-1 bg-accent transition-all duration-500 ease-in-out"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    </div>
  );
};

export { Progress };
