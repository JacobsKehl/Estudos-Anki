"use client";

import { useState } from "react";
import { 
  RotateCw, 
  Play, 
  Calendar, 
  CheckCircle2, 
  Clock,
  LayoutDashboard,
  BrainCircuit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import Link from "next/link";

interface ReviewDashboardProps {
  pendingCards: any[];
  stats: {
    totalPending: number;
    dueToday: number;
    reviewedToday: number;
    pendingApproval: number;
  }
}

export function ReviewDashboard({ pendingCards, stats }: ReviewDashboardProps) {
  const router = useRouter();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Pending Approval Notice */}
      {stats.pendingApproval > 0 && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-blue-700">
            <BrainCircuit className="w-5 h-5" />
            <p className="text-sm font-medium">
              Você tem <strong>{stats.pendingApproval} flashcards</strong> aguardando aprovação. Eles ainda não entram nas revisões até serem aprovados.
            </p>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-100" asChild>
            <Link href="/flashcards">Curadoria</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Para Hoje</span>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-bold">{stats.dueToday}</p>
            <p className="text-sm text-muted-foreground">Flashcards aguardando revisão</p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Concluídos</span>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-bold">{stats.reviewedToday}</p>
            <p className="text-sm text-muted-foreground">Revisados nas últimas 24h</p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tempo Médio</span>
          </div>
          <div className="space-y-1">
            <p className="text-4xl font-bold">12s</p>
            <p className="text-sm text-muted-foreground">Por flashcard (estimado)</p>
          </div>
        </div>
      </div>

      <div className="bg-accent/5 border border-accent/10 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <div className="flex-1 space-y-4 text-center md:text-left">
          {stats.dueToday > 0 ? (
            <>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Sua mente está pronta?</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-md">
                O algoritmo selecionou os {stats.dueToday} flashcards que você está prestes a esquecer. 
                Revise agora para fortalecer a conexão neural.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 justify-center md:justify-start">
                <Button 
                  size="lg" 
                  className="rounded-2xl h-12 md:h-14 px-8 gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto"
                  asChild
                >
                  <Link href="/practice?source=today">
                    <Play className="w-5 h-5 fill-current" />
                    Iniciar Revisão
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="rounded-2xl h-12 md:h-14 px-8 gap-2 border-accent/20 text-accent w-full sm:w-auto" asChild>
                  <Link href="/flashcards">
                    <LayoutDashboard className="w-5 h-5" />
                    Ver Por Matéria
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Nenhuma revisão pendente agora</h2>
              <p className="text-muted-foreground text-base md:text-lg max-w-md">
                Tudo em dia por aqui! Seus cards voltarão aqui quando o algoritmo indicar o melhor momento.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 justify-center md:justify-start">
                <Button variant="outline" size="lg" className="rounded-2xl h-12 md:h-14 px-8 gap-2 border-accent/20 text-accent w-full sm:w-auto" asChild>
                  <Link href="/materials">
                    <RotateCw className="w-5 h-5" />
                    Organizar Estudos
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
        
        <div className="hidden lg:flex w-48 h-48 md:w-64 md:h-64 bg-accent/10 rounded-full items-center justify-center relative shadow-[inset_0_0_40px_rgba(var(--accent),0.05)]">
          <div className="absolute inset-0 border-2 border-dashed border-accent/20 rounded-full animate-[spin_30s_linear_infinite]" />
          <BrandLockup variant="mark" className="opacity-40 scale-[3] origin-center" />
        </div>
      </div>

      {/* Subject Summary */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Resumo por Matéria</h3>
        {pendingCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(new Set(pendingCards.map(c => c.subject.name))).map(subjectName => {
              const count = pendingCards.filter(c => c.subject.name === subjectName).length;
              return (
                <div key={subjectName} className="flex items-center justify-between p-4 bg-card border border-border/40 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="font-medium">{subjectName}</span>
                  </div>
                  <span className="text-sm font-bold bg-muted px-2 py-1 rounded-lg">{count} cards</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Nenhuma matéria com revisões pendentes no momento.</p>
        )}
      </div>
    </div>
  );
}
