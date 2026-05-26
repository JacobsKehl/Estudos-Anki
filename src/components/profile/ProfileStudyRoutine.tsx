"use client";

import * as React from "react";
import { Sliders, Clock, Calendar, Mail, Compass, Eye, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface ProfileStudyRoutineProps {
  dailyGoalMinutes: number;
  studyResetTime: string;
  studyDaysOfWeek: string;
  flashcardDifficulty: string;
  visualDensity: string;
  reducedMotion: boolean;
  emailReminderEnabled: boolean;
  emailReminderTime: string;
  dailyReminderEmail: string;
}

export function ProfileStudyRoutine({
  dailyGoalMinutes,
  studyResetTime,
  studyDaysOfWeek,
  flashcardDifficulty,
  visualDensity,
  reducedMotion,
  emailReminderEnabled,
  emailReminderTime,
  dailyReminderEmail
}: ProfileStudyRoutineProps) {
  
  // Converter string de dias em texto legível
  const readableDays = React.useMemo(() => {
    if (!studyDaysOfWeek) return "Nenhum dia selecionado";
    const daysMap = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const activeIndices = studyDaysOfWeek.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));
    if (activeIndices.length === 7) return "Todos os dias";
    if (activeIndices.length === 5 && !activeIndices.includes(0) && !activeIndices.includes(6)) return "Segunda a Sexta";
    return activeIndices.map(i => daysMap[i]).join(", ");
  }, [studyDaysOfWeek]);

  // Converter dificuldade em texto legível
  const readableDifficulty = React.useMemo(() => {
    switch (flashcardDifficulty) {
      case "NORMAL_PLUS": return "Desafiador (TRT/Concursos)";
      case "MEDIUM": return "Normal (Equilibrado)";
      case "EASY": return "Básico (Conceitual)";
      default: return flashcardDifficulty;
    }
  }, [flashcardDifficulty]);

  return (
    <Card className="rounded-[2.5rem] border-border/40 shadow-sm overflow-hidden bg-card">
      <CardContent className="p-8 space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sage-light/40 text-accent flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground font-serif">Minha Rotina & Preferências</h2>
              <p className="text-[11px] text-muted-foreground">Configurações ativas de cronograma e curadoria.</p>
            </div>
          </div>
          <Link 
            href="/settings"
            className="px-4 py-2 rounded-xl border border-border/60 hover:border-accent/40 text-muted-foreground hover:text-accent font-bold text-xs bg-muted/20 hover:bg-sage-light/10 transition-all cursor-pointer"
          >
            Configurações completas
          </Link>
        </div>

        {/* Informações detalhadas da rotina */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Rotina de Estudo */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-accent" />
              Parâmetros de Cronograma
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground/60" />
                  Meta de Estudo Diário:
                </span>
                <span className="font-bold text-foreground">{dailyGoalMinutes} minutos</span>
              </div>

              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground/60" />
                  Dias Disponíveis:
                </span>
                <span className="font-bold text-foreground text-right line-clamp-1 max-w-[200px]" title={readableDays}>
                  {readableDays}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground/60" />
                  Reset Diário:
                </span>
                <span className="font-bold text-foreground">às {studyResetTime}</span>
              </div>
            </div>
          </div>

          {/* Curadoria & Notificações */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d48166]" />
              Curadoria & Lembretes
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground/60" />
                  Dificuldade Cards:
                </span>
                <span className="font-bold text-foreground text-right">{readableDifficulty}</span>
              </div>

              <div className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground/60" />
                  Interface:
                </span>
                <span className="font-bold text-foreground capitalize">
                  {visualDensity === "compact" ? "Compacta" : "Confortável"} ({reducedMotion ? "Sem anim." : "Anim. normais"})
                </span>
              </div>

              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground/60" />
                  Lembrete Diário:
                </span>
                <span className="font-bold text-foreground">
                  {emailReminderEnabled ? `Ativo (${emailReminderTime})` : "Desativado"}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Alerta de envio do e-mail */}
        {emailReminderEnabled && (
          <div className="p-3.5 rounded-2xl border border-accent/15 bg-accent/5 flex items-start gap-3">
            <Mail className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              Os lembretes automáticos diários são enviados para o e-mail de curadoria cadastrado: <span className="font-bold text-foreground">{dailyReminderEmail}</span>.
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
