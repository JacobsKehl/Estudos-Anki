"use client";

import { useState } from "react";
import { 
  Check, 
  BrainCircuit, 
  Eye, 
  ArrowLeft,
  Loader2,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ClozeUtils } from "@/lib/utils/cloze";
import { toast } from "sonner";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
  subject: { name: string };
  difficulty: string;
  reviewState: string;
  intervalDays: number;
  learningStep: number;
  easeFactor: number;
}

interface FlashcardSessionProps {
  mode: "practice" | "review";
  title?: string;
  cards: Flashcard[];
  onComplete: () => void;
}

export function FlashcardSession({ mode, title, cards: initialCards, onComplete }: FlashcardSessionProps) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionResults, setSessionResults] = useState<{id: string, rating: number}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? (currentIndex / cards.length) * 100 : 100;

  const handleRating = async (rating: number) => {
    if (isFinishing || isSaving) return;
    
    setIsSaving(true);
    setSessionResults(prev => [...prev, { id: currentCard.id, rating }]);

    try {
      const res = await fetch(`/api/flashcards/${currentCard.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (!res.ok) throw new Error("Falha ao salvar revisão");
      
      const intervalLabel = getIntervalLabel(rating);
      toast.success(`Voltará em ${intervalLabel}`, {
        duration: 2000,
        position: "bottom-center"
      });

      // Move to next or finish
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
      } else {
        setIsFinishing(true);
      }
    } catch (error) {
      console.error("Failed to record review:", error);
      toast.error("Erro ao salvar revisão. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const getIntervalLabel = (rating: number) => {
    if (!currentCard) return "";
    
    const state = currentCard.reviewState;
    const ease = currentCard.easeFactor || 2.5;
    const ivl = currentCard.intervalDays || 0;
    
    // NEW logic
    if (state === "NEW") {
      if (rating === 1) return "1 min";
      if (rating === 2) return "6 min";
      if (rating === 3) return "10 min";
      if (rating === 4) return "4 dias";
    }
    
    // LEARNING logic
    if (state === "LEARNING") {
      if (rating === 1) return "1 min";
      if (rating === 2) return currentCard.learningStep === 0 ? "6 min" : "10 min";
      if (rating === 3) return currentCard.learningStep === 0 ? "10 min" : "1 dia";
      if (rating === 4) return "4 dias";
    }
    
    // REVIEW logic
    if (state === "REVIEW") {
      if (rating === 1) return "10 min";
      if (rating === 2) return `${Math.max(1, Math.round(ivl * 1.2))} dias`;
      if (rating === 3) return `${Math.max(1, Math.round(ivl * ease))} dias`;
      if (rating === 4) return `${Math.max(1, Math.round(ivl * ease * 1.3))} dias`;
    }

    // RELEARNING logic
    if (state === "RELEARNING") {
      if (rating === 1 || rating === 2) return "10 min";
      if (rating === 3) return "1 dia";
      if (rating === 4) return `${Math.max(1, Math.round(Math.max(ivl, 1) * 1.3))} dias`;
    }

    return "Próximo";
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-sage-light/20 rounded-full flex items-center justify-center">
          <Check className="w-10 h-10 text-accent" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{mode === "practice" ? "Nenhum card disponível" : "Nenhuma revisão pendente"}</h2>
          <p className="text-muted-foreground">{mode === "practice" ? "Você já praticou os cards deste conteúdo ou eles ainda não foram criados." : "Tudo em dia por aqui! Volte mais tarde."}</p>
        </div>
        <Button onClick={onComplete} variant="outline" className="rounded-2xl">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  if (isFinishing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative">
          <div className="w-24 h-24 bg-accent text-white rounded-[2rem] flex items-center justify-center shadow-xl rotate-3">
            <Trophy className="w-12 h-12" />
          </div>
          <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-md">
            <Badge className="bg-sage-light text-accent border-none font-bold">+{sessionResults.length}</Badge>
          </div>
        </div>
        
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-bold tracking-tight">Sessão Concluída!</h2>
          <p className="text-muted-foreground text-lg">
            {mode === "practice" 
              ? `Você praticou ${sessionResults.length} cards deste conteúdo. Os próximos retornos foram agendados conforme seu desempenho.` 
              : `Seu cérebro agradece. Você revisou ${sessionResults.length} flashcards.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl text-center border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-3xl font-bold text-emerald-600">{sessionResults.filter(r => r.rating >= 3).length}</p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-widest font-black mt-1">DOMINADOS</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-3xl text-center border border-amber-100 dark:border-amber-900/30">
            <p className="text-3xl font-bold text-amber-600">{sessionResults.filter(r => r.rating < 3).length}</p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-widest font-black mt-1">EM APRENDIZADO</p>
          </div>
        </div>

        <Button onClick={onComplete} size="lg" className="rounded-2xl px-12 h-16 text-xl shadow-xl hover:scale-105 transition-transform bg-accent text-white font-bold">
          Finalizar Sessão
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Header Info */}
      {title && (
        <div className="text-center pt-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
        </div>
      )}
      <div className="flex items-center justify-between px-2">
        <Button variant="ghost" size="sm" onClick={onComplete} className="rounded-xl text-muted-foreground hover:bg-accent/5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Sair
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Progresso</span>
            <span className="text-xs font-bold">{currentIndex + 1} / {cards.length}</span>
          </div>
          <Progress value={progress} className="w-24 md:w-48 h-2 bg-accent/10" />
        </div>
      </div>

      {/* The Card */}
      <div className={`min-h-[450px] flex flex-col items-center justify-center p-8 md:p-12 text-center bg-card border border-border/40 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] transition-all duration-500 relative overflow-hidden ${showAnswer ? 'ring-2 ring-accent/20' : ''}`}>
        
        {/* State Badge */}
        <div className="absolute top-6 left-6">
          <Badge variant="outline" className="bg-muted/50 border-none rounded-lg text-[9px] uppercase tracking-tighter opacity-50">
            {currentCard.reviewState}
          </Badge>
        </div>

        {/* Question Side */}
        <div className="space-y-8 w-full animate-in fade-in duration-300">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/5 text-accent rounded-full text-[10px] font-black uppercase tracking-widest">
            <BrainCircuit className="w-3 h-3" />
            {currentCard.subject.name}
          </div>
          <h3 className="text-2xl md:text-4xl font-bold leading-tight px-2 tracking-tight">
            {currentCard.type === 'CLOZE' 
              ? ClozeUtils.getHiddenText(currentCard.question) 
              : currentCard.question}
          </h3>
        </div>

        {/* Separator & Answer Side */}
        {showAnswer && (
          <div className="w-full mt-12 space-y-8 animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="h-px w-16 bg-accent/20 mx-auto" />
            <div className="space-y-4">
              <div className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium">
                {currentCard.type === 'CLOZE' 
                  ? <div className="text-accent bg-accent/5 p-4 rounded-2xl border border-accent/10 inline-block">{ClozeUtils.getRevealedElement(currentCard.question)}</div>
                  : currentCard.answer}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-4">
        {!showAnswer ? (
          <Button 
            onClick={() => setShowAnswer(true)} 
            size="lg" 
            className="w-full max-w-sm rounded-2xl h-16 text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all bg-accent text-white font-bold"
          >
            <Eye className="w-6 h-6 mr-3" />
            Revelar Resposta
          </Button>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
            <Button 
              variant="outline"
              disabled={isSaving}
              className="h-20 rounded-3xl border-red-100 hover:bg-red-50 hover:border-red-200 text-red-600 font-black transition-all hover:-translate-y-1 active:translate-y-0"
              onClick={() => handleRating(1)}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base uppercase tracking-tighter">Errei</span>
                <span className="text-[10px] font-bold opacity-40">{getIntervalLabel(1)}</span>
              </div>
            </Button>
            <Button 
              variant="outline"
              disabled={isSaving}
              className="h-20 rounded-3xl border-orange-100 hover:bg-orange-50 hover:border-orange-200 text-orange-600 font-black transition-all hover:-translate-y-1 active:translate-y-0"
              onClick={() => handleRating(2)}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base uppercase tracking-tighter">Difícil</span>
                <span className="text-[10px] font-bold opacity-40">{getIntervalLabel(2)}</span>
              </div>
            </Button>
            <Button 
              variant="outline"
              disabled={isSaving}
              className="h-20 rounded-3xl border-blue-100 hover:bg-blue-50 hover:border-blue-200 text-blue-600 font-black transition-all hover:-translate-y-1 active:translate-y-0"
              onClick={() => handleRating(3)}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base uppercase tracking-tighter">Bom</span>
                <span className="text-[10px] font-bold opacity-40">{getIntervalLabel(3)}</span>
              </div>
            </Button>
            <Button 
              variant="outline"
              disabled={isSaving}
              className="h-20 rounded-3xl border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200 text-emerald-600 font-black transition-all hover:-translate-y-1 active:translate-y-0"
              onClick={() => handleRating(4)}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base uppercase tracking-tighter">Fácil</span>
                <span className="text-[10px] font-bold opacity-40">{getIntervalLabel(4)}</span>
              </div>
            </Button>
          </div>
        )}
        
        {isSaving && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground animate-pulse font-bold uppercase tracking-widest">
            <Loader2 className="w-3 h-3 animate-spin" />
            Sincronizando...
          </div>
        )}
      </div>
    </div>
  );
}
