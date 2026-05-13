"use client";

import { useState, useEffect } from "react";
import { 
  Check, 
  X, 
  BrainCircuit, 
  ChevronRight, 
  RotateCcw, 
  Eye, 
  Clock,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ClozeUtils } from "@/lib/utils/cloze";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
  subject: { name: string };
  difficulty: string;
}

interface ReviewSessionProps {
  cards: Flashcard[];
  onComplete: () => void;
}

export function ReviewSession({ cards: initialCards, onComplete }: ReviewSessionProps) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionResults, setSessionResults] = useState<{id: string, rating: number}[]>([]);

  const currentCard = cards[currentIndex];
  const progress = (currentIndex / cards.length) * 100;

  const handleRating = async (rating: number) => {
    if (isFinishing) return;
    
    // Save locally
    setSessionResults(prev => [...prev, { id: currentCard.id, rating }]);

    // API Call
    try {
      await fetch(`/api/flashcards/${currentCard.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch (error) {
      console.error("Failed to record review:", error);
    }

    // Move to next or finish
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsFinishing(true);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-sage-light/20 rounded-full flex items-center justify-center">
          <Check className="w-10 h-10 text-accent" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Nenhuma revisão pendente</h2>
          <p className="text-muted-foreground">Tudo em dia por aqui! Volte mais tarde.</p>
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
          <div className="w-24 h-24 bg-accent text-white rounded-full flex items-center justify-center shadow-xl">
            <Check className="w-12 h-12" />
          </div>
          <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
            <Badge className="bg-sage-light text-accent border-none font-bold">+{sessionResults.length}</Badge>
          </div>
        </div>
        
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold">Sessão Concluída!</h2>
          <p className="text-muted-foreground text-lg">Você revisou {sessionResults.length} flashcards agora.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <div className="bg-muted/30 p-4 rounded-2xl text-center">
            <p className="text-2xl font-bold text-green-600">{sessionResults.filter(r => r.rating >= 3).length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Sucessos</p>
          </div>
          <div className="bg-muted/30 p-4 rounded-2xl text-center">
            <p className="text-2xl font-bold text-red-600">{sessionResults.filter(r => r.rating < 3).length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Dificuldades</p>
          </div>
        </div>

        <Button onClick={onComplete} size="lg" className="rounded-2xl px-12 h-14 text-lg shadow-lg">
          Finalizar Sessão
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Header Info */}
      <div className="flex items-center justify-between px-2">
        <Button variant="ghost" size="sm" onClick={onComplete} className="rounded-xl text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Sair
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {currentIndex + 1} de {cards.length}
          </span>
          <Progress value={progress} className="w-32 h-2" />
        </div>
      </div>

      {/* The Card */}
      <div className={`min-h-[400px] flex flex-col items-center justify-center p-12 text-center bg-card border border-border/50 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] transition-all duration-500 ${showAnswer ? 'border-accent/20' : ''}`}>
        
        {/* Question Side */}
        <div className="space-y-6 w-full animate-in fade-in duration-300">
          <Badge variant="outline" className="bg-sage-light/20 text-accent border-none rounded-lg">
            {currentCard.subject.name}
          </Badge>
          <h3 className="text-2xl md:text-3xl font-bold leading-tight px-4">
            {currentCard.type === 'CLOZE' 
              ? ClozeUtils.getHiddenText(currentCard.question) 
              : currentCard.question}
          </h3>
        </div>

        {/* Separator & Answer Side */}
        {showAnswer && (
          <div className="w-full mt-10 space-y-8 animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="h-px w-20 bg-border mx-auto" />
            <div className="space-y-2">
              <div className="text-muted-foreground text-lg leading-relaxed">
                {currentCard.type === 'CLOZE' 
                  ? ClozeUtils.getRevealedElement(currentCard.question) 
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
            className="w-full max-w-sm rounded-2xl h-16 text-xl shadow-xl hover:scale-[1.02] transition-transform"
          >
            <Eye className="w-6 h-6 mr-3" />
            Revelar Resposta
          </Button>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            <Button 
              variant="outline"
              className="h-16 rounded-2xl border-red-100 hover:bg-red-50 text-red-600 font-bold group"
              onClick={() => handleRating(1)}
            >
              <div className="flex flex-col items-center">
                <span>Errei</span>
                <span className="text-[10px] font-normal opacity-60">Hoje</span>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="h-16 rounded-2xl border-orange-100 hover:bg-orange-50 text-orange-600 font-bold"
              onClick={() => handleRating(2)}
            >
              <div className="flex flex-col items-center">
                <span>Difícil</span>
                <span className="text-[10px] font-normal opacity-60">2 dias</span>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="h-16 rounded-2xl border-blue-100 hover:bg-blue-50 text-blue-600 font-bold"
              onClick={() => handleRating(3)}
            >
              <div className="flex flex-col items-center">
                <span>Bom</span>
                <span className="text-[10px] font-normal opacity-60">4 dias</span>
              </div>
            </Button>
            <Button 
              variant="outline"
              className="h-16 rounded-2xl border-green-100 hover:bg-green-50 text-green-600 font-bold"
              onClick={() => handleRating(4)}
            >
              <div className="flex flex-col items-center">
                <span>Fácil</span>
                <span className="text-[10px] font-normal opacity-60">7 dias</span>
              </div>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
