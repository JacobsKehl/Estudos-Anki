"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = ({ 
  children, 
  onValueChange, 
  defaultValue,
  value: controlledValue 
}: { 
  children: React.ReactNode, 
  onValueChange?: (v: string) => void, 
  defaultValue?: string,
  value?: string
}) => {
  const [value, setValue] = React.useState(controlledValue || defaultValue || "");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (controlledValue !== undefined) {
      setValue(controlledValue);
    }
  }, [controlledValue]);

  return (
    <div className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { value, setValue, open, setOpen, onValueChange });
        }
        return child;
      })}
    </div>
  );
};

const SelectTrigger = ({ className, children, value, setOpen, open }: any) => (
  <button
    type="button"
    onClick={() => setOpen(!open)}
    className={cn(
      "flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-background px-4 py-2 text-sm font-medium shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
      className
    )}
  >
    {children}
    <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-300", open && "rotate-180")} />
  </button>
);

const SelectValue = ({ placeholder, value }: any) => (
  <span className={cn(!value && "text-muted-foreground")}>
    {value || placeholder}
  </span>
);

const SelectContent = ({ children, open, setOpen, value, setValue, onValueChange }: any) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-1">
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, { 
                selected: (child.props as any).value === value,
                onClick: () => {
                  setValue((child.props as any).value);
                  onValueChange?.((child.props as any).value);
                  setOpen(false);
                }
              });
            }
            return child;
          })}
        </div>
      </div>
    </>
  );
};

const SelectItem = ({ children, className, onClick, selected }: any) => (
  <div
    onClick={onClick}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 px-3 text-sm font-medium outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50",
      selected && "bg-accent/10 text-accent",
      className
    )}
  >
    {children}
  </div>
);

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
};
