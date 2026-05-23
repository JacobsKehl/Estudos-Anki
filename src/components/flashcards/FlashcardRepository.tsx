"use client";

import { useState, useEffect } from "react";
import { 
  Check, 
  X, 
  Edit3, 
  Trash2, 
  BookOpen, 
  Layers, 
  BrainCircuit,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2,
  PauseCircle,
  Play,
  ExternalLink,
  UploadCloud
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { EditFlashcardDialog } from "./EditFlashcardDialog";
import { toast } from "sonner";
import { ClozeUtils } from "@/lib/utils/cloze";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
  difficulty: string;
  status: string;
  reviewState: string;
  subject: { name: string };
  material: { fileName: string } | null;
  studyBlock: { id: string, title: string } | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
}

interface Subject {
  id: string;
  name: string;
}

interface FlashcardRepositoryProps {
  initialFlashcards: Flashcard[];
  subjects: Subject[];
}

const STATE_CONFIG = [
  { id: "PENDING", label: "Aguardando Curadoria" },
  { id: "NEW", label: "Novos" },
  { id: "LEARNING", label: "Em aprendizado" },
  { id: "REVIEW", label: "Em revisão" },
  { id: "RELEARNING", label: "Reaprendendo" },
  { id: "SUSPENDED", label: "Suspensos" },
  { id: "ARCHIVED", label: "Arquivados" }
];

