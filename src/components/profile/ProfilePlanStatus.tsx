"use client";

import * as React from "react";
import { AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface ProfilePlanStatusProps {
  isViable: boolean;
  deficitHours: number;
  surplusHours: number;
  daysRemaining: number;
  studyDaysRemaining: number;
  requiredHours: number;
  totalAvailableHours: number;
  recommendedDailyMinutes: number;
  dailyGoalMinutes: number;
}

export function ProfilePlanStatus({
  isViable,
  deficitHours,
  surplusHours,
  daysRemaining,
  studyDaysRemaining,
  requiredHours,
  totalAvailableHours,
  recommendedDailyMinutes,
  dailyGoalMinutes
}: ProfilePlanStatusProps) {
  
  return (
    <Card className="rounded-[2.5rem] border-border/40 shadow-sm overflow-hidden bg-card">
      <CardContent className="p-8 space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border/30 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isViable ? "bg-sage-light/40 text-accent" : "bg-peach/40 text-[#d48166]"
            }`}>
              {isViable ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground font-serif">Viabilidade do Cronograma</h2>
              <p className="text-[11px] text-muted-foreground">Previsão de conclusão do cronograma atual.</p>
            </div>
          </div>
          <Link 
            href="/schedule"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-accent hover:text-brand-sage-dark font-extrabold text-xs bg-sage-light/15 hover:bg-sage-light/30 transition-all group shrink-0 cursor-pointer"
          >
            Ver cronograma
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Status de viabilidade */}
        <div className="space-y-6">
          {isViable ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sage-light/20 border border-accent/20 flex gap-3.5">
                <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-foreground leading-none">Plano dentro do prazo!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sua meta diária atual é suficiente para cobrir todo o conteúdo planejado. Você tem uma folga de aproximadamente <strong className="text-accent">{surplusHours} horas</strong> no cronograma.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-peach/20 border border-[#d48166]/20 flex gap-3.5">
                <AlertCircle className="w-5 h-5 text-[#d48166] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-foreground leading-none">Atenção com o prazo!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Com a sua meta atual, seu plano exige mais <strong className="text-[#d48166]">{deficitHours} horas</strong> de estudo até a prova. Recomendamos aumentar sua carga horária diária.
                  </p>
                </div>
              </div>

              {studyDaysRemaining > 0 && (
                <div className="p-4 rounded-2xl border border-border/40 bg-muted/20 text-xs text-muted-foreground space-y-1">
                  <p className="font-bold text-foreground">Ajuste sugerido para cumprir a meta:</p>
                  <p className="leading-relaxed">
                    Para cobrir todo o conteúdo pendente até o prazo final, sua meta diária sugerida deve ser de aproximadamente <strong className="text-accent">{recommendedDailyMinutes} minutos</strong> (atualmente {dailyGoalMinutes} min).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Dados e métricas de apoio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-muted/20 border border-border/20 rounded-2xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Dias Corridos</span>
              <span className="text-base font-black text-foreground">{daysRemaining}</span>
            </div>
            
            <div className="p-3 bg-muted/20 border border-border/20 rounded-2xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Dias de Estudo</span>
              <span className="text-base font-black text-foreground">{studyDaysRemaining}</span>
            </div>

            <div className="p-3 bg-muted/20 border border-border/20 rounded-2xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Tempo Exigido</span>
              <span className="text-base font-black text-foreground">{requiredHours}h</span>
            </div>

            <div className="p-3 bg-muted/20 border border-border/20 rounded-2xl">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Tempo Disponível</span>
              <span className="text-base font-black text-foreground">{totalAvailableHours}h</span>
            </div>
          </div>

        </div>

      </CardContent>
    </Card>
  );
}
