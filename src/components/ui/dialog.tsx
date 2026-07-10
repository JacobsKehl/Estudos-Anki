"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DialogContextType {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  titleId: string;
  setTitleId: (id: string) => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

const Dialog = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [mounted, setMounted] = React.useState(false);
  const [titleId, setTitleId] = React.useState("");
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Save/restore focus and lock body scroll
  React.useEffect(() => {
    if (!open || !mounted) return;

    // Save previous focus
    if (typeof document !== "undefined") {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange?.(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus after transition/unmount
      setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 0);
    };
  }, [open, mounted, onOpenChange]);

  // Initial focus on mount
  React.useEffect(() => {
    if (!open || !mounted || !containerRef.current) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(focusableSelector);

    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      containerRef.current.focus();
    }
  }, [open, mounted]);

  // Focus trap Tab key handler
  const handleTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !containerRef.current) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <DialogContext.Provider value={{ open, onOpenChange, titleId, setTitleId }}>
      <div 
        ref={containerRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={handleTab}
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
          onClick={() => onOpenChange?.(false)}
        />
        <div className="relative z-50 w-full flex justify-center scale-100 opacity-100 transition-all animate-in zoom-in-95 duration-300">
          {children}
        </div>
      </div>
    </DialogContext.Provider>,
    document.body
  );
};

const DialogContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const context = React.useContext(DialogContext);
  if (!context) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={context.titleId || undefined}
      className={cn(
        "w-full max-w-lg mx-auto bg-card border border-border shadow-2xl rounded-[2.5rem] p-6 md:p-8 overflow-hidden",
        className
      )}
      onClick={(e) => e.stopPropagation()} // Prevent backdrop click from closing when clicking inside content
    >
      {children}
    </div>
  );
};

const DialogHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-6", className)}>
    {children}
  </div>
);

const DialogTitle = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const context = React.useContext(DialogContext);
  const generatedId = React.useId();
  const titleId = `dialog-title-${generatedId}`;

  React.useEffect(() => {
    if (context) {
      context.setTitleId(titleId);
    }
  }, [context, titleId]);

  return (
    <h2
      id={titleId}
      className={cn("text-2xl font-bold tracking-tight text-foreground", className)}
    >
      {children}
    </h2>
  );
};

const DialogFooter = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-8", className)}>
    {children}
  </div>
);

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