export function FlashcardRepository({ initialFlashcards, subjects }: FlashcardRepositoryProps) {
  const router = useRouter();
  const [flashcards, setFlashcards] = useState<Flashcard[]>(initialFlashcards);
  
  useEffect(() => {
    setFlashcards(initialFlashcards);
  }, [initialFlashcards]);
  
  const [activeTab, setActiveTab] = useState<string>("NEW");
  
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  // States for CSV Manual Import
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [fallbackSubjectId, setFallbackSubjectId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skippedDuplicates: number;
    failedRows: number;
    bySubject: Record<string, number>;
  } | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setCsvText("");
      toast.success(`Arquivo ${file.name} selecionado!`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        toast.error("Por favor, envie apenas arquivos CSV.");
        return;
      }
      setImportFile(file);
      setCsvText("");
      toast.success(`Arquivo ${file.name} selecionado!`);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile && !csvText.trim()) {
      toast.error("Envie um arquivo CSV ou cole o texto na área de texto.");
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading("Processando e importando flashcards...");
    
    const formData = new FormData();
    if (importFile) {
      formData.append("file", importFile);
    } else {
      const virtualFile = new File([csvText], "import.csv", { type: "text/csv" });
      formData.append("file", virtualFile);
    }

    if (fallbackSubjectId) {
      formData.append("fallbackSubjectId", fallbackSubjectId);
    }

    try {
      const response = await fetch("/api/flashcards/import-csv", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Importação concluída com sucesso!", { id: toastId });
        setImportSummary(data);
        setIsSummaryOpen(true);
        setCsvText("");
        setImportFile(null);
        setFallbackSubjectId("");
        setIsImportPanelOpen(false);
      } else {
        toast.error(data.error || "Erro ao importar flashcards.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de conexão ao importar flashcards.", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  // Consider SUSPENDED/ARCHIVED as states mapped from status or reviewState
  // For this, we'll assume status = "ARCHIVED" maps to "ARCHIVED", 
  // and reviewState = "SUSPENDED" maps to "SUSPENDED", others are based on reviewState + status="APPROVED"
  const filteredCards = flashcards.filter(card => {
    if (activeTab === "PENDING") return card.status === "PENDING_APPROVAL";
    if (activeTab === "ARCHIVED") return card.status === "ARCHIVED";
    if (activeTab === "SUSPENDED") return card.reviewState === "SUSPENDED" && card.status !== "ARCHIVED";
    return card.reviewState === activeTab && card.status === "APPROVED";
  });

  const handleStateChange = async (id: string, newReviewState: string, newStatus: string = "APPROVED") => {
    setIsProcessing(id);
    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewState: newReviewState, status: newStatus }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar status");

      setFlashcards(prev => prev.map(c => c.id === id ? { ...c, reviewState: newReviewState, status: newStatus } : c));
      toast.success("Card atualizado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este flashcard permanentemente?")) return;
    
    setIsProcessing(id);
    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir");

      setFlashcards(prev => prev.filter(c => c.id !== id));
      toast.success("Card excluído!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir. Tente novamente.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSaveEdit = (id: string, question: string, answer: string) => {
    setFlashcards(prev => prev.map(c => c.id === id ? { ...c, question, answer } : c));
  };

  return (
    <div className="space-y-6">
      {/* CSV Import Section */}
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-accent" />
              Importação Rápida de Flashcards
            </h3>
            <p className="text-xs text-muted-foreground">
              Adicione flashcards em lote via arquivo CSV ou área de texto.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportPanelOpen(!isImportPanelOpen)}
            className="rounded-xl border-accent/20 text-accent hover:bg-accent/5 gap-1.5 font-bold h-9 shrink-0"
          >
            {isImportPanelOpen ? (
              <>Ocultar Painel</>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Importar CSV
              </>
            )}
          </Button>
        </div>

        {isImportPanelOpen && (
          <form onSubmit={handleImportSubmit} className="mt-6 border-t border-border/20 pt-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Drag and Drop Zone (Priority) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  1. Upload de Arquivo CSV (Prioridade)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                    isDragging 
                      ? "border-accent bg-accent/5" 
                      : importFile 
                        ? "border-accent/40 bg-accent/5" 
                        : "border-border/60 hover:border-border"
                  }`}
                  onClick={() => document.getElementById("csv-file-input")?.click()}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <UploadCloud className={`w-8 h-8 mb-2 ${importFile ? "text-accent" : "text-muted-foreground/60"}`} />
                  {importFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-accent truncate max-w-[250px]">{importFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(importFile.size / 1024).toFixed(2)} KB</p>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setImportFile(null); }}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 underline mt-1 block mx-auto"
                      >
                        Remover arquivo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        Arraste seu CSV aqui ou <span className="text-accent underline font-bold">clique para selecionar</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">Suporta arquivos .csv delimitados por vírgula</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Textarea Zone (Alternative) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Ou: Colar CSV Manualmente
                </label>
                <Textarea
                  value={csvText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setCsvText(e.target.value);
                    if (importFile) setImportFile(null);
                  }}
                  className="rounded-2xl min-h-[140px] text-xs font-mono resize-none focus:ring-accent"
                  placeholder={`"Pergunta 1","Resposta 1"\nPergunta 2,Resposta com vírgulas internas ou aspas\n"Pergunta 3","Resposta 3"`}
                />
              </div>

            </div>

            {/* Fallback Subject Dropdown & Submit */}
            <div className="flex flex-col sm:flex-row justify-between items-end gap-4 bg-muted/20 border border-border/40 p-4 rounded-2xl">
              <div className="space-y-2 w-full sm:max-w-xs">
                <label htmlFor="fallback-subject" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Matéria de Fallback (Caso falhe a classificação)
                </label>
                <Select value={fallbackSubjectId} onValueChange={setFallbackSubjectId}>
                  <SelectTrigger id="fallback-subject" className="rounded-xl bg-background border-border/50 text-xs">
                    <SelectValue placeholder="Selecione uma matéria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id} className="text-xs">
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsImportPanelOpen(false);
                    setCsvText("");
                    setImportFile(null);
                    setFallbackSubjectId("");
                  }}
                  disabled={isImporting}
                  className="rounded-xl h-10 text-xs px-4"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isImporting}
                  className="rounded-xl bg-accent text-accent-foreground font-bold h-10 text-xs px-6 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-transform w-full sm:w-auto"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 mr-2" />
                      Importar Flashcards
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 scrollbar-none">
        <div className="flex p-1 bg-muted/30 rounded-2xl border border-border/50 w-max">
          {STATE_CONFIG.map(tab => {
            const count = flashcards.filter(c => {
              if (tab.id === "PENDING") return c.status === "PENDING_APPROVAL";
              if (tab.id === "ARCHIVED") return c.status === "ARCHIVED";
              if (tab.id === "SUSPENDED") return c.reviewState === "SUSPENDED" && c.status !== "ARCHIVED";
              return c.reviewState === tab.id && c.status === "APPROVED";
            }).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 md:px-6 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                  ? "bg-white dark:bg-black/40 text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} <span className="ml-1 opacity-50">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCards.length === 0 ? (
          <div className="col-span-full">
            <EmptyState 
              icon={Layers}
              title="Nenhum card aqui"
              description="Você não tem flashcards nesta categoria no momento."
            />
          </div>
        ) : (
          filteredCards.map(card => (
            <div 
              key={card.id} 
              className={`bg-card p-6 rounded-3xl border border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] transition-all flex flex-col gap-4 group ${
                isProcessing === card.id ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 flex-wrap items-center">
                    <Badge variant="outline" className="bg-accent/5 text-accent border-accent/10 rounded-lg px-2 py-0.5 flex gap-1 items-center">
                      <Sparkles className="w-3 h-3" />
                      Gerado por IA
                    </Badge>
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-none rounded-lg px-2 py-0.5">
                      {card.type === 'CLOZE' ? 'Cloze' : 'Q&A'}
                    </Badge>
                    <Badge variant="outline" className={`border-none rounded-lg px-2 py-0.5 ${
                      card.difficulty === 'HARD' ? 'bg-rose-50 text-rose-600' : 
                      card.difficulty === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 
                      'bg-accent/10 text-accent'
                    }`}>
                      {card.difficulty}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {card.subject.name}
                    </span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {card.studyBlock?.title || "Bloco s/ nome"}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setEditingCard(card)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                    <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(card.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                    {card.type === 'CLOZE' ? 'Texto com Lacuna' : 'Pergunta'}
                  </span>
                  <p className="text-lg font-semibold leading-tight">
                    {card.type === 'CLOZE' ? ClozeUtils.getRevealedElement(card.question) : card.question}
                  </p>
                </div>
                
                <div className="h-px bg-border/40" />

                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                    {card.type === 'CLOZE' ? 'Resposta da Lacuna' : 'Resposta'}
                  </span>
                  <p className="text-muted-foreground text-sm leading-relaxed">{card.answer}</p>
                </div>
              </div>

              {/* Ações */}
              <div className="pt-2 flex flex-wrap gap-2">
                {/* Ver Fonte — links to block PDF viewer at the source pages */}
                {card.studyBlock && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl h-8 text-xs text-muted-foreground hover:text-accent hover:bg-accent/5 gap-1.5"
                    asChild
                  >
                    <Link href={`/blocks/${card.studyBlock.id}?returnTo=/flashcards`}>
                      <ExternalLink className="w-3 h-3" />
                      Ver Fonte
                      {card.sourcePageStart && (
                        <span className="opacity-50 font-normal">(p.{card.sourcePageStart})</span>
                      )}
                    </Link>
                  </Button>
                )}

                {activeTab === "PENDING" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-accent/20 text-accent hover:bg-accent/5 h-8 text-xs font-semibold"
                      onClick={() => handleStateChange(card.id, "NEW", "APPROVED")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Aprovar Card
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-rose-100 text-rose-600 hover:bg-rose-50 h-8 text-xs font-semibold"
                      onClick={() => handleDelete(card.id)}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Rejeitar Card
                    </Button>
                  </>
                )}

                {activeTab !== "ARCHIVED" && activeTab !== "SUSPENDED" && activeTab !== "PENDING" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-amber-100 text-amber-600 hover:bg-amber-50 h-8 text-xs"
                      onClick={() => handleStateChange(card.id, "SUSPENDED", "APPROVED")}
                    >
                      <PauseCircle className="w-3 h-3 mr-1" />
                      Suspender
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-border/50 hover:bg-muted/50 h-8 text-xs"
                      onClick={() => handleStateChange(card.id, card.reviewState, "ARCHIVED")}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Arquivar
                    </Button>
                  </>
                )}


                {activeTab === "SUSPENDED" && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-accent/20 text-accent hover:bg-accent/5 h-8 text-xs"
                    onClick={() => handleStateChange(card.id, "NEW", "APPROVED")}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Retomar (como Novo)
                  </Button>
                )}

                {activeTab === "ARCHIVED" && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-accent/20 text-accent hover:bg-accent/5 h-8 text-xs"
                    onClick={() => handleStateChange(card.id, "NEW", "APPROVED")}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Restaurar
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <EditFlashcardDialog 
        flashcard={editingCard}
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSave={handleSaveEdit}
      />

      {/* Import Summary Dialog */}
      <Dialog open={isSummaryOpen} onOpenChange={(open) => {
        setIsSummaryOpen(open);
        if (!open) {
          router.refresh();
        }
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem] p-6">
          <DialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-accent" />
            </div>
            <DialogTitle className="text-lg font-bold">Importação Concluída!</DialogTitle>
          </DialogHeader>

          {importSummary && (
            <div className="space-y-6 my-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-muted/30 border border-border/40 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Importados</span>
                  <span className="text-xl font-black text-accent mt-1 block">{importSummary.imported}</span>
                </div>
                <div className="p-3 bg-muted/30 border border-border/40 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Duplicados</span>
                  <span className="text-xl font-black text-foreground mt-1 block">{importSummary.skippedDuplicates}</span>
                </div>
                <div className="p-3 bg-muted/30 border border-border/40 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Falhas</span>
                  <span className="text-xl font-black text-rose-500 mt-1 block">{importSummary.failedRows}</span>
                </div>
              </div>

              {importSummary.bySubject && Object.keys(importSummary.bySubject).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Distribuição por Disciplina
                  </span>
                  <div className="max-h-[180px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                    {Object.entries(importSummary.bySubject)
                      .filter(([_, count]) => count > 0)
                      .map(([subj, count]) => (
                        <div 
                          key={subj} 
                          className="flex justify-between items-center py-2 px-3 bg-muted/20 border border-border/30 rounded-xl text-xs"
                        >
                          <span className="font-semibold text-foreground truncate mr-2">{subj}</span>
                          <Badge variant="outline" className="bg-accent/5 text-accent border-accent/15 rounded-lg font-bold shrink-0">
                            {count} cards
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={() => {
                setIsSummaryOpen(false);
                router.refresh();
              }} 
              className="w-full rounded-xl bg-accent text-accent-foreground font-bold"
            >
              Fechar e Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
