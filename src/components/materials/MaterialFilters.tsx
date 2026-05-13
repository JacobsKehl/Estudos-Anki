import * as React from "react";
import { Button } from "@/components/ui/button";
import { Filter, Search } from "lucide-react";

export function MaterialFilters() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-2xl border border-border/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar materiais por título ou matéria..."
          className="h-9 w-full rounded-xl border border-border bg-background pl-9 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 transition-all"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
        <Button variant="outline" size="sm" className="rounded-xl border-accent/20 bg-accent/5 text-accent hover:bg-accent/10">
          Todos
        </Button>
        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
          Processados
        </Button>
        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
          Pendentes
        </Button>
        <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
        <Button variant="outline" size="sm" className="rounded-xl gap-2 text-muted-foreground shrink-0">
          <Filter className="w-4 h-4" /> Matérias
        </Button>
      </div>
    </div>
  );
}
