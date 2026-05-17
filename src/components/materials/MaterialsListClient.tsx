"use client";
import * as React from "react";
import { MaterialCard } from "./MaterialCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Trash2, 
  CheckSquare, 
  X, 
  Loader2, 
  Info,
  CheckCircle2
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type MaterialItem = {
  id: string;
  title: string;
  subjectName: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "ERROR";
  organizationStatus: string;
  processingError: string | null;
  pageCount: number;
  extractedWords: number;
  uploadedAt: string;
  hasExistingBlocks: boolean;
  blocksCount: number;
  flashcardsCount: number;
};

interface MaterialsListClientProps {
  initialMaterials: MaterialItem[];
}

export function MaterialsListClient({ initialMaterials }: MaterialsListClientProps) {
  const router = useRouter();
  const [materials, setMaterials] = React.useState<MaterialItem[]>(initialMaterials);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"ALL" | "PROCESSED" | "PENDING">("ALL");
  
  // Selection States
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = React.useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = React.useState(false);

  // Sync state if initialMaterials changes (e.g. after refresh)
  React.useEffect(() => {
    setMaterials(initialMaterials);
  }, [initialMaterials]);

  // Filtering Logic
  const filteredMaterials = React.useMemo(() => {
    return materials.filter(m => {
      // Search
      const matchesSearch = 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Category filter
      if (activeFilter === "PROCESSED") return m.organizationStatus === "ORGANIZED";
      if (activeFilter === "PENDING") return m.organizationStatus !== "ORGANIZED";
      
      return true;
    });
  }, [materials, searchQuery, activeFilter]);

  // Toggle single item selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle "Select All" for currently filtered items
  const isAllSelected = filteredMaterials.length > 0 && filteredMaterials.every(m => selectedIds.has(m.id));
  
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredMaterials.forEach(m => next.delete(m.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredMaterials.forEach(m => next.add(m.id));
        return next;
      });
    }
  };

  // Execute Bulk Delete
  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    const toastId = toast.loading(`Excluindo ${selectedIds.size} materiais da nuvem...`);
    try {
      const res = await fetch("/api/materials/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao deletar materiais");

      toast.success(`${selectedIds.size} materiais excluídos com sucesso!`, { id: toastId });
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setShowBulkDeleteDialog(false);
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao excluir materiais em lote", { id: toastId });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => {
      if (prev) {
        setSelectedIds(new Set()); // Clear on cancel
      }
      return !prev;
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Controls Bar */}
      <div className="flex flex-col gap-4 bg-card p-5 rounded-[2rem] border border-border/50 shadow-sm transition-all duration-300">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar materiais por título ou assunto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 transition-all font-medium"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Button 
              variant={activeFilter === "ALL" ? "outline" : "ghost"} 
              size="sm" 
              onClick={() => setActiveFilter("ALL")}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold ${
                activeFilter === "ALL" 
                  ? "border-accent/20 bg-accent/5 text-accent hover:bg-accent/10" 
                  : "text-muted-foreground"
              }`}
            >
              Todos
            </Button>
            <Button 
              variant={activeFilter === "PROCESSED" ? "outline" : "ghost"} 
              size="sm" 
              onClick={() => setActiveFilter("PROCESSED")}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold ${
                activeFilter === "PROCESSED" 
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10" 
                  : "text-muted-foreground"
              }`}
            >
              Processados
            </Button>
            <Button 
              variant={activeFilter === "PENDING" ? "outline" : "ghost"} 
              size="sm" 
              onClick={() => setActiveFilter("PENDING")}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold ${
                activeFilter === "PENDING" 
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10" 
                  : "text-muted-foreground"
              }`}
            >
              Pendentes
            </Button>

            <div className="w-px h-6 bg-border mx-2 hidden md:block" />

            {/* Selection Mode Trigger */}
            {materials.length > 0 && (
              <Button 
                variant={isSelectionMode ? "secondary" : "outline"}
                size="sm" 
                onClick={toggleSelectionMode}
                className={`rounded-xl gap-2 font-bold px-4 py-1.5 text-xs shrink-0 ${
                  isSelectionMode 
                    ? "bg-accent/15 text-accent hover:bg-accent/25 border-none" 
                    : "text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {isSelectionMode ? (
                  <><X className="w-3.5 h-3.5" /> Cancelar</>
                ) : (
                  <><CheckSquare className="w-3.5 h-3.5" /> Selecionar</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Selection Active Panel */}
        {isSelectionMode && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-4">
              {/* Select All Checkbox */}
              <button 
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 text-xs font-bold text-foreground select-none cursor-pointer group"
              >
                <div 
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isAllSelected 
                      ? "bg-accent border-accent text-white" 
                      : "border-border bg-background group-hover:border-accent/40"
                  }`}
                >
                  {isAllSelected && (
                    <svg className="w-3 h-3 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                Selecionar todos do filtro ({filteredMaterials.length})
              </button>

              <Badge className="bg-accent/10 text-accent border-accent/20 px-3 py-0.5 rounded-full text-[10px] font-bold">
                {selectedIds.size} selecionados
              </Badge>
            </div>

            {selectedIds.size > 0 && (
              <Button 
                variant="default"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="rounded-xl font-bold gap-2 px-5 py-2 text-xs bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/10 hover:shadow-red-600/20 active:scale-95 transition-all animate-in zoom-in-95 duration-200 border-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Selecionados ({selectedIds.size})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Grid of Materials */}
      <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-500">
        {filteredMaterials.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed border-border/60 rounded-[2.5rem] bg-muted/5 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">Nenhum material encontrado</p>
              <p className="text-sm text-muted-foreground">Experimente mudar o termo de busca ou o filtro de categoria.</p>
            </div>
          </div>
        ) : (
          filteredMaterials.map((material) => (
            <MaterialCard 
              key={material.id} 
              material={material} 
              isSelected={selectedIds.has(material.id)}
              onSelect={handleToggleSelect}
              isSelectionMode={isSelectionMode}
            />
          ))
        )}
      </div>

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="max-w-md bg-card border border-border/80 shadow-2xl rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-red-500">
              <Trash2 className="w-5 h-5 text-red-500" />
              Excluir {selectedIds.size} Materiais?
            </DialogTitle>
            <div className="text-muted-foreground text-sm space-y-3 mt-3">
              <p>
                Você tem certeza que deseja excluir permanentemente estes <strong className="text-foreground">{selectedIds.size} materiais</strong> de estudo?
              </p>
              <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-xs text-red-800 leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  Esta ação é irreversível:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Todos os blocos de estudo vinculados serão deletados.</li>
                  <li>Todos os flashcards gerados por IA serão destruídos.</li>
                  <li>Os arquivos PDF serão excluídos do bucket do Supabase.</li>
                </ul>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-0 mt-6 pt-4 border-t border-border/40">
            <Button 
              variant="ghost" 
              onClick={() => setShowBulkDeleteDialog(false)} 
              disabled={isDeletingBulk}
              className="rounded-xl h-10 px-4 font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkDelete} 
              disabled={isDeletingBulk}
              variant="default"
              className="rounded-xl h-10 px-5 font-bold bg-red-600 text-white hover:bg-red-700 shadow-sm border-none"
            >
              {isDeletingBulk ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Sim, Excluir</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
