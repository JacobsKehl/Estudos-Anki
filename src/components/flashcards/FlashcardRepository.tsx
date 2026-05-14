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
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2,
  PauseCircle,
  Play,
  ExternalLink
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { EditFlashcardDialog } from "./EditFlashcardDialog";
import { toast } from "sonner";
import { ClozeUtils } from "@/lib/utils/cloze";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

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

interface FlashcardRepositoryProps {
  initialFlashcards: Flashcard[];
}

const STATE_CONFIG = [
  { id: "NEW", label: "Novos" },
  { id: "LEARNING", label: "Em aprendizado" },
  { id: "REVIEW", label: "Em revisão" },
  { id: "RELEARNING", label: "Reaprendendo" },
  { id: "SUSPENDED", label: "Suspensos" },
  { id: "ARCHIVED", label: "Arquivados" }
];

export function FlashcardRepository({ initialFlashcards }: FlashcardRepositoryProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(initialFlashcards);
  const [activeTab, setActiveTab] = useState<string>("NEW");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  // Consider SUSPENDED/ARCHIVED as states mapped from status or reviewState
  // For this, we'll assume status = "ARCHIVED" maps to "ARCHIVED", 
  // and reviewState = "SUSPENDED" maps to "SUSPENDED", others are based on reviewState + status="APPROVED"
  const filteredCards = flashcards.filter(card => {
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
      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 scrollbar-none">
        <div className="flex p-1 bg-muted/30 rounded-2xl border border-border/50 w-max">
          {STATE_CONFIG.map(tab => {
            const count = flashcards.filter(c => {
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
                    <Link href={`/blocks/${card.studyBlock.id}`}>
                      <ExternalLink className="w-3 h-3" />
                      Ver Fonte
                      {card.sourcePageStart && (
                        <span className="opacity-50 font-normal">(p.{card.sourcePageStart})</span>
                      )}
                    </Link>
                  </Button>
                )}

                {activeTab !== "ARCHIVED" && activeTab !== "SUSPENDED" && (
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
    </div>
  );
}
