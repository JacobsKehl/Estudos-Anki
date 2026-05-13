"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const ScrollArea = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={cn("relative overflow-auto scrollbar-hide", className)}>
      {children}
    </div>
  );
};

export { ScrollArea };
