"use client";

import * as React from "react";
import { Search, Sun, Moon } from "lucide-react";
import { CommandPalette } from "@/components/ui/command-palette";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";

export function Topbar() {
  const [open, setOpen] = React.useState(false);
  const { preferences, updatePreferences } = useStudyPreferences();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const isDark = mounted && (
    preferences.theme === "dark" || 
    (preferences.theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    updatePreferences({ theme: nextTheme });
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/60 bg-background/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="group hidden md:flex items-center gap-3 h-9 px-3.5 rounded-xl border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-accent/30 hover:bg-muted/50 transition-all text-sm"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm font-medium">Buscar...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground/60 border border-border/60 rounded-md ml-6 group-hover:border-accent/20 transition-colors">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search icon */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-border/60 bg-muted/30 text-muted-foreground"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-xl border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-accent/35 hover:bg-muted/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Alternar tema escuro/claro"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-500 animate-spin-slow" />
            ) : (
              <Moon className="w-4 h-4 text-slate-500" />
            )}
          </button>
          
          <div className="h-8 w-8 rounded-xl bg-sage-light text-accent flex items-center justify-center font-bold text-xs shadow-sm border border-accent/10">
            GF
          </div>
        </div>
      </header>

      <CommandPalette isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
