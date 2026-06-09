"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const Dialog = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={() => onOpenChange?.(false)} 
      />
      <div className="relative z-50 w-full flex justify-center scale-100 opacity-100 transition-all animate-in zoom-in-95 duration-300">
        {children}
      </div>
    </div>,
    document.body
  );
};

const DialogContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("w-full max-w-lg mx-auto bg-card border border-border shadow-2xl rounded-[2.5rem] p-6 md:p-8 overflow-hidden", className)}>
    {children}
  </div>
);

const DialogHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-6", className)}>
    {children}
  </div>
);

const DialogTitle = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <h2 className={cn("text-2xl font-bold tracking-tight text-foreground", className)}>
    {children}
  </h2>
);

const DialogFooter = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-8", className)}>
    {children}
  </div>
);

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
};
