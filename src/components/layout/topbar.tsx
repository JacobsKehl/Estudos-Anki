import * as React from "react";
import { Search, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar conteúdos..."
            className="h-9 w-64 rounded-xl border border-border bg-muted/40 pl-9 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button size="sm" className="hidden gap-2 md:flex rounded-xl">
          <Plus className="h-4 w-4" />
          Novo Material
        </Button>
        <Button variant="ghost" size="icon" className="relative rounded-xl">
          <Bell className="h-4 w-4" />
          <span className="absolute right-3 top-3 flex h-2 w-2 rounded-full bg-accent" />
        </Button>
        <div className="h-8 w-8 rounded-xl bg-sage-light text-accent flex items-center justify-center font-bold text-xs shadow-sm border border-accent/10">
          HK
        </div>
      </div>
    </header>
  );
}
