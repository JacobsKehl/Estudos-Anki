"use client";

import { useEffect, useState } from "react";
import { Target, CheckCircle2, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DailyGoalAlertProps {
  totalMinutes: number;
}

import { useStudyPreferences } from "@/hooks/useStudyPreferences";

export function DailyGoalAlert({ totalMinutes }: DailyGoalAlertProps) {
  const { preferences, isLoading } = useStudyPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    // Elegant skeleton loader that matches the soft premium aesthetic
    return (
      <div className="bg-card border border-border/40 rounded-2xl p-5 animate-pulse flex items-center justify-between">
        <div className="space-y-2 w-2/3">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-2 bg-muted rounded w-full" />
        </div>
        <div className="h-10 bg-muted rounded-xl w-24" />
      </div>
    );
  }

  const name = preferences.name ? preferences.name.split(" ")[0] : "Estudante";
  const dailyGoal = preferences.dailyGoalMinutes || 120;

  const percentage = Math.min(100, Math.round((totalMinutes / dailyGoal) * 100));
  const isGoalReached = totalMinutes >= dailyGoal;

  return (
    <div className="bg-gradient-to-r from-card to-butter/20 border border-border/30 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isGoalReached ? (
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                <Award className="w-3.5 h-3.5 text-accent" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-sage-light/30 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
            <h3 className="text-sm font-bold text-foreground">
              {isGoalReached 
                ? `Meta atingida! Parabéns, ${name}!` 
                : `Progresso de Hoje para ${name}`}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isGoalReached
              ? `Você agendou ou completou ${totalMinutes} minutos de estudos hoje, ultrapassando sua meta diária de ${dailyGoal} minutos!`
              : `Você tem ${totalMinutes} minutos de estudo recomendados hoje. Isso representa ~${percentage}% da sua meta diária de ${dailyGoal} minutos.`}
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-right shrink-0">
          <div className="text-xs font-bold uppercase tracking-wider text-accent">
            {totalMinutes} / {dailyGoal} <span className="text-[10px] text-muted-foreground">min</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Progress value={percentage} className="h-2 rounded-full bg-muted border border-border/10" />
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest pt-0.5">
          <span>0 min</span>
          <span>Meta: {dailyGoal} min</span>
        </div>
      </div>
    </div>
  );
}
