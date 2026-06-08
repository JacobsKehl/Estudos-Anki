"use client";

import * as React from "react";
import { User, Target, Calendar, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProfileHeroProps {
  displayName: string;
  email: string;
  focusArea: string;
  examGoal: string;
  deadline: string | null;
  studyDaysOfWeek: string;
  avatarUrl: string | null;
  onEditClick: () => void;
}

export function ProfileHero({
  displayName,
  email,
  focusArea,
  examGoal,
  deadline,
  studyDaysOfWeek,
  avatarUrl,
  onEditClick
}: ProfileHeroProps) {
  
  // Obter as iniciais do nome
  const initials = React.useMemo(() => {
    if (!displayName) return "ES";
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [displayName]);

  // Formatar prazo final de forma amigável
  const formattedDeadline = React.useMemo(() => {
    if (!deadline) return "Não definido";
    try {
      const date = new Date(deadline);
      // Garantir fuso correto para exibição sem UTC drift
      const adjustedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      return adjustedDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return deadline;
    }
  }, [deadline]);

  // Contagem de dias ativos de estudo
  const activeDaysCount = React.useMemo(() => {
    if (!studyDaysOfWeek) return 7;
    return studyDaysOfWeek.split(",").filter(Boolean).length;
  }, [studyDaysOfWeek]);

  return (
    <Card className="rounded-[2.5rem] border-border/40 shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-sage-light/5 relative group">
      {/* Detalhe de iluminação sutil no topo do card */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent/40 via-brand-beige-soft/40 to-accent/40" />

      <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
        {/* Avatar/Iniciais */}
        <div className="relative shrink-0 transition-transform duration-500 hover:scale-[1.03]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-24 h-24 md:w-28 md:h-28 rounded-3xl object-cover shadow-md border-2 border-accent/20"
            />
          ) : (
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-sage-light/40 dark:bg-sage-light/10 text-accent flex items-center justify-center font-serif text-3xl md:text-4xl font-semibold shadow-inner border border-accent/15 select-none text-brand-sage-dark dark:text-accent">
              {initials}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow border border-card">
            <Award className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Informações da Estudante */}
        <div className="flex-1 text-center md:text-left space-y-4">
          <div className="space-y-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 justify-center md:justify-start">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-serif">
                {displayName}
              </h1>
              <span className="inline-flex self-center items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-sage-light/30 dark:bg-sage-light/10 text-accent border border-accent/10">
                Plano ativo: {activeDaysCount} dias por semana
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>

          {/* Grid de Metas e Foco */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/20">
              <div className="w-8 h-8 rounded-xl bg-peach/50 dark:bg-peach/10 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-[#d48166]" />
              </div>
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Foco de Estudo</span>
                <span className="text-xs font-bold text-foreground line-clamp-1">{focusArea || "Geral"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/20">
              <div className="w-8 h-8 rounded-xl bg-sage-light/50 dark:bg-sage-light/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-accent" />
              </div>
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Objetivo / Prova</span>
                <span className="text-xs font-bold text-foreground line-clamp-1">{examGoal || "Estudos"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/20">
              <div className="w-8 h-8 rounded-xl bg-lavender/50 dark:bg-lavender/10 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-[#8e7cc3]" />
              </div>
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Prazo Final</span>
                <span className="text-xs font-bold text-foreground line-clamp-1">{formattedDeadline}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botão de Ação rápida */}
        <button
          onClick={onEditClick}
          className="w-full md:w-auto self-center md:self-start px-5 py-2.5 rounded-xl border border-accent/20 text-accent font-extrabold text-xs tracking-wider uppercase bg-sage-light/10 hover:bg-sage-light/25 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          Editar Perfil
        </button>
      </CardContent>
    </Card>
  );
}
