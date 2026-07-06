"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId: string;
  children: React.ReactNode;
}

export function AccessibleDialog({
  isOpen,
  onClose,
  titleId,
  descriptionId,
  children,
}: AccessibleDialogProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle focus trap, focus restore, and Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Record the element that had focus before opening the dialog
    triggerRef.current = document.activeElement as HTMLElement;

    // Set focus to the dialog wrapper initially
    if (dialogRef.current) {
      // Find first focusable element inside dialog
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!dialogRef.current) return;

        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift + Tab -> Wrap to last
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          // Tab -> Wrap to first
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the trigger element when closing
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative z-50 w-full max-w-md bg-card border border-border/40 rounded-[2rem] p-6 shadow-2xl space-y-6 focus:outline-none animate-in zoom-in-95 duration-200"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
