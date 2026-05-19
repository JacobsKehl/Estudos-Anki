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
  CheckCircle2,
  Sparkles,
  BookOpen,
  Brain,
  RotateCw,
  AlertCircle
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
  const [activeFilter, setActiveFilter] = React.useState<"ALL" | "PROCESSED" | "PENDING" | "ERROR">("ALL");
  
  // Bulk Action Processing States
  const [isProcessingBulkAction, setIsProcessingBulkAction] = React.useState(false);
  const [bulkActionCurrentIndex, setBulkActionCurrentIndex] = React.useState(0);
  const [bulkActionTotal, setBulkActionTotal] = React.useState(0);
  const [bulkActionStep, setBulkActionStep] = React.useState("");
  
  // Consolidation Report Modal State
  const [showReportDialog, setShowReportDialog] = React.useState(false);
  const [reportData, setReportData] = React.useState<{
    processedCount: number;
    subjectsCreatedOrLinked: number;
    blocksCreated: number;
    flashcardsCount: number;
    errorCount: number;
    failedMaterials: { id: string; title: string; error: string }[];
  } | null>(null);
  
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
      if (activeFilter === "PENDING") return m.organizationStatus !== "ORGANIZED" && m.organizationStatus !== "ERROR";
      if (activeFilter === "ERROR") return ["ERROR", "NEEDS_RETRY", "SUBJECT_DETECTION_FAILED", "AI_UNAVAILABLE"].includes(m.organizationStatus);
      
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

  const runBulkAction = async (
    mode: "general" | "content_only" | "flashcards_only" | "clear_flashcards" | "unorganize",
    targetIds?: string[]
  ) => {
    const ids = targetIds || Array.from(selectedIds);
    setBulkActionTotal(ids.length);
    setBulkActionCurrentIndex(0);
    setIsProcessingBulkAction(true);
    
    let processedCount = 0;
    let blocksCreated = 0;
    let flashcardsCount = 0;
    let errorCount = 0;
    const failedMaterials: { id: string; title: string; error: string }[] = [];
    const subjectsLinked = new Set<string>();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const material = materials.find(m => m.id === id);
      const title = material?.title || "PDF Desconhecido";
      
      setBulkActionCurrentIndex(i + 1);
      
      // Update dynamic steps
      if (mode === "general") {
        setBulkActionStep("Lendo páginas e extraindo texto do PDF...");
        await new Promise(r => setTimeout(r, 600));
        setBulkActionStep("Identificando matéria correspondente...");
        await new Promise(r => setTimeout(r, 600));
        setBulkActionStep("Criando blocos de estudos temáticos com IA...");
      } else if (mode === "content_only") {
        setBulkActionStep("Lendo páginas e extraindo texto do PDF...");
        await new Promise(r => setTimeout(r, 600));
        setBulkActionStep("Identificando matéria correspondente...");
        await new Promise(r => setTimeout(r, 600));
        setBulkActionStep("Criando blocos de estudos temáticos (Apenas Teoria)...");
      } else if (mode === "flashcards_only") {
        setBulkActionStep("Carregando blocos de estudo...");
        await new Promise(r => setTimeout(r, 650));
        setBulkActionStep("Gerando flashcards com IA (máx 15 por bloco)...");
      } else if (mode === "clear_flashcards") {
        setBulkActionStep("Limpando flashcards...");
      } else if (mode === "unorganize") {
        setBulkActionStep("Resetando blocos, cards e cronograma...");
      }

      try {
        const res = await fetch(`/api/materials/${id}/organize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          processedCount++;
          blocksCreated += data.blocksCount || 0;
          flashcardsCount += data.flashcardsCount || 0;
          if (material?.subjectName) subjectsLinked.add(material.subjectName);
        } else {
          errorCount++;
          failedMaterials.push({
            id,
            title,
            error: data.error || "Falha ao executar ação"
          });
        }
      } catch (err: any) {
        errorCount++;
        failedMaterials.push({
          id,
          title,
          error: err.message || "Erro de rede / timeout"
        });
      }
    }

    setIsProcessingBulkAction(false);
    
    // Set report data and show report
    setReportData({
      processedCount,
      subjectsCreatedOrLinked: subjectsLinked.size,
      blocksCreated,
      flashcardsCount,
      errorCount,
      failedMaterials
    });
    
    setShowReportDialog(true);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    router.refresh();
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
            <Button 
              variant={activeFilter === "ERROR" ? "outline" : "ghost"} 
              size="sm" 
              onClick={() => setActiveFilter("ERROR")}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold ${
                activeFilter === "ERROR" 
                  ? "border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10" 
                  : "text-muted-foreground"
              }`}
            >
              Erros
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBulkAction("general")}
                  disabled={isProcessingBulkAction}
                  className="rounded-xl font-bold gap-1.5 px-3 py-1.5 text-xs text-accent border-accent/20 hover:bg-accent/5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Organizar Conteúdo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBulkAction("flashcards_only")}
                  disabled={isProcessingBulkAction}
                  className="rounded-xl font-bold gap-1.5 px-3 py-1.5 text-xs text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/5"
                >
                  <Brain className="w-3.5 h-3.5" />
                  Gerar Cards
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBulkAction("clear_flashcards")}
                  disabled={isProcessingBulkAction}
                  className="rounded-xl font-bold gap-1.5 px-3 py-1.5 text-xs text-amber-600 border-amber-500/20 hover:bg-amber-500/5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                  Apagar Cards
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBulkAction("unorganize")}
                  disabled={isProcessingBulkAction}
                  className="rounded-xl font-bold gap-1.5 px-3 py-1.5 text-xs text-red-500 border-red-500/20 hover:bg-red-500/5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Desorganizar
                </Button>
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={isProcessingBulkAction}
                  className="rounded-xl font-bold gap-1.5 transition-all shadow-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir ({selectedIds.size})
                </Button>
              </div>
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
              onOrganizeSingle={(mode) => runBulkAction(mode, [material.id])}
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
              variant="destructive"
              className="rounded-xl h-10 px-5 font-bold transition-all shadow-sm"
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

      {/* Progress HUD Dialog */}
      <Dialog open={isProcessingBulkAction} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-card border border-border/80 shadow-2xl rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-accent">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              Processando em Lote
            </DialogTitle>
            <div className="text-muted-foreground text-sm space-y-4 mt-3">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>Progresso</span>
                <span>{bulkActionCurrentIndex} de {bulkActionTotal} PDFs</span>
              </div>
              
              {/* Custom Progress Bar */}
              <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-accent h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(bulkActionCurrentIndex / bulkActionTotal) * 100}%` }}
                />
              </div>

              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-accent">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Ação Atual: {bulkActionStep}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Por favor, não feche esta janela ou recarregue a página até que a organização do lote seja concluída.
                </p>
              </div>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Consolidated Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-lg bg-card border border-border/80 shadow-2xl rounded-[2rem] p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Organização Concluída!
            </DialogTitle>
            
            <div className="space-y-4 mt-4 text-sm text-muted-foreground">
              <p>O processamento do seu lote foi concluído com sucesso. Aqui está o resumo das ações realizadas:</p>
              
              {/* Telemetry Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/40 rounded-2xl border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">PDFs Processados</span>
                  <div className="text-xl font-extrabold text-foreground">{reportData?.processedCount || 0}</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-2xl border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Matérias Vinculadas</span>
                  <div className="text-xl font-extrabold text-foreground">{reportData?.subjectsCreatedOrLinked || 0}</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-2xl border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Blocos Criados</span>
                  <div className="text-xl font-extrabold text-foreground">{reportData?.blocksCreated || 0}</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-2xl border border-border/50 space-y-1 col-span-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Flashcards Gerados</span>
                  <div className="text-xl font-extrabold text-foreground">{reportData?.flashcardsCount || 0} cards</div>
                </div>
              </div>

              {/* Errored Files Section */}
              {reportData && reportData.errorCount > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="font-bold text-red-500 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    Arquivos com Erro ({reportData.errorCount})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {reportData.failedMaterials.map((f, i) => (
                      <div key={i} className="p-3 bg-red-500/[0.03] border border-red-500/10 rounded-xl space-y-1 text-xs">
                        <span className="block font-bold text-foreground truncate">{f.title}</span>
                        <span className="block text-[10px] leading-tight text-red-500 font-medium">
                          Motivo: {getFriendlyErrorMessage(f.error)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>
          <DialogFooter className="mt-6 pt-4 border-t border-border/40">
            <Button 
              variant="primary"
              onClick={() => setShowReportDialog(false)}
              className="w-full rounded-xl h-10 font-bold"
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function getFriendlyErrorMessage(err: string | null | undefined): string {
  if (!err) return "Erro desconhecido ao processar arquivo.";
  const lower = err.toLowerCase();
  if (lower.includes("api key") || lower.includes("key was reported as leaked")) {
    return "Chave Gemini desativada pelo Google por motivo de segurança. Gere uma nova chave gratuita no Google AI Studio e atualize seu .env local!";
  }
  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("rate limit") || lower.includes("exhausted")) {
    return "Limite temporário da IA atingido. Aguarde alguns instantes e clique em Tentar Novamente.";
  }
  if (lower.includes("texto insuficiente") || lower.includes("texto legivel") || lower.includes("imagem escaneada") || lower.includes("protegido")) {
    return "PDF sem texto selecionável ou protegido. Certifique-se de que o documento não seja composto apenas de imagens digitalizadas.";
  }
  if (lower.includes("not found") || lower.includes("arquivo nao encontrado")) {
    return "Arquivo não encontrado no Storage. Remova e envie o PDF novamente.";
  }
  if (lower.includes("banco") || lower.includes("database") || lower.includes("prisma")) {
    return "Falha local ao salvar os blocos no banco de dados. Tente reprocessar.";
  }
  return err;
}

