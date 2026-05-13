"use client";

import { useState } from "react";
import { 
  Check, 
  X, 
  Edit3, 
  Trash2, 
  BookOpen, 
  Layers, 
  BrainCircuit,
  ChevronRight,
  Filter,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { EditFlashcardDialog } from "./EditFlashcardDialog";
import { toast } from "sonner";
import { ClozeUtils } from "@/lib/utils/cloze";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
  difficulty: string;
  status: string;
  subject: { name: string };
  material: { fileName: string } | null;
  studyBlock: { id: string, title: string } | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
}

interface FlashcardCurationProps {
  initialFlashcards: Flashcard[];
}

import { EmptyState } from "@/components/ui/empty-state";

export function FlashcardCuration({ initialFlashcards }: FlashcardCurationProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(initialFlashcards);
  const [activeTab, setActiveTab] = useState<"PENDING_APPROVAL" | "APPROVED">("PENDING_APPROVAL");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const router = useRouter();

  const filteredCards = flashcards.filter(card => card.status === activeTab);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setIsProcessing(id);
    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar status");

      setFlashcards(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleBulkAction = async (status: "APPROVED" | "ARCHIVED") => {
    const ids = filteredCards.map(c => c.id);
    if (ids.length === 0) return;

    setIsBulkProcessing(true);
    try {
      const response = await fetch("/api/flashcards/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });

      if (!response.ok) throw new Error("Erro na ação em massa");

      setFlashcards(prev => prev.map(c => ids.includes(c.id) ? { ...c, status } : c));
      toast.success(`${ids.length} cards ${status === "APPROVED" ? "aprovados" : "arquivados"} com sucesso.`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar ação em massa.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleRegenerate = async (blockId: string) => {
    if (!blockId) return;
    setIsProcessing(`regen-${blockId}`);
    
    try {
      const response = await fetch(`/api/blocks/${blockId}/flashcards/generate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Erro ao regenerar");
      
      const data = await response.json();
      // Add new cards to the list
      setFlashcards(prev => [...data.flashcards, ...prev]);
      toast.success(`${data.count} novos flashcards gerados!`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao regenerar flashcards.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este flashcard?")) return;
    
    setIsProcessing(id);
    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir");

      setFlashcards(prev => prev.filter(c => c.id !== id));
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
      {/* Tabs & Bulk Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex p-1 bg-muted/30 rounded-2xl border border-border/50 self-start">
          <button
            onClick={() => setActiveTab("PENDING_APPROVAL")}
            className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "PENDING_APPROVAL" 
              ? "bg-white text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Para Aprovar ({flashcards.filter(c => c.status === "PENDING_APPROVAL").length})
          </button>
          <button
            onClick={() => setActiveTab("APPROVED")}
            className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === "APPROVED" 
              ? "bg-white text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aprovados ({flashcards.filter(c => c.status === "APPROVED").length})
          </button>
        </div>

        {activeTab === "PENDING_APPROVAL" && filteredCards.length > 0 && (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl gap-2 border-red-100 text-red-500 hover:bg-red-50"
              onClick={() => handleBulkAction("ARCHIVED")}
              disabled={isBulkProcessing}
            >
              <X className="w-4 h-4" />
              Arquivar Todos
            </Button>
            <Button 
              size="sm" 
              className="rounded-xl gap-2 bg-accent text-accent-foreground"
              onClick={() => handleBulkAction("APPROVED")}
              disabled={isBulkProcessing}
            >
              {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Aprovar Todos
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCards.length === 0 ? (
          <div className="col-span-full">
            <EmptyState 
              icon={Logo}
              title={activeTab === "PENDING_APPROVAL" ? "Nenhum card para aprovar" : "Nenhum card aprovado"}
              description={activeTab === "PENDING_APPROVAL" 
                ? "Você já revisou todos os flashcards novos. Ótimo trabalho!" 
                : "Seus cards aprovados aparecerão aqui após a curadoria."}
            />
          </div>
        ) : (
          filteredCards.map(card => (
            <div 
              key={card.id} 
              className={`bg-card p-6 rounded-3xl border border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] transition-all flex flex-col gap-4 group ${
                isProcessing === card.id || isBulkProcessing ? "opacity-50 pointer-events-none" : ""
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
                      card.difficulty === 'HARD' ? 'bg-red-50 text-red-600' : 
                      card.difficulty === 'MEDIUM' ? 'bg-orange-50 text-orange-600' : 
                      'bg-green-50 text-green-600'
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
                    <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-md">
                      Págs {card.sourcePageStart}-{card.sourcePageEnd}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  {card.studyBlock && (
                    <button 
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-colors"
                      title="Regenerar para este bloco"
                      onClick={() => handleRegenerate(card.studyBlock!.id)}
                      disabled={isProcessing === `regen-${card.studyBlock.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isProcessing === `regen-${card.studyBlock.id}` ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  <button 
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setEditingCard(card)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
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

              <div className="pt-2 flex gap-3">
                {card.status === "PENDING_APPROVAL" ? (
                  <>
                    <Button 
                      className="flex-1 rounded-2xl gap-2 shadow-sm bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => handleStatusChange(card.id, "APPROVED")}
                      disabled={isProcessing === card.id}
                    >
                      {isProcessing === card.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Aprovar Card
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 rounded-2xl gap-2 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleStatusChange(card.id, "ARCHIVED")}
                      disabled={isProcessing === card.id}
                    >
                      {isProcessing === card.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Arquivar
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full rounded-2xl gap-2"
                    onClick={() => handleStatusChange(card.id, "PENDING_APPROVAL")}
                    disabled={isProcessing === card.id}
                  >
                    {isProcessing === card.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Mover para Pendentes"
                    )}
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
    </div>
  );
}
