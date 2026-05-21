"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Library, Layers, BookOpen, Calendar, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NextStudyResetTimer } from "./NextStudyResetTimer";
import { TodayTaskCard } from "./TodayTaskCard";
import Link from "next/link";

interface NextDayStudySessionProps {
  userId: string;
}

interface NextDayResponse {
  hasPending: boolean;
  date?: string;
  label?: string;
  items?: any[];
}

export function NextDayStudySession({ userId }: NextDayStudySessionProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NextDayResponse>({ hasPending: false });
  const [advanceNextDay, setAdvanceNextDay] = useState(false);

  useEffect(() => {
    async function fetchNextDay() {
      try {
        const res = await fetch("/api/schedule/next-pending-day");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Erro ao buscar o próximo dia pendente:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNextDay();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-sage-light/40 dark:border-accent/10 rounded-[2rem] bg-sage-light/10 dark:bg-accent/5 animate-pulse">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Analisando roteiro...
        </p>
      </div>
    );
  }

  // 1. Caso NÃO haja próximo dia com tarefas pendentes
  if (!data.hasPending) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-sage-light/50 dark:border-accent/10 bg-gradient-to-br from-sage-light/30 to-sage-light/10 dark:from-[#1e251b] dark:to-[#141a12] p-8 md:p-10 shadow-sm text-center max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white dark:bg-black/20 flex items-center justify-center shadow-sm border border-sage-light/30">
          <Sparkles className="w-7 h-7 text-accent" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            Você concluiu tudo! ✨
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Você concluiu todos os blocos de estudos previstos e pendentes. Organize novos materiais na biblioteca ou revise seus flashcards.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/materials" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto rounded-xl px-6 h-11 text-xs font-bold uppercase tracking-wider hover:bg-sage-light/20">
              <Library className="w-4 h-4 mr-2 text-accent" />
              Ir para Biblioteca
            </Button>
          </Link>
          <Link href="/practice?source=today" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto rounded-xl px-6 h-11 text-xs font-bold uppercase tracking-wider shadow-md shadow-accent/15">
              <Layers className="w-4 h-4 mr-2" />
              Ver Cards do Dia
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Caso Haja próximo dia com tarefas pendentes
  return (
    <div className="space-y-10">
      {/* Card de Conclusão Premium */}
      <div className="relative overflow-hidden rounded-[2rem] border border-sage-light/50 dark:border-accent/10 bg-gradient-to-br from-sage-light/30 to-sage-light/10 dark:from-[#1e251b] dark:to-[#141a12] p-8 md:p-10 shadow-sm text-center max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white dark:bg-black/20 flex items-center justify-center shadow-sm border border-sage-light/30">
          <Sparkles className="w-7 h-7 text-accent animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            Hoje está concluído <span className="animate-bounce">✨</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Você finalizou tudo o que estava previsto para hoje. Parabéns pelo foco e dedicação!
          </p>
        </div>

        {/* Timer de reset */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 dark:bg-black/25 border border-sage-light/40 dark:border-accent/5 text-xs font-semibold text-muted-foreground shadow-sm">
          <span>Próximas matérias em:</span>
          <NextStudyResetTimer />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => setAdvanceNextDay(true)}
            disabled={advanceNextDay}
            variant={advanceNextDay ? "outline" : "primary"}
            className="w-full sm:w-auto rounded-xl px-7 h-11 text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-md shadow-accent/15"
          >
            Estudar o próximo dia agora
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Link href="/schedule" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto rounded-xl px-7 h-11 text-xs font-bold uppercase tracking-wider hover:bg-sage-light/20">
              Ver cronograma completo
            </Button>
          </Link>
        </div>
      </div>

      {/* Seção de Adiantamento (renderizada dinamicamente) */}
      {advanceNextDay && data.items && (
        <section className="space-y-6 animate-in slide-in-from-bottom-5 duration-700">
          <div className="p-6 rounded-[2rem] bg-gradient-to-r from-amber-500/5 to-amber-500/10 border border-amber-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                <h3 className="text-base font-extrabold text-foreground uppercase tracking-wider">
                  Adiantamento do próximo dia
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-medium pl-4">
                Você está estudando conteúdos previstos para{" "}
                <span className="font-bold text-amber-700 dark:text-amber-400 capitalize">
                  {data.label}
                </span>.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-black/10 px-3 py-1.5 rounded-xl border border-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              Sessão Antecipada
            </div>
          </div>

          <div className="space-y-3">
            {data.items.map((item: any, idx: number) => (
              <TodayTaskCard
                key={item.id}
                item={item}
                index={idx + 1}
                isAdvanced={true}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
