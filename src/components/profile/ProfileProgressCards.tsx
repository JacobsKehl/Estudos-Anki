"use client";

import * as React from "react";
import { 
  Zap, 
  Calendar, 
  Clock, 
  CheckCircle, 
  BrainCircuit, 
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProfileProgressCardsProps {
  daysStudied: number;
  currentStreak: number;
  completedBlocks: number;
  totalBlocks: number;
  reviewedFlashcards: number;
  pendingFlashcardsToday: number;
  scheduleProgress: number; // Percentual 0-100
}

export function ProfileProgressCards({
  daysStudied,
  currentStreak,
  completedBlocks,
  totalBlocks,
  reviewedFlashcards,
  pendingFlashcardsToday,
  scheduleProgress
}: ProfileProgressCardsProps) {
  
  // Estimar horas com base no número de blocos concluídos (cada bloco tem ~30 min padrão)
  const estimatedHours = React.useMemo(() => {
    if (completedBlocks === 0) return null;
    const totalMinutes = completedBlocks * 30;
    const hours = totalMinutes / 60;
    return hours >= 1 
      ? `${Math.round(hours * 10) / 10}h`
      : `${totalMinutes}min`;
  }, [completedBlocks]);

  return (
    <div className="space-y-6">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">
        Resumo de Progresso
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* 1. Dias Estudados / Streak */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-sage-light/40 text-accent flex items-center justify-center shrink-0">
              <Calendar className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Frequência</p>
              {daysStudied > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{daysStudied}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">dias totais</span>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-brand-sage-dark dark:text-muted-foreground leading-snug">
                  Ainda sem sessões registradas
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Sequência Atual */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-peach/40 text-[#d48166] flex items-center justify-center shrink-0">
              <Zap className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Sequência Atual</p>
              {currentStreak > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{currentStreak}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">dias seguidos</span>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-[#d48166]/80 leading-snug">
                  Foco na consistência!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Tempo Estimado Estudado */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-lavender/40 text-[#8e7cc3] flex items-center justify-center shrink-0">
              <Clock className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Tempo de Estudo</p>
              {estimatedHours ? (
                <div className="flex flex-col">
                  <span className="text-xl font-black text-foreground">{estimatedHours}</span>
                  <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Estimado via blocos</span>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-[#8e7cc3]/85 leading-snug">
                  Nenhum tempo estimado
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 4. Blocos Concluídos */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-sage-light/40 text-accent flex items-center justify-center shrink-0">
              <CheckCircle className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Conteúdo Teórico</p>
              {completedBlocks > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{completedBlocks}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">de {totalBlocks} concluídos</span>
                </div>
              ) : (
                <p className="text-[10px] font-bold text-brand-sage-dark leading-tight">
                  Comece seu primeiro bloco!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Flashcards Revisados */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-lavender/40 text-[#8e7cc3] flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Flashcards Revisados</p>
              {reviewedFlashcards > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{reviewedFlashcards}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">revisões</span>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-[#8e7cc3]/85 leading-snug">
                  Nenhum card revisado ainda
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 6. Cards Pendentes Hoje */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-peach/40 text-[#d48166] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Revisões para Hoje</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl font-black ${pendingFlashcardsToday > 0 ? "text-[#d48166]" : "text-foreground"}`}>
                  {pendingFlashcardsToday}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold">pendentes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7. Progresso Geral */}
        <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card sm:col-span-2 lg:col-span-2 gap-4 transition-all hover:scale-[1.01]">
          <CardContent className="p-5 flex items-center gap-6">
            <div className="w-11 h-11 rounded-2xl bg-sage-light/40 text-accent flex items-center justify-center shrink-0">
              <TrendingUp className="w-5.5 h-5.5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-end">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Progresso do Cronograma</p>
                <span className="text-xs font-black text-accent">{Math.round(scheduleProgress)}%</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-1000 ease-out rounded-full" 
                  style={{ width: `${scheduleProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
